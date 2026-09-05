package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestCharacterSnapshotPreservesPersistentGameplayState(t *testing.T) {
	savedAt := time.Unix(1_700_000_000, 0).UTC()
	item := game.Item{
		ID:               "item-1",
		Name:             "Remembered Blade",
		Type:             game.ItemWeapon,
		Rarity:           game.RarityLegendary,
		Slot:             "mainHand",
		Level:            25,
		Stats:            map[string]int{"damage": 8},
		Value:            123,
		Stack:            1,
		MaxStack:         1,
		Potency:          2,
		Sockets:          1,
		Gems:             []game.SocketedGem{{Type: game.GemRuby, Quality: game.GemChipped, Stats: map[string]int{"strength": 10}}},
		SetID:            "memory-set",
		UniqueEffect:     "echoing_strike",
		StatScaleVersion: game.ItemStatScaleVersion,
	}
	entity := &game.Entity{
		SubType:        "Fighter",
		Level:          25,
		Experience:     456,
		Gold:           789,
		X:              10,
		Y:              2,
		Z:              -4,
		InstanceID:     "dungeon-1",
		BaseStats:      game.Stats{Strength: 20, Dexterity: 11, Intelligence: 9, Wisdom: 8, Vitality: 18},
		SkillPoints:    3,
		SelectedBranch: "Vanguard",
		UnlockedSkills: []string{"Charge"},
		SkillRunes:     map[string]string{"Charge": "Fighter_Charge_Rune_A"},
		TalentRanks: map[string]int{
			"FTR_1":  2,
			"FTR_02": 99,
			"WIZ_01": 5,
		},
		PartyID:   "party-1",
		Inventory: []game.Item{{}, item},
		Stash:     []game.Item{item},
		Buyback:   []game.Item{item},
		Equipment: map[string]game.Item{"mainHand": item},
		Quests: []game.Quest{{
			ID: "quest-1", Type: "KILL", Target: "Skeleton", Count: 2, MaxCount: 5,
			RewardXP: 100, RewardGold: 250, GrantedGold: 250, GrantedXP: 30, GrantedResonanceXP: 70, Accepted: true, Title: "Remembered Chapter", Description: "Persistent story description",
			Lore: "Persistent recovered lore", Category: game.QuestCategoryChronicle, Chapter: 3, ObjectiveText: "Defeat the remembered foe.",
		}},
		LastDailyQuest: savedAt.Add(-time.Hour),
	}

	character := characterSnapshot("snapshot-user", entity, savedAt)
	if character.Name != "snapshot-user" || character.Class != "Fighter" || !character.LastLogout.Equal(savedAt) {
		t.Fatalf("identity snapshot mismatch: %+v", character)
	}
	if len(character.Inventory) != 1 || len(character.Stash) != 1 || len(character.Buyback) != 1 || len(character.Equipment) != 1 {
		t.Fatalf("item containers were not preserved: inventory=%d stash=%d buyback=%d equipment=%d", len(character.Inventory), len(character.Stash), len(character.Buyback), len(character.Equipment))
	}
	if character.Inventory[0].Gems[0].Type != "Ruby" || character.Inventory[0].UniqueEffect != "echoing_strike" {
		t.Fatalf("item metadata was not preserved: %+v", character.Inventory[0])
	}
	if !reflect.DeepEqual(character.SkillRunes, entity.SkillRunes) || !reflect.DeepEqual(character.UnlockedSkills, entity.UnlockedSkills) {
		t.Fatalf("build state was not preserved: skills=%v runes=%v", character.UnlockedSkills, character.SkillRunes)
	}
	if !reflect.DeepEqual(character.TalentRanks, map[string]int{"FTR_01": 2, "FTR_02": 5}) {
		t.Fatalf("talent ranks were not normalized: %v", character.TalentRanks)
	}
	if !reflect.DeepEqual(character.UnlockedTalents, []string{"FTR_01", "FTR_02"}) {
		t.Fatalf("legacy talent list was not stable: %v", character.UnlockedTalents)
	}
	if len(character.Quests) != 1 || character.Quests[0].Count != 2 || !character.LastDailyQuest.Equal(entity.LastDailyQuest) {
		t.Fatalf("quest state was not preserved: quests=%+v lastDaily=%v", character.Quests, character.LastDailyQuest)
	}
	if character.Quests[0].Title != "Remembered Chapter" || character.Quests[0].Lore != "Persistent recovered lore" ||
		character.Quests[0].Category != game.QuestCategoryChronicle || character.Quests[0].Chapter != 3 ||
		character.Quests[0].ObjectiveText != "Defeat the remembered foe." {
		t.Fatalf("rich Chronicle fields were not preserved: %+v", character.Quests[0])
	}
	if q := character.Quests[0]; q.RewardGold != 250 || q.GrantedGold != 250 || q.GrantedXP != 30 || q.GrantedResonanceXP != 70 {
		t.Fatalf("quest reward receipt was not preserved: %+v", q)
	}
}

func TestDungeonResumeDatabaseMappingRoundTripsEveryField(t *testing.T) {
	snapshot := game.DungeonResumeSnapshot{
		ID: "dungeon_party_1", PartyID: "party-1", CreatedAt: time.Unix(1234, 0).UTC(),
		Difficulty: game.DifficultyMythic, DungeonType: "molten_core", RunLevel: 100,
		CurrentRoomIndexValue: 1,
		Layout: game.DungeonLayout{
			GenerationSeed: "9223372036854775807", GeneratorVersion: 1, GenerationAttempt: 3, GenerationFallback: true,
			Rooms:     []game.DungeonRoom{{X: 1, Z: 2, Width: 3, Height: 4, Type: "elite", Hook: "chest", Pacing: "pressure", Color: 7}},
			WalkRects: []game.DungeonWalkRect{{X: 5, Z: 6, Width: 7, Height: 8, Kind: "room", RoomIndex: 2}},
			Corridors: []game.DungeonCorridor{{FromRoomIndex: 1, ToRoomIndex: 2, Width: 9, WalkRectIndices: []int{3, 4}}},
		},
		Rooms: []game.DungeonRoomProgress{{Explored: true, Cleared: true, Rewarded: true}},
	}

	roundTrip := dungeonResumeFromDatabase(dungeonResumeToDatabase(snapshot))
	if !reflect.DeepEqual(roundTrip, snapshot) {
		t.Fatalf("dungeon resume mapping mismatch:\n got: %#v\nwant: %#v", roundTrip, snapshot)
	}
}
