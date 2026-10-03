package main

import (
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Models the shared immutable store and atomic character save contract. These
// coordinator tests use a real BSON filesystem journal, not a real Mongo server
// or a connected production process. Actual storage checks live in database.
type groundRecoveryStore struct {
	*tradeRecoveryStore
	groundRecords map[string]database.GroundItemRecord
	prepareError  string
	completeError bool
}

func (store *groundRecoveryStore) GetGroundItemOperation(id string) (*database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if record, found := store.groundRecords[id]; found {
		return &record, nil
	}
	return nil, nil
}

func (store *groundRecoveryStore) LatestGroundItemOperation(id string) (*database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.latestGroundLocked(id), nil
}

func (store *groundRecoveryStore) latestGroundLocked(id string) *database.GroundItemRecord {
	var latest *database.GroundItemRecord
	for _, record := range store.groundRecords {
		if record.LootID == id && (latest == nil || record.Generation > latest.Generation) {
			copy := record
			latest = &copy
		}
	}
	return latest
}

func (store *groundRecoveryStore) PrepareGroundItemOperation(op database.GroundItemOperation) (*database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	mode := store.prepareError
	store.prepareError = ""
	if mode == "before" {
		return nil, errors.New("prepare result unknown, no modeled commit")
	}
	if mode == "busy" {
		return nil, database.ErrGroundItemBusy
	}
	if previous, found := store.groundRecords[op.ID]; found {
		if previous.Fingerprint != op.Fingerprint {
			return nil, database.ErrGroundItemConflict
		}
		return &previous, nil
	}
	for _, previous := range store.groundRecords {
		if previous.State == database.GroundItemPending && (previous.Username == op.Username || previous.LootID == op.LootID) {
			return nil, database.ErrGroundItemBusy
		}
	}
	record := database.GroundItemRecord{GroundItemOperation: op, State: database.GroundItemPending}
	previous := store.latestGroundLocked(op.LootID)
	if op.Kind == database.GroundItemPickup {
		record.AvailableAt, record.ExpiresAt = op.LootTime, op.LootTime.Add(time.Minute)
		if previous != nil {
			if previous.Generation+1 != op.Generation || previous.GroundPayload() != op.BeforePayload {
				return nil, database.ErrGroundItemConflict
			}
			record.AvailableAt, record.ExpiresAt = previous.AvailableAt, previous.ExpiresAt
		}
	}
	if err := record.Validate(); err != nil {
		return nil, err
	}
	store.groundRecords[op.ID] = record
	if mode == "after" {
		return nil, errors.New("prepare committed, acknowledgement lost")
	}
	return &record, nil
}

func (store *groundRecoveryStore) CompleteGroundItemOperation(id, fingerprint string) (*database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	record, found := store.groundRecords[id]
	if !found || record.Fingerprint != fingerprint || !database.GroundItemCharacterReceiptMatches(store.characters[record.Username], record.GroundItemOperation) {
		return nil, database.ErrGroundItemConflict
	}
	if record.State == database.GroundItemPending {
		if record.Kind == database.GroundItemDrop {
			record.AvailableAt = time.Now().UTC().Truncate(time.Millisecond)
			record.ExpiresAt = record.AvailableAt.Add(time.Minute)
		}
		record.State = database.GroundItemComplete
		store.groundRecords[id] = record
	}
	if store.completeError {
		store.completeError = false
		return nil, errors.New("terminal commit applied, acknowledgement lost")
	}
	return &record, nil
}

func (store *groundRecoveryStore) PendingGroundItemOperations(username, after string, limit int) ([]database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	var records []database.GroundItemRecord
	for _, record := range store.groundRecords {
		if record.State == database.GroundItemPending && (username == "" || record.Username == username) && record.ID > after {
			records = append(records, record)
		}
	}
	slices.SortFunc(records, func(a, b database.GroundItemRecord) int { return strings.Compare(a.ID, b.ID) })
	return records[:min(len(records), limit)], nil
}

func (store *groundRecoveryStore) GroundItemProjectionPage(after string, now time.Time, limit int) ([]database.GroundItemRecord, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	latest := map[string]database.GroundItemRecord{}
	for _, record := range store.groundRecords {
		if record.ExpiresAt.After(now) && record.LootID > after && (latest[record.LootID].ID == "" || latest[record.LootID].Generation < record.Generation) {
			latest[record.LootID] = record
		}
	}
	var records []database.GroundItemRecord
	for _, record := range latest {
		records = append(records, record)
	}
	slices.SortFunc(records, func(a, b database.GroundItemRecord) int { return strings.Compare(a.LootID, b.LootID) })
	return records[:min(len(records), limit)], nil
}

func groundCoordinatorFixture(t *testing.T) (*groundRecoveryStore, database.GroundItemOperation, string, *game.Entity, *game.Entity) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	previous, previousPending := groundItemOperations, groundItemPending.accounts
	t.Cleanup(func() { groundItemOperations, groundItemPending.accounts = previous, previousPending })
	groundItemPending.accounts = map[string]pendingGroundItem{}
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	a, b := newLevelCommandPlayer("player-ground-alice"), newLevelCommandPlayer("player-ground-bob")
	a.Name, b.Name = "ground-alice", "ground-bob"
	a.InstanceID, b.InstanceID = "dungeon_ground_fixture", "dungeon_ground_fixture"
	a.X, a.Z, b.X, b.Z = 50000, 20000, 50001, 20000
	a.Inventory = []game.Item{{ID: "earned-blade", Name: "Earned blade", Stack: 1, Potency: 5, Stats: map[string]int{"damage": 23}}}
	b.Inventory = make([]game.Item, game.MaxInventorySize)
	b.Quests = []game.Quest{{ID: "collect", Type: "COLLECT", Target: "Earned blade", Accepted: true, MaxCount: 3}}
	world.AddEntity(a)
	world.AddEntity(b)
	store := &groundRecoveryStore{tradeRecoveryStore: &tradeRecoveryStore{
		characters: map[string]*database.Character{}, writes: map[string]int{}}, groundRecords: map[string]database.GroundItemRecord{}}
	for _, player := range []*game.Entity{a, b} {
		store.characters[player.Name] = cloneTradeRecoveryCharacter(characterSnapshotForSave(player.Name, world.GetEntityCopy(player.ID)))
	}
	groundItemOperations, characterSaveCommitter = store, store
	drop, err := world.PrepareDurableInventoryDrop(a.ID, 0, "earned-blade", 1)
	if err != nil {
		t.Fatal(err)
	}
	return store, drop, dir, a, b
}

