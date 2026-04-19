package game

import "testing"

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
