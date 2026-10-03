package main

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type groundItemOperationStore interface {
	directTradeCharacterStore
	GetGroundItemOperation(string) (*database.GroundItemRecord, error)
	LatestGroundItemOperation(string) (*database.GroundItemRecord, error)
	PrepareGroundItemOperation(database.GroundItemOperation) (*database.GroundItemRecord, error)
	CompleteGroundItemOperation(string, string) (*database.GroundItemRecord, error)
	PendingGroundItemOperations(string, string, int) ([]database.GroundItemRecord, error)
	GroundItemProjectionPage(string, time.Time, int) ([]database.GroundItemRecord, error)
}

var groundItemOperations groundItemOperationStore

type pendingGroundItem struct {
	op        database.GroundItemOperation
	known     bool
	uncertain bool
}

// The actor's work lock serializes effects. Register the immutable proposal
// before storage IO so an unknown prepare cannot generate a fresh request ID.
var groundItemPending = struct {
	sync.RWMutex
	accounts map[string]pendingGroundItem
}{accounts: map[string]pendingGroundItem{}}

func pendingGroundItemForAccount(username string) (pendingGroundItem, bool) {
	groundItemPending.RLock()
	defer groundItemPending.RUnlock()
	entry, found := groundItemPending.accounts[username]
	return entry, found
}

func trackGroundItemLocked(op database.GroundItemOperation, known bool) error {
	if err := op.Validate(); err != nil {
		return err
	}
	groundItemPending.Lock()
	defer groundItemPending.Unlock()
	entry, found := groundItemPending.accounts[op.Username]
	if found && (entry.op.ID != op.ID || entry.op.Fingerprint != op.Fingerprint) {
		return database.ErrGroundItemBusy
	}
	entry.op, entry.known = op, entry.known || known
	groundItemPending.accounts[op.Username] = entry
	return nil
}

func forgetGroundItemLocked(op database.GroundItemOperation) {
	groundItemPending.Lock()
	defer groundItemPending.Unlock()
	if entry, found := groundItemPending.accounts[op.Username]; found && entry.op.ID == op.ID && entry.op.Fingerprint == op.Fingerprint {
		delete(groundItemPending.accounts, op.Username)
	}
}

// Caller owns the actor account work lock. Never hold a world/entity lock
// through journal or Mongo IO. A failed/unknown save is not an undo/refund.
func prepareAndCompleteGroundItemLocked(captured database.GroundItemOperation) (*database.GroundItemRecord, error) {
	if groundItemOperations == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return nil, errors.New("ground item persistence unavailable")
	}
	if err := trackGroundItemLocked(captured, false); err != nil {
		return nil, err
	}
	if err := reconcilePendingCharacterSaveLocked(captured.Username); err != nil {
		return nil, err
	}
	entry, _ := pendingGroundItemForAccount(captured.Username)
	record, err := groundItemOperations.GetGroundItemOperation(captured.ID)
	if err != nil {
		return nil, err
	}
	if record == nil {
		if entry.known {
			return nil, database.ErrGroundItemConflict // Never recreate a lost confirmed record.
		}
		record, err = groundItemOperations.PrepareGroundItemOperation(captured)
		if err != nil {
			definite := errors.Is(err, database.ErrGroundItemBusy) || errors.Is(err, database.ErrGroundItemConflict)
			if definite && !entry.uncertain {
				if world != nil {
					if releaseErr := world.ReleaseRejectedGroundItemReservation(captured); releaseErr != nil {
						return nil, releaseErr
					}
				}
				forgetGroundItemLocked(captured)
			} else {
				groundItemPending.Lock()
				entry.uncertain = true
				groundItemPending.accounts[captured.Username] = entry
				groundItemPending.Unlock()
			}
			return nil, err
		}
	}
	if record == nil || record.Validate() != nil || record.ID != captured.ID || record.Fingerprint != captured.Fingerprint {
		return nil, database.ErrGroundItemConflict
	}
	if err := trackGroundItemLocked(record.GroundItemOperation, true); err != nil {
		return nil, err
	}
	if record.State == database.GroundItemPending {
		if world != nil {
			if err := world.RestoreGroundItemProjection(*record, nil); err != nil {
				return nil, err
			}
		}
		if err := applyAndSaveGroundItemCharacterLocked(record.GroundItemOperation); err != nil {
			return nil, err
		}
		record, err = groundItemOperations.CompleteGroundItemOperation(record.ID, record.Fingerprint)
		if err != nil {
			return nil, err // Same-ID lookup resolves a lost terminal acknowledgement.
		}
		if record == nil || record.Validate() != nil || record.State != database.GroundItemComplete || record.ID != captured.ID || record.Fingerprint != captured.Fingerprint {
			return nil, database.ErrGroundItemConflict
		}
	}
	// Even after completion, restore ONLY the latest loot generation. Replaying
	// an old confirmed drop must not recreate quantities another player took.
	latest, err := groundItemOperations.LatestGroundItemOperation(record.LootID)
	if err != nil {
		return nil, err
	}
	if latest == nil || latest.Validate() != nil || latest.Generation < record.Generation ||
		(latest.Generation == record.Generation && (latest.ID != record.ID || latest.Fingerprint != record.Fingerprint || latest.State != database.GroundItemComplete)) {
		return nil, database.ErrGroundItemConflict
	}
	if err := restoreGroundItemRecord(*latest); err != nil {
		return nil, err
	}
	forgetGroundItemLocked(record.GroundItemOperation)
	return record, nil
}

