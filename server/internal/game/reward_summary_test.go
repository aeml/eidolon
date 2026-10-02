package game

import (
	"strings"
	"testing"
)

func TestBossRunGuidanceRequiresActualActivityFinale(t *testing.T) {
	cases := []struct {
		activity, boss string
		complete       bool
		hint           string
	}{
		{"verdant_bastion_catacombs", "RootboundWarden", false, "Continue along"},
		{"verdant_bastion_catacombs", "HollowSentinel", true, "Personally complete"},
		{"molten_core", "ForgemasterPyrax", false, "Continue along"},
		{"molten_core", "LordInfernax", true, "Dungeon Guide"},
		{"tempest_spire", "Windshear", false, "Continue along"},
		{"tempest_spire", "Zephyrion", true, "Personally complete"},
		{"abyssal_well", "TiderendLeviathan", false, "Continue along"},
		{"abyssal_well", "Thalorath", true, "Dungeon Guide"},
		{"umbral_nexus", "NullArchitect", false, "Continue along"},
		{"umbral_nexus", "EidolonDevourer", true, "boss loot alone does not claim"},
		{"weekly_raid", "UmbraPrime", true, "weekly cache settles separately"},
		{"tempest_spire", "HollowSentinel", false, "Continue along"},
		{"", "", false, "Continue along"},
		{"earth_crystal_raid", "GravenColossus", false, "all three Vigil waves"},
		{"water_crystal_raid", "TideboundTyrant", false, "all three Vigil waves"},
		{"fire_crystal_raid", "AshenImperator", false, "all three Vigil waves"},
		{"air_crystal_raid", "TempestSovereign", false, "all three Vigil waves"},
	}
	for _, tc := range cases {
		t.Run(tc.activity+"/"+tc.boss, func(t *testing.T) {
			summary := buildBossRewardSummary("player", tc.boss, tc.activity, DifficultyNormal, 100, 1, 0, 1, 0, 42, 10, 0, nil)
			if summary.RunComplete != tc.complete || !strings.Contains(summary.ExitHint, tc.hint) {
				t.Fatalf("wrong completion guidance: %+v", summary)
			}
			if summary.Gold != 42 || summary.XP != 10 || summary.PlayerID != "player" {
				t.Fatal("guidance altered actual recipient or rewards")
			}
		})
	}
}

func TestCountRewardDropsSeparatesItemsAndGems(t *testing.T) {
	itemCount, gemCount := countRewardDrops([]*Item{
		{Name: "Iron Sword", Type: ItemWeapon},
		{Name: "Eidolon Shard", Type: ItemMaterial},
		{Name: "Radiant Ruby", Type: ItemGem},
		nil,
	})

	if itemCount != 2 {
		t.Fatalf("expected 2 non-gem items, got %d", itemCount)
	}
	if gemCount != 1 {
		t.Fatalf("expected 1 gem, got %d", gemCount)
	}
}

func TestBuildBossRewardSummaryFormatsBossRewards(t *testing.T) {
	summary := buildBossRewardSummary(
		"player-1",
		"Zephyrion",
		"tempest_spire",
		DifficultyHeroic,
		100,
		6,
		2,
		6,
		2,
		4200,
		900000,
		2,
		[]*Item{
			{Name: "Iron Sword", Type: ItemWeapon},
			{Name: "Radiant Ruby", Type: ItemGem},
			{Name: "Eidolon Shard", Type: ItemMaterial},
		},
	)

	if summary.PlayerID != "player-1" {
		t.Fatalf("expected player-1, got %s", summary.PlayerID)
	}
	if summary.Title != "Boss Defeated: Zephyrion" {
		t.Fatalf("unexpected title: %s", summary.Title)
	}
	if summary.Subtitle != "Tempest Spire • Heroic" {
		t.Fatalf("unexpected subtitle: %s", summary.Subtitle)
	}
	if summary.Gold != 4200 || summary.XP != 900000 {
		t.Fatalf("unexpected numeric rewards: gold=%d xp=%d", summary.Gold, summary.XP)
	}
	if summary.ItemCount != 2 || summary.GemCount != 1 || summary.HeartCount != 2 {
		t.Fatalf("unexpected counts: items=%d gems=%d hearts=%d", summary.ItemCount, summary.GemCount, summary.HeartCount)
	}
	if summary.Difficulty != string(DifficultyHeroic) {
		t.Fatalf("unexpected difficulty: %s", summary.Difficulty)
	}
	if summary.DifficultyNote != "Heroic bosses guarantee one bonus gem drop." {
		t.Fatalf("unexpected difficulty note: %s", summary.DifficultyNote)
	}
	if summary.RunLevel != 100 {
		t.Fatalf("unexpected run level: %d", summary.RunLevel)
	}
	if summary.RoomsCleared != 6 || summary.TotalRooms != 6 {
		t.Fatalf("unexpected room completion summary: cleared=%d total=%d", summary.RoomsCleared, summary.TotalRooms)
	}
	if summary.EliteRoomsCleared != 2 || summary.TotalEliteRooms != 2 {
		t.Fatalf("unexpected elite room summary: cleared=%d total=%d", summary.EliteRoomsCleared, summary.TotalEliteRooms)
	}
	if summary.ExitHint == "" {
		t.Fatalf("expected exit hint to be populated")
	}
}

func TestBuildBossRewardSummaryCanBeOverriddenForDirectRewards(t *testing.T) {
	summary := buildBossRewardSummary(
		"player-1",
		"HollowSentinel",
		"verdant_bastion_catacombs",
		DifficultyNormal,
		30,
		1,
		0,
		1,
		0,
		120,
		800,
		1,
		nil,
	)
	summary.ItemCount = 0
	summary.GemCount = 0

	if summary.ItemCount != 0 || summary.GemCount != 0 || summary.HeartCount != 1 {
		t.Fatalf("unexpected direct reward counts: items=%d gems=%d hearts=%d", summary.ItemCount, summary.GemCount, summary.HeartCount)
	}
}

func TestBuildBossRewardSummaryAddsMythicDifficultyNote(t *testing.T) {
	summary := buildBossRewardSummary(
		"player-1",
		"Zephyrion",
		"tempest_spire",
		DifficultyMythic,
		100,
		6,
		2,
		6,
		2,
		4200,
		900000,
		2,
		nil,
	)

	if summary.DifficultyNote != "Mythic bosses guarantee one bonus gem and one unique-effect item." {
		t.Fatalf("unexpected mythic difficulty note: %s", summary.DifficultyNote)
	}
}
