package game

import (
	"reflect"
	"time"

	"eidolon-server/internal/database"
)

// The latest pickup must descend from this exact original boss roll, not just
// share a loot ID. Quantities may decrease; affixes, owner, position and the
// original birth/availability/expiry may not change.
func BossVictoryDropCustodyMatches(op database.BossVictoryOperation, index int, record database.GroundItemRecord) bool {
	if op.Validate() != nil || index < 0 || index >= len(op.Drops) || record.Validate() != nil || record.Kind != database.GroundItemPickup {
		return false
	}
	drop := op.Drops[index]
	if record.LootID != drop.LootID || record.InstanceID != op.InstanceID || record.X != drop.X || record.Z != drop.Z || record.LootOwnerID != "" || record.LootPartyID != drop.PartyID ||
		!record.LootCreatedAt.Equal(drop.AvailableAt) || !record.AvailableAt.Equal(drop.AvailableAt) || !record.ExpiresAt.Equal(drop.ExpiresAt) {
		return false
	}
	original, err := decodeGroundItem(drop.Item)
	if err != nil {
		return false
	}
	before, err := decodeGroundItem(record.BeforePayload)
	if err != nil {
		return false
	}
	original, before = normalizedGroundItem(original), normalizedGroundItem(before)
	if before.Stack > original.Stack {
		return false
	}
	original.Stack, before.Stack = 0, 0
	return reflect.DeepEqual(original, before)
}

// Called only AFTER a strong first-victory read and latest pickup-ledger read
// returned no record. A concurrent local pickup/consumption still wins through
// the existing projection generation fence and reservation. No remote IO here.
func (w *World) RestoreOriginalBossDrop(op database.BossVictoryOperation, index int) error {
	if err := op.Validate(); err != nil {
		return err
	}
	if index < 0 || index >= len(op.Drops) {
		return ErrBossVictoryEffectConflict
	}
	drop := op.Drops[index]
	if !drop.ExpiresAt.Equal(drop.AvailableAt.Add(time.Minute)) {
		return ErrBossVictoryEffectConflict // Match the existing ground-lifetime contract.
	}
	if !time.Now().Before(drop.ExpiresAt) {
		return nil // Expiry is not a fresh publication time.
	}
	item, err := decodeGroundItem(drop.Item)
	if err != nil {
		return err // Keep unknown original metadata in its shared record.
	}
	item = normalizedGroundItem(item)
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if previous, found := w.groundItemPublished[drop.LootID]; found {
		if previous.Generation > 0 {
			return nil // A pickup won after the coordinator's earlier read.
		}
		if previous.OperationID != op.ID || !previous.ExpiresAt.Equal(drop.ExpiresAt) {
			return ErrBossVictoryEffectConflict
		}
	}
	if loot := w.Entities[drop.LootID]; loot != nil {
		loot.Mu.RLock()
		defer loot.Mu.RUnlock()
		if loot.Type != TypeLoot || loot.LootItem == nil || loot.InstanceID != op.InstanceID || loot.X != drop.X || loot.Y != drop.Y || loot.Z != drop.Z ||
			loot.LootOwnerID != "" || loot.LootPartyID != drop.PartyID || !loot.CreatedAt.Equal(drop.AvailableAt) || !loot.LootTime.Equal(drop.AvailableAt) {
			return ErrBossVictoryEffectConflict
		}
		if loot.GroundItemGeneration > 0 {
			return nil
		}
		if !reflect.DeepEqual(normalizedGroundItem(*loot.LootItem), item) || loot.GroundItemOrigin != op.ID {
			return ErrBossVictoryEffectConflict
		}
		return nil // Preserve any in-flight pickup reservation, never clear it.
	}
	if err := w.ensureGroundProjectionCapacityLocked(drop.LootID); err != nil {
		return err
	}
	w.groundItemPublished[drop.LootID] = groundItemPublication{OperationID: op.ID, ExpiresAt: drop.ExpiresAt}
	loot := &Entity{ID: drop.LootID, Type: TypeLoot, InstanceID: op.InstanceID, X: drop.X, Y: drop.Y, Z: drop.Z,
		LootItem: &item, CreatedAt: drop.AvailableAt, LootTime: drop.AvailableAt, LootPartyID: drop.PartyID, GroundItemOrigin: op.ID}
	w.Entities[loot.ID] = loot
	w.Grid.Add(loot)
	return nil
}
