package database

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func bossVictoryFixture() BossVictoryOperation {
	op := BossVictoryOperation{Version: 1, InstanceID: "dungeon_boss_victory", BossType: "RootboundWarden",
		DungeonType: "verdant_bastion_catacombs", RoomIndex: 2, Difficulty: "normal", RunLevel: 30, CreatedAt: time.Now().UTC().Truncate(time.Millisecond),
		Participants: []BossVictoryRecipient{
			{Username: "alice", PlayerID: "player-alice", Gold: 73, XP: 234, Items: []string{`{"id":"original-heart","name":"Heart","stack":1,"maxStack":1000}`}, Quests: []BossVictoryKillCredit{{QuestID: "boss-hunt", Target: "RootboundWarden", Amount: 1, Maximum: 5}}},
			{Username: "bob", PlayerID: "player-bob", Gold: 74, XP: 235},
		}}
	op.BossID = op.BossType + "-" + op.InstanceID
	op.ID = BossVictoryID(op.InstanceID, op.BossID)
	op.Drops = []BossVictoryDrop{{LootID: fmt.Sprintf("loot-boss-%s-0", strings.TrimPrefix(op.ID, bossVictoryPrefix)), Item: `{"id":"original-ground-blade","name":"Blade","stack":1,"maxStack":1,"futureArt":{"retain":"exact"}}`, X: 20000, Y: .5, Z: 19900, AvailableAt: op.CreatedAt, ExpiresAt: op.CreatedAt.Add(10 * time.Minute)}}
	op.Fingerprint, _ = BossVictoryFingerprint(op)
	return op
}

func TestBossVictoryOriginalCohortBSONAndSavedReceipts(t *testing.T) {
	op := bossVictoryFixture()
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	encoded, err := bson.Marshal(BossVictoryRecord{BossVictoryOperation: op, State: BossVictoryPending})
	if err != nil {
		t.Fatal(err)
	}
	var record BossVictoryRecord
	if err := bson.Unmarshal(encoded, &record); err != nil || record.Validate() != nil || !reflect.DeepEqual(record.BossVictoryOperation, op) {
		t.Fatal("BSON lost exact original cohort, opaque rolls or loot lifetime", err)
	}
	character := &Character{Name: "alice", PendingBossLoot: op.Participants[0].Items, ItemDeliveryReceipts: map[string]string{op.ID: op.Fingerprint}}
	if !BossVictoryCharacterReceiptMatches(character, op) {
		t.Fatal("saved full-bag reward receipt was not recognized")
	}
	character.Name = "uninvited"
	if BossVictoryCharacterReceiptMatches(character, op) {
		t.Fatal("same receipt admitted a player outside the original cohort")
	}
}

func TestBossVictoryRejectsChangedOrUnstableIdentityAndSharedRolls(t *testing.T) {
	mutations := map[string]func(*BossVictoryOperation){
		"random boss ID": func(op *BossVictoryOperation) {
			op.BossID += "-new-random-suffix"
			op.ID = BossVictoryID(op.InstanceID, op.BossID)
		},
		"room": func(op *BossVictoryOperation) { op.RoomIndex = -1 },
		"unsorted cohort": func(op *BossVictoryOperation) {
			op.Participants[0], op.Participants[1] = op.Participants[1], op.Participants[0]
		},
		"shared item":  func(op *BossVictoryOperation) { op.Participants[1].Items = op.Participants[0].Items },
		"renewed drop": func(op *BossVictoryOperation) { op.Drops[0].AvailableAt = op.Drops[0].AvailableAt.Add(time.Minute) },
		"duplicate quest": func(op *BossVictoryOperation) {
			op.Participants[0].Quests = append(op.Participants[0].Quests, op.Participants[0].Quests[0])
		},
		"overcap quest": func(op *BossVictoryOperation) { op.Participants[0].Quests[0].Amount = 6 },
		"unknown state": func(op *BossVictoryOperation) { op.Difficulty = "free-rewards" },
		"wrong owner":   func(op *BossVictoryOperation) { op.Participants[0].PlayerID = "player-bob" },
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			op := bossVictoryFixture()
			mutate(&op)
			op.Fingerprint, _ = BossVictoryFingerprint(op)
			if err := op.Validate(); err == nil {
				t.Fatal("invalid frozen victory accepted")
			}
		})
	}
}

func TestBossVictoryFinaleBSONAndValidationPreserveOriginalClear(t *testing.T) {
	makeFinal := func() BossVictoryOperation {
		op := bossVictoryFixture()
		op.BossType = "HollowSentinel"
		op.BossID = op.BossType + "-" + op.InstanceID
		op.ID = BossVictoryID(op.InstanceID, op.BossID)
		op.Drops[0].LootID = "loot-boss-" + strings.TrimPrefix(op.ID, bossVictoryPrefix) + "-0"
		op.DungeonClear = &BossVictoryDungeonClear{DurationMS: 120000, GuildRuns: []GuildDungeonRun{{GuildID: "original", GuildName: "Original", GuildTag: "OLD",
			MemberCount: 2, Season: CurrentGuildDungeonSeason(op.CreatedAt), FirstClearAt: op.CreatedAt,
			DungeonType: op.DungeonType, Difficulty: op.Difficulty, RunLevel: op.RunLevel, DurationMS: 120000}}}
		op.Fingerprint, _ = BossVictoryFingerprint(op)
		return op
	}
	op := makeFinal()
	encoded, err := bson.Marshal(BossVictoryRecord{BossVictoryOperation: op, State: BossVictoryPending})
	if err != nil {
		t.Fatal(err)
	}
	var record BossVictoryRecord
	if err := bson.Unmarshal(encoded, &record); err != nil || record.Validate() != nil || !reflect.DeepEqual(record.BossVictoryOperation, op) {
		t.Fatal("BSON changed original dungeon finale or fingerprint", err)
	}
	for name, mutate := range map[string]func(*BossVictoryOperation){
		"missing finale": func(op *BossVictoryOperation) { op.DungeonClear = nil },
		"invented finale": func(op *BossVictoryOperation) {
			op.BossType = "RootboundWarden"
			op.BossID = op.BossType + "-" + op.InstanceID
			op.ID = BossVictoryID(op.InstanceID, op.BossID)
			op.Drops = nil
		},
		"later season": func(op *BossVictoryOperation) { op.DungeonClear.GuildRuns[0].Season = "later" },
		"later time": func(op *BossVictoryOperation) {
			op.DungeonClear.GuildRuns[0].FirstClearAt = op.CreatedAt.Add(time.Hour)
		},
		"changed duration": func(op *BossVictoryOperation) { op.DungeonClear.GuildRuns[0].DurationMS++ },
		"invalid duration": func(op *BossVictoryOperation) { op.DungeonClear.DurationMS = 0 },
		"extra members":    func(op *BossVictoryOperation) { op.DungeonClear.GuildRuns[0].MemberCount = 3 },
		"wrong difficulty": func(op *BossVictoryOperation) { op.DungeonClear.GuildRuns[0].Difficulty = "mythic" },
	} {
		t.Run(name, func(t *testing.T) {
			op := makeFinal()
			mutate(&op)
			op.Fingerprint, _ = BossVictoryFingerprint(op)
			if err := op.Validate(); err == nil {
				t.Fatal("invalid original dungeon finale accepted")
			}
		})
	}
}
