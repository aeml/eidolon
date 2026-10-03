package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func bossDropDeliveryFixture(t *testing.T) (*bossVictoryRecoveryStore, *groundRecoveryStore, []*game.Entity, database.BossVictoryOperation) {
	t.Helper()
	store, _, players, op, _ := bossVictoryDeliveryFixture(t)
	oldGround, oldPending, oldAfter := groundItemOperations, groundItemPending.accounts, bossDropRecovery.after
	t.Cleanup(func() {
		groundItemOperations, groundItemPending.accounts, bossDropRecovery.after = oldGround, oldPending, oldAfter
	})
	ground := &groundRecoveryStore{tradeRecoveryStore: store.tradeRecoveryStore, groundRecords: map[string]database.GroundItemRecord{}}
	groundItemOperations = ground
	groundItemPending.accounts = map[string]pendingGroundItem{}
	bossDropRecovery.after = ""
	return store, ground, players, op
}

func TestBossVictoryDropsCompletedVictoryRestoresOriginalThenNeverConsumedLoot(t *testing.T) {
	store, _, players, op := bossDropDeliveryFixture(t)
	if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CompleteBossVictory(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	if err := recoverBossDropsOnStartup(); err != nil {
		t.Fatal(err)
	}
	drop := op.Drops[0]
	loot := world.GetEntityCopy(drop.LootID)
	if loot == nil || !loot.LootTime.Equal(op.CreatedAt) || loot.LootItem.Potency != 7 || loot.LootItem.Stats["damage"] != 73 {
		t.Fatal("terminal victory lost its original public drop or renewed its birth")
	}
	player := players[0]
	player.X, player.Z = drop.X, drop.Z
	pickup, err := world.PrepareDurableGroundPickup(player.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := prepareAndCompleteGroundItemLocked(pickup); err != nil {
		t.Fatal("original boss loot did not use ordinary durable pickup", err)
	}
	if err := restoreBossVictoryDrops(op); err != nil || world.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("completed victory restored a fully consumed drop", err)
	}
	world = game.NewWorld(nil) // Fresh scene; shared victory/pickup store remains.
	t.Cleanup(world.StopBackground)
	if err := recoverBossDropsOnStartup(); err != nil || world.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("fresh scene resurrected consumed loot from a terminal victory", err)
	}
}

