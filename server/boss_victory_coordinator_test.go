package main

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func bossCoordinatorFinalFixture(t *testing.T) (*bossVictoryRecoveryStore, []*game.Entity, database.BossVictoryOperation, string) {
	t.Helper()
	store, _, players, op := bossDropDeliveryFixture(t)
	oldJournal, oldSync := guildClearJournal, guildClearSync
	oldCache, oldStore := bossVictoryRecovery.cacheAfter, bossVictoryRecovery.storeAfter
	t.Cleanup(func() {
		guildClearJournal, guildClearSync = oldJournal, oldSync
		bossVictoryRecovery.cacheAfter, bossVictoryRecovery.storeAfter = oldCache, oldStore
	})
	guildClearJournal = nil
	// Exercise the actual outbox without spawning its separately tested
	// asynchronous Mongo consumer against this modeled character store.
	guildClearSync = &guildClearSyncWork{running: true}
	bossVictoryRecovery.cacheAfter, bossVictoryRecovery.storeAfter = "", ""
	op.BossType = "HollowSentinel"
	op.BossID = op.BossType + "-" + op.InstanceID
	op.ID = database.BossVictoryID(op.InstanceID, op.BossID)
	op.Drops[0].LootID = "loot-boss-" + strings.TrimPrefix(op.ID, "bossvictory:") + "-0"
	op.DungeonClear = &database.BossVictoryDungeonClear{DurationMS: 120000, GuildRuns: []database.GuildDungeonRun{{
		GuildID: "original-guild", GuildName: "Original Watch", GuildTag: "OLD", MemberCount: 2,
		DungeonType: op.DungeonType, Difficulty: op.Difficulty, RunLevel: op.RunLevel, DurationMS: 120000,
		FirstClearAt: op.CreatedAt, Season: database.CurrentGuildDungeonSeason(op.CreatedAt)}}}
	for i, player := range players {
		player.Quests[0].Target, store.characters[player.Name].Quests[0].Target = op.BossType, op.BossType
		op.Participants[i].Quests[0].Target = op.BossType
	}
	op.Fingerprint, _ = database.BossVictoryFingerprint(op)
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	return store, players, op, t.TempDir()
}

func TestBossVictoryCoordinatorGuildOutboxFailureRetainsOriginalFinale(t *testing.T) {
	store, players, op, dir := bossCoordinatorFinalFixture(t)
	if err := prepareAndDeliverBossVictory(op); err == nil || store.completeCalls != 0 || store.victories[op.ID].State != database.BossVictoryPending {
		t.Fatal("missing guild outbox falsely terminalized the finale")
	}
	if world.GetEntityCopy(op.Drops[0].LootID) == nil {
		t.Fatal("independent public projection was starved by failed guild handoff")
	}
	for _, player := range players {
		if store.characters[player.Name].Gold != 172 || store.characters[player.Name].Quests[0].Count != 3 {
			t.Fatal("failed guild handoff undid or repeated private credits")
		}
		player.GuildID, player.GuildName = "later-guild", "Later Watch"
	}
	journal, err := database.OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	guildClearJournal = journal
	if err := recoverPendingBossVictories(); err != nil || store.victories[op.ID].State != database.BossVictoryComplete || len(world.PendingBossVictoryPlans()) != 0 {
		t.Fatal("bounded recovery did not complete the original finale", err)
	}
	reopened, err := database.OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	receipts, err := reopened.Pending(10)
	if err != nil || len(receipts) != 1 || receipts[0].InstanceID != op.InstanceID || !reflect.DeepEqual(receipts[0].Runs, op.DungeonClear.GuildRuns) {
		t.Fatal("reopened outbox lost the original immutable guild finale", err)
	}
	for _, player := range players {
		if store.characters[player.Name].Gold != 172 || store.characters[player.Name].Quests[0].Count != 3 {
			t.Fatal("recovered finale repeated private credits")
		}
	}
	if err := reopened.Acknowledge(op.InstanceID); err != nil {
		t.Fatal(err)
	}
	guildClearJournal = reopened
	if err := prepareAndDeliverBossVictory(op); err != nil {
		t.Fatal(err)
	}
	if receipts, err := reopened.Pending(10); err != nil || len(receipts) != 0 {
		t.Fatal("terminal replay recreated an already delivered guild receipt", err)
	}
}