func runGroundCoordinator(op database.GroundItemOperation) (*database.GroundItemRecord, error) {
	unlock := lockCharacterWork(op.Username)
	defer unlock()
	return prepareAndCompleteGroundItemLocked(op)
}

func TestGroundItemCoordinatorUnknownPrepareSaveAndTerminalAcknowledgements(t *testing.T) {
	for _, failure := range []string{"prepare-before", "prepare-after", "save-before", "save-after", "terminal"} {
		t.Run(failure, func(t *testing.T) {
			store, op, dir, source, _ := groundCoordinatorFixture(t)
			switch failure {
			case "prepare-before":
				store.prepareError = "before"
			case "prepare-after":
				store.prepareError = "after"
			case "save-before", "save-after":
				store.failSaveAccount, store.failSaveAfter = source.Name, failure == "save-after"
			case "terminal":
				store.completeError = true
			}
			if _, err := runGroundCoordinator(op); err == nil || world.GetEntityCopy(op.LootID) != nil {
				t.Fatal("unconfirmed operation was acknowledged or published", err)
			}
			entry, found := pendingGroundItemForAccount(op.Username)
			if !found || entry.op.ID != op.ID || entry.op.Fingerprint != op.Fingerprint {
				t.Fatal("failed request lost the immutable first plan")
			}
			// Real filesystem reopening; fixture op is still test-owned. Actual
			// startup discovery and connected crash proof remain separate gates.
			var err error
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			completed, err := runGroundCoordinator(op)
			if err != nil || completed == nil || completed.State != database.GroundItemComplete || world.GetEntityCopy(op.LootID) == nil {
				t.Fatal("same-ID recovery failed", completed, err)
			}
			if !database.GroundItemCharacterReceiptMatches(store.characters[source.Name], op) || len(store.characters[source.Name].Inventory) != 0 {
				t.Fatal("complete debit and receipt were not saved")
			}
			if _, found := pendingGroundItemForAccount(op.Username); found {
				t.Fatal("confirmed operation retained its account fence")
			}
			again, err := runGroundCoordinator(op)
			if err != nil || !again.AvailableAt.Equal(completed.AvailableAt) || !again.ExpiresAt.Equal(completed.ExpiresAt) || world.GetEntityCopy(op.LootID).LootItem.Potency != 5 {
				t.Fatal("completed replay renewed lifetime or changed earned metadata", err)
			}
		})
	}
}

