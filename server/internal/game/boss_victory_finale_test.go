package game

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestBossVictoryFinaleFreezesOriginalGuildSeasonAndDuration(t *testing.T) {
	w, inst, players, input := bossVictoryCaptureFixture(t)
	input.bossType = "HollowSentinel"
	input.bossID = input.bossType + "-" + input.instanceID
	input.killedAt = time.Date(2026, 9, 30, 23, 59, 59, 999000000, time.UTC)
	inst.CreatedAt = input.killedAt.Add(-3 * time.Minute)
	for i, player := range players {
		player.GuildID, player.GuildName, player.GuildTag = "guild-a", "Original A", "A"
		if i >= 2 {
			player.GuildID, player.GuildName, player.GuildTag = "guild-b", "Original B", "B"
		}
	}
	op, err := w.captureBossVictory(input)
	if err != nil || op.DungeonClear == nil || len(op.DungeonClear.GuildRuns) != 2 {
		t.Fatal("final guardian lost the original guild clear", err)
	}
	event, complete, err := BossVictoryDungeonCompletion(op)
	if err != nil || !complete || event.Duration != 3*time.Minute || !event.CompletedAt.Equal(input.killedAt) || len(event.Participants) != 4 {
		t.Fatal("finale changed duration, timestamp or original cohort", err)
	}
	for _, run := range event.GuildRuns {
		if run.MemberCount != 2 || run.Season != database.CurrentGuildDungeonSeason(input.killedAt) || !run.FirstClearAt.Equal(input.killedAt) {
			t.Fatal("guild clear lost its original membership or season")
		}
	}
	for _, player := range players {
		player.GuildID, player.GuildName = "new-guild", "New Guild"
	}
	input.killedAt = input.killedAt.Add(48 * time.Hour)
	input.members = input.members[:1]
	retry, err := w.captureBossVictory(input)
	if err != nil || !reflect.DeepEqual(op, retry) {
		t.Fatal("retry reconstructed clear from changed membership or time", err)
	}
	event.GuildRuns[0].GuildName = "caller mutation"
	retry.DungeonClear.GuildRuns[0].GuildID = "caller mutation"
	if !reflect.DeepEqual(op, w.PendingBossVictoryPlans()[0]) {
		t.Fatal("returned finale aliases retained original state")
	}
}

func TestBossVictoryFinaleLongRunStillEarnsClearOutsideLeaderboardEligibility(t *testing.T) {
	w, inst, players, input := bossVictoryCaptureFixture(t)
	input.bossType = "HollowSentinel"
	input.bossID = input.bossType + "-" + input.instanceID
	inst.CreatedAt = input.killedAt.Add(-72 * time.Hour)
	for _, player := range players {
		player.GuildID, player.GuildName, player.GuildTag = "original-guild", "Original", "OLD"
	}
	op, err := w.captureBossVictory(input)
	if err != nil || op.DungeonClear == nil || len(op.DungeonClear.GuildRuns) != 0 {
		t.Fatal("leaderboard duration bound stranded an otherwise earned boss victory", err)
	}
	event, complete, err := BossVictoryDungeonCompletion(op)
	if err != nil || !complete || event.Duration < 71*time.Hour || event.Duration > 72*time.Hour {
		t.Fatal("long dungeon finale lost its original duration", err)
	}
}

func TestBossVictoryFinaleCrystalGuardianStartsVigilWithoutRepairCredit(t *testing.T) {
	for raidType, definition := range elementalRaidDefinitions {
		t.Run(raidType, func(t *testing.T) {
			w, inst, players, input := bossVictoryCaptureFixture(t)
			inst.DungeonType = raidType
			input.bossType = definition.Boss
			input.bossID = input.bossType + "-" + input.instanceID
			for _, player := range players {
				player.Quests = []Quest{{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget, MaxCount: 1, Accepted: true}}
			}
			op, err := w.captureBossVictory(input)
			if err != nil || op.DungeonClear != nil {
				t.Fatal("guardian kill incorrectly completes the crystal raid", err)
			}
			if err := w.StartBossVictoryFinale(op); err == nil || len(w.CrystalRepairs) != 0 {
				t.Fatal("unconfirmed guardian started a repair")
			}
			if err := w.RetainConfirmedBossVictoryPlan(op); err != nil {
				t.Fatal(err)
			}
			if err := w.ConfirmBossVictoryProgress(op); err != nil {
				t.Fatal(err)
			}
			if err := w.StartBossVictoryFinale(op); err != nil {
				t.Fatal(err)
			}
			if err := w.StartBossVictoryFinale(op); err != nil {
				t.Fatal("duplicate callback did not remain idempotent", err)
			}
			w.StopBackground()
			state := w.CrystalRepairs[inst.ID]
			if state == nil || state.Completed || state.ClearedWaves != 0 || state.CenterX != 100 || state.CenterZ != 0 || len(state.Participants) != 4 {
				t.Fatal("repair skipped defense, moved to the corpse, or lost original participants")
			}
			for _, player := range players {
				if player.Quests[0].Count != 0 || player.Quests[0].Completed {
					t.Fatal("guardian victory granted the unearned defense objective")
				}
			}
		})
	}
}

func TestBossVictoryFinaleMissingSceneAndAlreadyRepairedPartyDoNotStartWaves(t *testing.T) {
	w, inst, players, input := bossVictoryCaptureFixture(t)
	definition := elementalRaidDefinitions["earth_crystal_raid"]
	inst.DungeonType, input.bossType = definition.Type, definition.Boss
	input.bossID = input.bossType + "-" + input.instanceID
	op, err := w.captureBossVictory(input)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.RetainConfirmedBossVictoryPlan(op); err != nil {
		t.Fatal(err)
	}
	if err := w.ConfirmBossVictoryProgress(op); err != nil {
		t.Fatal(err)
	}
	for _, player := range players {
		player.Quests = []Quest{{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget, Accepted: true, Count: 1, MaxCount: 1}}
	}
	if err := w.StartBossVictoryFinale(op); err != nil || len(w.CrystalRepairs) != 0 {
		t.Fatal("ready but unclaimed repair was reset by replay", err)
	}
	fresh := newTestWorld()
	t.Cleanup(fresh.StopBackground)
	if err := fresh.RetainConfirmedBossVictoryPlan(op); err != nil {
		t.Fatal(err)
	}
	if err := fresh.StartBossVictoryFinale(op); err != nil || len(fresh.CrystalRepairs) != 0 {
		t.Fatal("offline recovery invented an absent raid scene", err)
	}
}
