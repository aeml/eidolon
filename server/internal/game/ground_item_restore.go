package game

import (
	"errors"
	"reflect"
	"time"

	"eidolon-server/internal/database"
)

// The coordinator must supply the latest strongly read generation, not a
// historical drop. Completed custody additionally requires its owner's actual
// saved receipt. Pending accepted pickups remain reserved beyond ground expiry
// until their character effect can be committed; their remainders never renew.
func (w *World) RestoreGroundItemProjection(record database.GroundItemRecord, saved *database.Character) error {
	if err := record.Validate(); err != nil {
		return err
	}
	if record.State == database.GroundItemComplete && !database.GroundItemCharacterReceiptMatches(saved, record.GroundItemOperation) {
		return errors.New("ground item projection lacks saved receipt")
	}
	if record.State == database.GroundItemPending && record.Kind == database.GroundItemDrop {
		return nil // No debit receipt/publication time: nothing may be shown.
	}
	payload, generation := record.GroundPayload(), record.Generation
	if record.State == database.GroundItemPending {
		payload, generation = record.BeforePayload, record.Generation-1
	}
	active := record.State == database.GroundItemPending || time.Now().Before(record.ExpiresAt)
	var item Item
	var err error
	if payload != "" {
		item, err = decodeGroundItem(payload)
		if err != nil {
			return err // Never strip future opaque item fields during restoration.
		}
	}
	before, err := decodeGroundItem(record.BeforePayload)
	if err != nil {
		return err
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if previous, found := w.groundItemPublished[record.LootID]; found {
		if previous.Generation > record.Generation || (previous.Generation == record.Generation && previous.OperationID != record.ID) {
			return errors.New("ground item projection would replace newer custody")
		}
	}
	loot := w.Entities[record.LootID]
	if loot != nil {
		loot.Mu.Lock()
		defer loot.Mu.Unlock()
		birth := record.LootCreatedAt
		if record.Kind == database.GroundItemDrop {
			birth = record.AvailableAt
		}
		if loot.Type != TypeLoot || loot.LootItem == nil || loot.InstanceID != record.InstanceID ||
			loot.X != record.X || loot.Z != record.Z || loot.LootOwnerID != record.LootOwnerID || loot.LootPartyID != record.LootPartyID ||
			!loot.LootTime.UTC().Truncate(time.Millisecond).Equal(record.AvailableAt) || !loot.CreatedAt.UTC().Truncate(time.Millisecond).Equal(birth) ||
			loot.GroundItemGeneration > generation || (loot.GroundItemReservation != "" && (loot.GroundItemReservation != record.ID || loot.GroundReservationHash != record.Fingerprint)) {
			return errors.New("ground item projection identity or reservation changed")
		}
		current := normalizedGroundItem(*loot.LootItem)
		matchesCurrent := payload != "" && reflect.DeepEqual(current, item)
		matchesPrior := record.Kind == database.GroundItemPickup && loot.GroundItemGeneration == record.Generation-1 && reflect.DeepEqual(current, before)
		if !matchesCurrent && !matchesPrior {
			return errors.New("ground item projection quantity or metadata changed")
		}
	}
	if w.groundItemPublished == nil {
		w.groundItemPublished = map[string]groundItemPublication{}
	}
	if _, found := w.groundItemPublished[record.LootID]; !found && len(w.groundItemPublished) >= 10000 {
		for id, previous := range w.groundItemPublished {
			if time.Now().After(previous.ExpiresAt) && w.Entities[id] == nil {
				delete(w.groundItemPublished, id)
			}
		}
		if len(w.groundItemPublished) >= 10000 {
			return errors.New("ground item projection capacity unavailable")
		}
	}
	// This process-local generation fence complements, never replaces, the
	// durable latest-record read. It also prevents an old drop refilling a
	// consumed item after its entity has been removed.
	w.groundItemPublished[record.LootID] = groundItemPublication{
		OperationID: record.ID, Generation: record.Generation, ExpiresAt: record.ExpiresAt,
	}
	if !active || payload == "" {
		if loot != nil {
			w.Grid.Remove(loot)
			delete(w.Entities, record.LootID)
		}
		return nil
	}
	if loot == nil {
		birth := record.LootCreatedAt
		if record.Kind == database.GroundItemDrop {
			birth = record.AvailableAt
		}
		loot = &Entity{ID: record.LootID, Type: TypeLoot, X: record.X, Y: .5, Z: record.Z,
			InstanceID: record.InstanceID, CreatedAt: birth, LootTime: record.AvailableAt,
			LootOwnerID: record.LootOwnerID, LootPartyID: record.LootPartyID, GroundItemOrigin: record.ID}
		w.groundLootLocked(loot)
		w.Entities[record.LootID] = loot
		w.Grid.Add(loot)
	}
	loot.LootItem, loot.GroundItemGeneration = &item, generation
	loot.GroundItemReservation, loot.GroundReservationHash, loot.GroundCompletionHash = "", "", ""
	if record.State == database.GroundItemPending {
		loot.GroundItemReservation, loot.GroundReservationHash = record.ID, record.Fingerprint
	} else {
		loot.GroundCompletionHash = record.Fingerprint
	}
	return nil
}

// Only a definitive first prepare rejection permits releasing this RAM claim.
// An ambiguous/previously submitted prepare must keep its original reservation
// and reconcile the same ID, even if a later read happens to find no row.
func (w *World) ReleaseRejectedGroundItemReservation(op database.GroundItemOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	if op.Kind != database.GroundItemPickup {
		return nil
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	loot := w.Entities[op.LootID]
	if loot == nil {
		return nil
	}
	loot.Mu.Lock()
	defer loot.Mu.Unlock()
	if loot.GroundItemReservation != op.ID || loot.GroundReservationHash != op.Fingerprint || loot.GroundItemGeneration != op.Generation-1 {
		return errors.New("cannot release another ground item reservation")
	}
	loot.GroundItemReservation, loot.GroundReservationHash = "", ""
	return nil
}