func restoreGroundItemRecord(record database.GroundItemRecord) error {
	if groundItemOperations == nil || record.Validate() != nil {
		return database.ErrGroundItemConflict
	}
	var saved *database.Character
	if record.State == database.GroundItemComplete {
		var err error
		saved, err = groundItemOperations.GetDirectTradeCharacter(record.Username, record.Username)
		if err != nil {
			return err
		}
		if !database.GroundItemCharacterReceiptMatches(saved, record.GroundItemOperation) {
			return database.ErrGroundItemConflict
		}
	}
	if world != nil {
		return world.RestoreGroundItemProjection(record, saved)
	}
	return nil
}

func applyAndSaveGroundItemCharacterLocked(op database.GroundItemOperation) error {
	if err := reconcilePendingCharacterSaveLocked(op.Username); err != nil {
		return err
	}
	if world != nil {
		if entity := world.GetEntityCopy(op.PlayerID); entity != nil {
			if _, err := world.ApplyDurableGroundItem(op); err != nil {
				return err
			}
			entity = world.GetEntityCopy(op.PlayerID)
			if entity == nil || entity.Type != game.TypePlayer || entity.Name != op.Username {
				return database.ErrGroundItemConflict
			}
			return persistCharacterSnapshot(op.Username, characterSnapshotForSave(op.Username, entity))
		}
	}
	character, err := groundItemOperations.GetDirectTradeCharacter(op.Username, op.Username)
	if err != nil {
		return err
	}
	if character == nil || character.Name != op.Username {
		return database.ErrGroundItemConflict
	}
	entity := &game.Entity{ID: op.PlayerID, Name: op.Username, Type: game.TypePlayer,
		ItemDeliveryReceipts: cloneItemDeliveryReceipts(character.ItemDeliveryReceipts), Equipment: map[string]game.Item{}}
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Stash {
		entity.Stash = append(entity.Stash, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Buyback {
		entity.Buyback = append(entity.Buyback, gameItemFromDatabaseExact(item))
	}
	for slot, item := range character.Equipment {
		entity.Equipment[slot] = gameItemFromDatabaseExact(item)
	}
	changed, err := entity.ApplyGroundItemCharacterEffect(op)
	if err != nil || !changed {
		return err // Actual stored receipt replay, not item-presence inference.
	}
	character.Inventory = databaseItems(entity.Inventory, true)
	character.ItemDeliveryReceipts = cloneItemDeliveryReceipts(entity.ItemDeliveryReceipts)
	if op.Kind == database.GroundItemPickup {
		var moved game.Item
		if err := json.Unmarshal([]byte(op.MovedPayload), &moved); err != nil {
			return err // Effect above already strictly decoded every item field.
		}
		for index := range character.Quests {
			quest := &character.Quests[index]
			if quest.Accepted && !quest.Completed && quest.Type == "COLLECT" && quest.Target == moved.Name {
				quest.Count += min(moved.Stack, max(0, quest.MaxCount-quest.Count))
			}
		}
	}
	// Mutate only owned bag, retained receipt and matching collection counts.
	// Preserve all unrelated saved resources, equipment, quests and currencies.
	return persistCharacterSnapshot(op.Username, character)
}