func TestGroundItemCoordinatorOfflinePreservesUnrelatedState(t *testing.T) {
	store, op, _, source, _ := groundCoordinatorFixture(t)
	before := store.characters[source.Name]
	before.Resources = &database.CharacterResources{Version: 1, Health: 17, Mana: 0}
	before.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 600}
	before.Equipment = map[string]database.Item{"chest": {ID: "legacy-chest", Stats: map[string]int{"vitality": 625}}}
	before.ItemDeliveryReceipts = map[string]string{"previous": "receipt"}
	before = cloneTradeRecoveryCharacter(before)
	world = nil
	if _, err := runGroundCoordinator(op); err != nil {
		t.Fatal(err)
	}
	after := cloneTradeRecoveryCharacter(store.characters[source.Name])
	if len(after.Inventory) != 0 || !database.GroundItemCharacterReceiptMatches(after, op) {
		t.Fatal("offline source debit lost")
	}
	after.Inventory, after.ItemDeliveryReceipts, after.LastSaveID = before.Inventory, before.ItemDeliveryReceipts, before.LastSaveID
	if !reflect.DeepEqual(before, after) {
		t.Fatal("offline recovery changed unrelated resources, currency, rest or legacy gear")
	}
}

func TestGroundItemCoordinatorOfflinePickupCreditsOnlyMatchingCollectionOnce(t *testing.T) {
	store, drop, _, _, recipient := groundCoordinatorFixture(t)
	if _, err := runGroundCoordinator(drop); err != nil {
		t.Fatal(err)
	}
	pickup, err := world.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.PrepareGroundItemOperation(pickup); err != nil {
		t.Fatal(err)
	}
	character := store.characters[recipient.Name]
	character.Resources = &database.CharacterResources{Version: 1, Health: 17, Mana: 0}
	character.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 600}
	character.Equipment = map[string]database.Item{"chest": {ID: "legacy-chest", Stats: map[string]int{"vitality": 625}}}
	character.ItemDeliveryReceipts = map[string]string{"previous": "receipt"}
	character.Quests = append(character.Quests, database.Quest{ID: "unrelated", Type: "COLLECT", Target: "Other fragments", Accepted: true, Count: 7, MaxCount: 8})
	before := cloneTradeRecoveryCharacter(character)
	world = nil
	if _, err := runGroundCoordinator(pickup); err != nil {
		t.Fatal(err)
	}
	after := cloneTradeRecoveryCharacter(store.characters[recipient.Name])
	if len(after.Inventory) != 1 || after.Inventory[0].ID != "earned-blade" || after.Inventory[0].Potency != 5 ||
		after.Quests[0].Count != 1 || after.Quests[1].Count != 7 || !database.GroundItemCharacterReceiptMatches(after, pickup) {
		t.Fatal("offline pickup lost exact gear, matching collection credit or receipt")
	}
	after.Inventory, after.Quests, after.ItemDeliveryReceipts, after.LastSaveID = before.Inventory, before.Quests, before.ItemDeliveryReceipts, before.LastSaveID
	if !reflect.DeepEqual(before, after) {
		t.Fatal("offline pickup changed unrelated saved state")
	}
	store.characters[recipient.Name].Inventory = nil // Already consumed after receipt.
	if _, err := runGroundCoordinator(pickup); err != nil || len(store.characters[recipient.Name].Inventory) != 0 || store.characters[recipient.Name].Quests[0].Count != 1 {
		t.Fatal("stored receipt replay inferred missing item meant another grant", err)
	}
}

