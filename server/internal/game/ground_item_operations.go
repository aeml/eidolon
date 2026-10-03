package game

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"reflect"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

var ErrGroundItemFull = errors.New("free bag space to recover the pending ground item")

type groundItemPublication struct {
	OperationID string
	ExpiresAt   time.Time
}

func decodeGroundItem(payload string) (Item, error) {
	var item Item
	decoder := json.NewDecoder(bytes.NewBufferString(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&item); err != nil {
		return item, err
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		return item, errors.New("unsupported ground item payload")
	}
	return item, nil
}

func normalizedGroundItem(item Item) Item {
	item = cloneItem(item)
	if len(item.Stats) == 0 {
		item.Stats = nil // Match the omitted empty-map wire representation.
	}
	if len(item.Gems) == 0 {
		item.Gems = nil
	}
	if item.Stack == 0 {
		item.Stack = 1 // Existing implicit single-item gear, not negative stacks.
	}
	return item
}

func groundDropSourceSlot(player *Entity, moved Item) (int, error) {
	selected := -1
	for index, item := range player.Inventory {
		if item.ID != moved.ID {
			continue
		}
		if selected != -1 || !reflect.DeepEqual(normalizedGroundItem(item), moved) {
			return -1, errors.New("ground item source custody changed")
		}
		selected = index
	}
	if selected == -1 {
		return -1, errors.New("ground item source missing")
	}
	for _, storage := range [][]Item{player.Stash, player.Buyback} {
		for _, item := range storage {
			if item.ID == moved.ID {
				return -1, errors.New("ground item source identity is duplicated across storage")
			}
		}
	}
	for _, item := range player.Equipment {
		if item.ID == moved.ID {
			return -1, errors.New("ground item source identity is also equipped")
		}
	}
	return selected, nil
}

func freezeGroundItemPlan(player *Entity, loot *Entity, kind string, moved, remaining Item) (database.GroundItemOperation, error) {
	op := database.GroundItemOperation{Version: 1, ID: database.GroundItemOperationID(uuid.NewString()), Kind: kind,
		Username: player.Name, PlayerID: player.ID, LootID: loot.ID, InstanceID: loot.InstanceID,
		LootOwnerID: loot.LootOwnerID, LootPartyID: loot.LootPartyID, X: loot.X, Z: loot.Z,
		LootTime: loot.LootTime.UTC().Truncate(time.Millisecond), LootCreatedAt: loot.CreatedAt.UTC().Truncate(time.Millisecond),
		CreatedAt: time.Now().UTC().Truncate(time.Millisecond)}
	if kind == database.GroundItemPickup {
		if loot.GroundItemGeneration == math.MaxInt64 {
			return op, errors.New("ground item generation exhausted")
		}
		op.Generation = loot.GroundItemGeneration + 1
	}
	before, err := json.Marshal(normalizedGroundItem(*loot.LootItem))
	if err != nil {
		return op, err
	}
	item, err := json.Marshal(moved)
	if err != nil {
		return op, err
	}
	op.BeforePayload, op.MovedPayload = string(before), string(item)
	if remaining.Stack > 0 {
		item, err = json.Marshal(remaining)
		if err != nil {
			return op, err
		}
		op.RemainingPayload = string(item)
	}
	op.Fingerprint, err = database.GroundItemFingerprint(op)
	if err != nil {
		return op, err
	}
	return op, op.Validate()
}

// Pure preparation: nothing is debited or published while a shared intent is
// being written. The eventual coordinator owns the account work lock and must
// reserve the returned operation durably before ApplyDurableGroundItem.
func (w *World) PrepareDurableInventoryDrop(playerID string, slot int, itemID string, expectedStack int) (database.GroundItemOperation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return database.GroundItemOperation{}, errors.New("character unavailable")
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	if player.Type != TypePlayer || player.State == "DEAD" || player.Health <= 0 || player.Disconnected || w.TradeByPlayer[playerID] != "" {
		return database.GroundItemOperation{}, errors.New("character cannot drop an item now")
	}
	if slot < 0 || slot >= len(player.Inventory) || itemID == "" || player.Inventory[slot].ID != itemID {
		return database.GroundItemOperation{}, errors.New("bag selection changed")
	}
	item := normalizedGroundItem(player.Inventory[slot])
	if item.Stack != expectedStack || IsChronicleQuestItem(item) {
		return database.GroundItemOperation{}, errors.New("item quantity changed or item is soulbound")
	}
	if _, err := groundDropSourceSlot(player, item); err != nil {
		return database.GroundItemOperation{}, err
	}
	loot := &Entity{ID: "loot-drop-" + uuid.NewString(), LootItem: &item,
		X: player.X, Z: player.Z, InstanceID: player.InstanceID}
	return freezeGroundItemPlan(player, loot, database.GroundItemDrop, item, Item{})
}

// Use exact metadata when merging. Same-name gems/gear with different qualities,
// affixes or socket data are not interchangeable currency. Plan on owned copies.
func placeGroundItem(inventory []Item, item Item, splitID string) ([]Item, int) {
	planned := cloneItems(inventory)
	remaining := item.Stack
	if item.MaxStack <= 1 {
		for _, current := range planned {
			if current.ID == item.ID {
				return planned, remaining // Never rename and duplicate unique gear.
			}
		}
	}
	if item.MaxStack > 1 {
		for index := range planned {
			current := &planned[index]
			if current.ID == "" || current.Stack < 1 || current.MaxStack != item.MaxStack || current.Stack >= current.MaxStack {
				continue
			}
			left, right := normalizedGroundItem(*current), normalizedGroundItem(item)
			left.ID, right.ID, left.Stack, right.Stack = "", "", 0, 0
			if !reflect.DeepEqual(left, right) {
				continue
			}
			amount := min(remaining, current.MaxStack-current.Stack)
			current.Stack += amount
			remaining -= amount
			if remaining == 0 {
				return planned, 0
			}
		}
	}
	for index := range planned {
		if planned[index].ID == "" {
			copy := cloneItem(item)
			copy.Stack = remaining
			for _, current := range planned {
				if current.ID == copy.ID {
					// A previous partial pickup may already own this original
					// stack ID. Give only the newly split bag stack a stable ID.
					copy.ID = splitID
					break
				}
			}
			planned[index] = copy
			return planned, 0
		}
	}
	return planned, remaining
}

// Reserve the live projection before external IO. A prepare failure must only
// release it after the shared store proves this exact intent never existed.
// An ambiguous prepare remains reserved and does not expire or permit pickup.
func (w *World) PrepareDurableGroundPickup(playerID, lootID string) (database.GroundItemOperation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player, loot := w.Entities[playerID], w.Entities[lootID]
	if player == nil || player.Type != TypePlayer || loot == nil || loot.Type != TypeLoot || loot.LootItem == nil {
		return database.GroundItemOperation{}, errors.New("character or loot unavailable")
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	loot.Mu.Lock()
	defer loot.Mu.Unlock()
	if loot.LootTime.IsZero() || !time.Now().Before(loot.LootTime.Add(time.Minute)) {
		return database.GroundItemOperation{}, errors.New("ground loot expired or has no availability time")
	}
	if player.Type != TypePlayer || player.State == "DEAD" || player.Health <= 0 || player.Disconnected ||
		player.InstanceID != loot.InstanceID || loot.GroundItemReservation != "" ||
		(loot.LootOwnerID != "" && loot.LootOwnerID != playerID) {
		return database.GroundItemOperation{}, errors.New("loot unavailable to this character")
	}
	if party := w.Parties[loot.LootPartyID]; party != nil {
		party.Mu.RLock()
		restricted := party.LootRule == "master" && party.MasterLooterID != playerID
		party.Mu.RUnlock()
		if restricted {
			return database.GroundItemOperation{}, errors.New("master looter only")
		}
	}
	dx, dz := player.X-loot.X, player.Z-loot.Z
	if distance := dx*dx + dz*dz; math.IsNaN(distance) || math.IsInf(distance, 0) || distance >= 36 {
		return database.GroundItemOperation{}, errors.New("loot out of range")
	}
	item := normalizedGroundItem(*loot.LootItem)
	_, remainder := placeGroundItem(player.Inventory, item, "ground-planning-only")
	if remainder == item.Stack {
		return database.GroundItemOperation{}, ErrGroundItemFull
	}
	moved := cloneItem(item)
	moved.Stack -= remainder
	remaining := cloneItem(item)
	remaining.Stack = remainder
	op, err := freezeGroundItemPlan(player, loot, database.GroundItemPickup, moved, remaining)
	if err != nil {
		return op, err
	}
	loot.GroundItemReservation = op.ID
	loot.GroundReservationHash = op.Fingerprint
	return op, nil
}

// The character effect and its existing private delivery receipt form one
// complete snapshot. Receipt replay precedes item-presence/capacity checks.
// World publication/removal is separate and requires saved-character proof.
func (w *World) ApplyDurableGroundItem(op database.GroundItemOperation) (bool, error) {
	if err := op.Validate(); err != nil {
		return false, err
	}
	moved, err := decodeGroundItem(op.MovedPayload)
	if err != nil {
		return false, err
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[op.PlayerID]
	if player == nil {
		return false, errors.New("ground item character unavailable")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Type != TypePlayer || player.Name != op.Username {
		return false, errors.New("ground item owner changed")
	}
	if previous, found := player.ItemDeliveryReceipts[op.ID]; found {
		if previous != op.Fingerprint {
			return false, errors.New("ground item identity reused for another effect")
		}
		return false, nil
	}
	if op.Kind == database.GroundItemPickup {
		loot := w.Entities[op.LootID]
		if loot == nil {
			return false, errors.New("reserved ground item projection unavailable")
		}
		loot.Mu.RLock()
		reserved := loot.GroundItemReservation == op.ID && loot.GroundReservationHash == op.Fingerprint && loot.GroundItemGeneration == op.Generation-1
		loot.Mu.RUnlock()
		if !reserved {
			return false, errors.New("ground item reservation changed")
		}
	}
	inventory := cloneItems(player.Inventory)
	if op.Kind == database.GroundItemDrop {
		selected, err := groundDropSourceSlot(player, moved)
		if err != nil {
			return false, err
		}
		inventory[selected] = Item{}
	} else {
		var remainder int
		inventory, remainder = placeGroundItem(inventory, moved, "ground-stack-"+op.ID[len("grounditem:"):])
		if remainder != 0 {
			return false, ErrGroundItemFull
		}
	}
	player.Inventory = inventory
	if player.ItemDeliveryReceipts == nil {
		player.ItemDeliveryReceipts = map[string]string{}
	}
	player.ItemDeliveryReceipts[op.ID] = op.Fingerprint
	player.UnjournaledSave = true
	if op.Kind == database.GroundItemPickup {
		w.UpdateCollectionQuestProgress(player, moved.Name, moved.Stack)
	}
	return true, nil
}

// The coordinator supplies the actual strongly read saved character, never its
// unsaved RAM copy. This helper cannot be used to infer database confirmation.
// Drop availability time must also come from its retained shared ledger.
func (w *World) CompleteGroundItemProjection(op database.GroundItemOperation, saved *database.Character, availableAt time.Time) error {
	if !database.GroundItemCharacterReceiptMatches(saved, op) {
		return errors.New("ground item save receipt missing or mismatched")
	}
	before, err := decodeGroundItem(op.BeforePayload)
	if err != nil {
		return err
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	loot := w.Entities[op.LootID]
	if loot != nil {
		loot.Mu.Lock()
		defer loot.Mu.Unlock()
	}
	if op.Kind == database.GroundItemDrop {
		if availableAt.IsZero() || availableAt.Before(op.CreatedAt) {
			return errors.New("ground item publication time unavailable")
		}
		if published, found := w.groundItemPublished[op.LootID]; found {
			if published.OperationID != op.ID || !published.ExpiresAt.Equal(availableAt.Add(time.Minute)) {
				return errors.New("ground item publication identity/time changed")
			}
			return nil // Already published, even if another player took all of it.
		}
		if time.Since(availableAt) >= time.Minute {
			return nil // Never resurrect a durably expired ledger projection.
		}
		if w.groundItemPublished == nil {
			w.groundItemPublished = map[string]groundItemPublication{}
		}
		// This is only a bounded process-local projection guard, not durable
		// custody. After restart the shared ledger must decide what to restore.
		if len(w.groundItemPublished) >= 10000 {
			for id, published := range w.groundItemPublished {
				if time.Now().After(published.ExpiresAt) {
					delete(w.groundItemPublished, id)
				}
			}
			if len(w.groundItemPublished) >= 10000 {
				return errors.New("ground item projection capacity unavailable")
			}
		}
		if loot != nil {
			if loot.Type != TypeLoot || loot.GroundItemOrigin != op.ID || !loot.LootTime.Equal(availableAt) {
				return errors.New("ground item projection identity/time conflict")
			}
			w.groundItemPublished[op.LootID] = groundItemPublication{OperationID: op.ID, ExpiresAt: availableAt.Add(time.Minute)}
			return nil // Never refill a partially picked-up restored projection.
		}
		loot = &Entity{ID: op.LootID, Type: TypeLoot, LootItem: &before,
			X: op.X, Y: .5, Z: op.Z, InstanceID: op.InstanceID,
			CreatedAt: availableAt, LootTime: availableAt, GroundItemOrigin: op.ID}
		w.groundLootLocked(loot)
		w.Entities[loot.ID] = loot
		w.Grid.Add(loot)
		w.groundItemPublished[op.LootID] = groundItemPublication{OperationID: op.ID, ExpiresAt: availableAt.Add(time.Minute)}
		return nil
	}
	if loot == nil {
		if op.RemainingPayload == "" {
			return nil
		}
		return errors.New("partial ground item projection must be restored from its ledger")
	}
	if loot.Type != TypeLoot || loot.LootItem == nil {
		return errors.New("ground item projection changed type")
	}
	if loot.GroundItemGeneration == op.Generation && loot.GroundItemReservation == "" {
		if loot.GroundCompletionHash == op.Fingerprint {
			return nil // This exact completion already advanced the projection.
		}
		return errors.New("ground item completion generation belongs to another intent")
	}
	if loot.GroundItemGeneration != op.Generation-1 || loot.GroundItemReservation != op.ID || loot.GroundReservationHash != op.Fingerprint || !reflect.DeepEqual(normalizedGroundItem(*loot.LootItem), before) {
		return errors.New("ground item reservation/generation changed")
	}
	if op.RemainingPayload == "" {
		w.Grid.Remove(loot)
		delete(w.Entities, op.LootID)
		return nil
	}
	remaining, err := decodeGroundItem(op.RemainingPayload)
	if err != nil {
		return err
	}
	loot.LootItem, loot.GroundItemGeneration, loot.GroundItemReservation, loot.GroundReservationHash = &remaining, op.Generation, "", ""
	loot.GroundCompletionHash = op.Fingerprint
	return nil
}