func TestBossVictoryDropsPartialPickupRestoresOnlyRemainingOriginalQuantity(t *testing.T) {
	store, _, players, op := bossDropDeliveryFixture(t)
	item := game.Item{ID: "public-original", Name: "Fragments", Type: game.ItemMaterial, Stack: 5, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
	payload, _ := json.Marshal(item)
	op.Drops[0].Item = string(payload)
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	player := players[0]
	for i := range player.Inventory {
		player.Inventory[i] = game.Item{ID: fmt.Sprintf("occupied-%d", i), Stack: 1, MaxStack: 1}
	}
	player.Inventory[0] = item
	player.Inventory[0].ID, player.Inventory[0].Stack = "existing-fragments", 8
	if _, err := prepareAndDeliverBossVictoryCharacters(op, true); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CompleteBossVictory(op.ID, op.Fingerprint); err != nil {
		t.Fatal(err)
	}
	if err := restoreBossVictoryDrops(op); err != nil {
		t.Fatal(err)
	}
	player.X, player.Z = op.Drops[0].X, op.Drops[0].Z
	pickup, err := world.PrepareDurableGroundPickup(player.ID, op.Drops[0].LootID)
	if err != nil || pickup.RemainingPayload == "" {
		t.Fatal("ordinary partial boss pickup missing", err)
	}
	if _, err := prepareAndCompleteGroundItemLocked(pickup); err != nil {
		t.Fatal(err)
	}
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	if err := recoverBossDropsOnStartup(); err != nil {
		t.Fatal(err)
	}
	restored := world.GetEntityCopy(op.Drops[0].LootID)
	if restored == nil || restored.LootItem.Stack != 3 || restored.GroundItemGeneration != 1 || !restored.LootTime.Equal(op.CreatedAt) {
		t.Fatal("restart refilled a partial original drop or extended lifetime")
	}
	world.AddEntity(player)
	player.Inventory[1] = game.Item{}
	second, err := world.PrepareDurableGroundPickup(player.ID, op.Drops[0].LootID)
	if err != nil || second.Generation != 2 {
		t.Fatal("remaining original loot cannot use its next ordinary generation", err)
	}
	if _, err := prepareAndCompleteGroundItemLocked(second); err != nil {
		t.Fatal(err)
	}
	if err := restoreBossVictoryDrops(op); err != nil || world.GetEntityCopy(op.Drops[0].LootID) != nil {
		t.Fatal("older first victory refilled a later consumed generation", err)
	}
}

func TestBossVictoryDropsExpiredOriginalAndWrongFirstOutcomeDoNotPublish(t *testing.T) {
	store, _, _, op := bossDropDeliveryFixture(t)
	op.CreatedAt = op.CreatedAt.Add(-2 * time.Minute)
	op.Drops[0].AvailableAt, op.Drops[0].ExpiresAt = op.CreatedAt, op.CreatedAt.Add(time.Minute)
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	if _, err := store.PrepareBossVictory(op); err != nil {
		t.Fatal(err)
	}
	if err := restoreBossVictoryDrops(op); err != nil || world.GetEntityCopy(op.Drops[0].LootID) != nil {
		t.Fatal("expired original loot gained another minute on restart", err)
	}
	if page, err := store.ActiveBossVictoryDropPage("", time.Now(), 50); err != nil || len(page) != 0 {
		t.Fatal("expired original entered the active projection scan", err)
	}
	changed := *cloneBossVictoryRecord(database.BossVictoryRecord{BossVictoryOperation: op, State: database.BossVictoryPending})
	changed.Drops[0].X++
	changed.Fingerprint, _ = database.BossVictoryFingerprint(changed.BossVictoryOperation)
	if err := restoreBossVictoryDrops(changed.BossVictoryOperation); err == nil {
		t.Fatal("unconfirmed changed original outcome was accepted")
	}
}

type bossDropReadFailureStore struct {
	*groundRecoveryStore
	failing map[string]bool
}

func (store bossDropReadFailureStore) LatestGroundItemOperation(id string) (*database.GroundItemRecord, error) {
	if store.failing[id] {
		return nil, errors.New("modeled latest pickup read unavailable")
	}
	return store.groundRecoveryStore.LatestGroundItemOperation(id)
}

func TestBossVictoryDropsBoundedRotationDoesNotStarveLaterCompletedVictories(t *testing.T) {
	store, ground, _, original := bossDropDeliveryFixture(t)
	var ids []string
	for index := range 23 {
		op := *cloneBossVictoryRecord(database.BossVictoryRecord{BossVictoryOperation: original, State: database.BossVictoryComplete})
		op.InstanceID = fmt.Sprintf("dungeon_boss_projection_%02d", index)
		op.BossID = op.BossType + "-" + op.InstanceID
		op.ID = database.BossVictoryID(op.InstanceID, op.BossID)
		op.Drops[0].LootID = "loot-boss-" + strings.TrimPrefix(op.ID, "bossvictory:") + "-0"
		op.Fingerprint, _ = database.BossVictoryFingerprint(op.BossVictoryOperation)
		store.victories[op.ID] = op
		ids = append(ids, op.ID)
	}
	slices.Sort(ids)
	failing := map[string]bool{}
	for _, id := range ids[:10] {
		failing[store.victories[id].Drops[0].LootID] = true
	}
	groundItemOperations = bossDropReadFailureStore{ground, failing}
	if err := recoverAvailableBossDrops(); err == nil {
		t.Fatal("first read failure was silently treated as no pickup record")
	}
	for range 2 {
		if err := recoverAvailableBossDrops(); err != nil {
			t.Fatal("earlier failures starved the later rotating pages", err)
		}
	}
	for index, id := range ids {
		loot := world.GetEntityCopy(store.victories[id].Drops[0].LootID)
		if (index < 10 && loot != nil) || (index >= 10 && loot == nil) {
			t.Fatal("bounded pass fabricated unknown loot or missed a later victory")
		}
	}
}