func TestGroundItemCoordinatorFullBagAndConsumedLootReplay(t *testing.T) {
	store, drop, _, _, recipient := groundCoordinatorFixture(t)
	if _, err := runGroundCoordinator(drop); err != nil {
		t.Fatal(err)
	}
	pickup, err := world.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	for index := range recipient.Inventory {
		recipient.Inventory[index] = game.Item{ID: fmt.Sprintf("full-%d", index), Stack: 1}
	}
	if _, err := runGroundCoordinator(pickup); !errors.Is(err, game.ErrGroundItemFull) || recipient.Quests[0].Count != 0 || len(recipient.ItemDeliveryReceipts) != 0 {
		t.Fatal("full bag discarded, credited or partially applied accepted custody", err)
	}
	if world.GetEntityCopy(drop.LootID).GroundItemReservation != pickup.ID {
		t.Fatal("full bag released its accepted ground reservation")
	}
	recipient.Inventory[0] = game.Item{}
	if _, err := runGroundCoordinator(pickup); err != nil || recipient.Quests[0].Count != 1 || recipient.Inventory[0].ID != "earned-blade" {
		t.Fatal("freed bag could not recover once", err)
	}
	recipient.Inventory[0] = game.Item{} // Consumed after its saved receipt.
	unlock := lockCharacterWork(recipient.Name)
	err = persistCharacterSnapshot(recipient.Name, characterSnapshotForSave(recipient.Name, world.GetEntityCopy(recipient.ID)))
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	for _, op := range []database.GroundItemOperation{pickup, drop} {
		if _, err := runGroundCoordinator(op); err != nil || world.GetEntityCopy(drop.LootID) != nil || recipient.Inventory[0].ID != "" || recipient.Quests[0].Count != 1 {
			t.Fatal("old operation re-granted consumed loot or collection credit", err)
		}
	}
	if len(store.characters[recipient.Name].ItemDeliveryReceipts) != 1 {
		t.Fatal("recipient lost its permanent replay receipt")
	}
}

func TestGroundItemCoordinatorDefiniteRejectionNeverClearsAnUnknownFirstClaim(t *testing.T) {
	for _, unknownFirst := range []bool{false, true} {
		t.Run(fmt.Sprintf("unknown-first-%t", unknownFirst), func(t *testing.T) {
			store, drop, _, _, recipient := groundCoordinatorFixture(t)
			if _, err := runGroundCoordinator(drop); err != nil {
				t.Fatal(err)
			}
			pickup, err := world.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
			if err != nil {
				t.Fatal(err)
			}
			if unknownFirst {
				store.prepareError = "before"
				if _, err := runGroundCoordinator(pickup); err == nil {
					t.Fatal("unknown prepare was acknowledged")
				}
			}
			store.prepareError = "busy"
			if _, err := runGroundCoordinator(pickup); !errors.Is(err, database.ErrGroundItemBusy) {
				t.Fatal(err)
			}
			entry, found := pendingGroundItemForAccount(pickup.Username)
			loot := world.GetEntityCopy(drop.LootID)
			if unknownFirst {
				if !found || !entry.uncertain || loot.GroundItemReservation != pickup.ID {
					t.Fatal("later rejection released an ambiguous earlier claim")
				}
				changed := pickup
				changed.ID = database.GroundItemOperationID("different-retry")
				changed.Fingerprint, _ = database.GroundItemFingerprint(changed)
				if _, err := runGroundCoordinator(changed); !errors.Is(err, database.ErrGroundItemBusy) {
					t.Fatal("retry replaced the unknown first intent", err)
				}
				if _, err := runGroundCoordinator(pickup); err != nil || recipient.Quests[0].Count != 1 {
					t.Fatal("same-ID unknown claim could not finish once", err)
				}
			} else if found || loot.GroundItemReservation != "" || len(recipient.ItemDeliveryReceipts) != 0 {
				t.Fatal("definitive first rejection left a claim or applied an effect")
			}
		})
	}
}