func TestBossVictoryCoordinatorFailedMemberKeepsCohortPendingWhileOthersProgress(t *testing.T) {
	store, players, op, dir := bossCoordinatorFinalFixture(t)
	journal, err := database.OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	guildClearJournal = journal
	store.failSaveAccount = players[0].Name
	if err := prepareAndDeliverBossVictory(op); err == nil || store.completeCalls != 0 {
		t.Fatal("unconfirmed private character receipt allowed completion")
	}
	for _, player := range players[1:] {
		if store.characters[player.Name].Gold != 172 {
			t.Fatal("one failing account starved another member")
		}
	}
	if world.GetEntityCopy(op.Drops[0].LootID) == nil {
		t.Fatal("failed account starved the original public spawn")
	}
	if receipts, err := journal.Pending(10); err != nil || len(receipts) != 1 {
		t.Fatal("failed member lost original guild entitlement", err)
	}
	if err := recoverPendingBossVictories(); err != nil || store.victories[op.ID].State != database.BossVictoryComplete {
		t.Fatal("original cohort did not finish after save recovery", err)
	}
}

type bossCompletionFailureStore struct {
	*bossVictoryRecoveryStore
	after, fail bool
}

func (store *bossCompletionFailureStore) CompleteBossVictory(id, fingerprint string) (*database.BossVictoryRecord, error) {
	if store.fail && !store.after {
		store.fail = false
		return nil, errors.New("completion acknowledgement unavailable")
	}
	record, err := store.bossVictoryRecoveryStore.CompleteBossVictory(id, fingerprint)
	if store.fail && err == nil {
		store.fail = false
		return nil, errors.New("completion saved, acknowledgement unavailable")
	}
	return record, err
}

func TestBossVictoryCoordinatorUnknownCompletionReplaysWithoutNewRewards(t *testing.T) {
	for _, after := range []bool{false, true} {
		t.Run(map[bool]string{false: "before", true: "after"}[after], func(t *testing.T) {
			store, _, players, op := bossDropDeliveryFixture(t)
			bossVictories = &bossCompletionFailureStore{bossVictoryRecoveryStore: store, after: after, fail: true}
			if err := prepareAndDeliverBossVictory(op); err == nil || len(world.PendingBossVictoryPlans()) != 1 {
				t.Fatal("unknown completion discarded recovery state")
			}
			if err := prepareAndDeliverBossVictory(op); err != nil || store.victories[op.ID].State != database.BossVictoryComplete || len(world.PendingBossVictoryPlans()) != 0 {
				t.Fatal("unknown completion did not resolve the first stored outcome", err)
			}
			for _, player := range players {
				if store.characters[player.Name].Gold != 172 || store.characters[player.Name].Quests[0].Count != 3 {
					t.Fatal("completion replay repeated original rewards")
				}
			}
			loot := world.GetEntityCopy(op.Drops[0].LootID)
			if loot == nil || !loot.LootTime.Equal(op.CreatedAt) {
				t.Fatal("completion replay renewed original loot")
			}
		})
	}
}

func TestBossVictoryCoordinatorStartupRecoversAbsentSceneFromOriginalSavedOwners(t *testing.T) {
	store, players, op, dir := bossCoordinatorFinalFixture(t)
	journal, err := database.OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	guildClearJournal = journal
	if _, err := store.PrepareBossVictory(op); err != nil {
		t.Fatal(err)
	}
	world.StopBackground()
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	for _, player := range players {
		saved := store.characters[player.Name]
		at := time.Now().Add(-time.Hour).UTC().Truncate(time.Millisecond)
		saved.LastLogout = at
	}
	if err := recoverBossVictoriesOnStartup(); err != nil || store.victories[op.ID].State != database.BossVictoryComplete {
		t.Fatal("startup lost original claims from an absent run", err)
	}
	for _, player := range players {
		saved := store.characters[player.Name]
		if saved.Gold != 172 || saved.Quests[0].Count != 3 || saved.LastLogout.IsZero() || time.Since(saved.LastLogout) < 59*time.Minute ||
			!database.BossVictoryCharacterReceiptMatches(saved, op) || !saved.DungeonProgress.Rooms[op.RoomIndex].Cleared {
			t.Fatal("startup changed run age or lost a saved original member's checkpoint")
		}
	}
	if err := recoverBossVictoriesOnStartup(); err != nil {
		t.Fatal("empty pending startup was not idempotent", err)
	}
}
