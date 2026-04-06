package game

import (
	"testing"
	"time"
)

func TestSetPlayerLevelUpdatesDerivedState(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:             "player-1",
		Type:           TypePlayer,
		SubType:        "Fighter",
		Level:          1,
		Experience:     77,
		MaxExperience:  100,
		Health:         15,
		MaxHealth:      100,
		Mana:           6,
		MaxMana:        50,
		SelectedBranch: "A",
		SkillPoints:    0,
		TalentRanks:    map[string]int{},
		UnlockedSkills: []string{},
		Equipment:      map[string]Item{},
		Cooldowns:      map[string]time.Time{},
		SkillRunes:     map[string]string{},
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
	}
	player.RecalculateStats()
	w.AddEntity(player)

	updated, ok := w.SetPlayerLevel("player-1", 30)
	if !ok {
		t.Fatal("expected SetPlayerLevel to succeed")
	}
	if updated.Level != 30 {
		t.Fatalf("expected level 30, got %d", updated.Level)
	}
	if updated.Experience != 0 {
		t.Fatalf("expected experience reset to 0, got %d", updated.Experience)
	}
	if updated.MaxExperience != experienceRequiredForLevel(30) {
		t.Fatalf("expected max experience %d, got %d", experienceRequiredForLevel(30), updated.MaxExperience)
	}
	if updated.SkillPoints != 3 {
		t.Fatalf("expected 3 skill points at level 30, got %d", updated.SkillPoints)
	}
	if updated.TalentPoints != 6 {
		t.Fatalf("expected 6 talent points at level 30, got %d", updated.TalentPoints)
	}
	if updated.BaseStats.Strength != 78 || updated.BaseStats.Vitality != 68 {
		t.Fatalf("expected fighter base strength/vitality to scale to 78/68 at level 30, got str=%d vit=%d", updated.BaseStats.Strength, updated.BaseStats.Vitality)
	}
	if updated.BaseStats.Dexterity != 39 || updated.BaseStats.Intelligence != 39 || updated.BaseStats.Wisdom != 39 {
		t.Fatalf("expected secondary stats to scale to 39 at level 30, got dex=%d int=%d wis=%d", updated.BaseStats.Dexterity, updated.BaseStats.Intelligence, updated.BaseStats.Wisdom)
	}
	if updated.Damage <= 2 {
		t.Fatalf("expected derived damage to grow with level override, got %d", updated.Damage)
	}
	if updated.Health != updated.MaxHealth {
		t.Fatalf("expected health refill to max, got health=%d max=%d", updated.Health, updated.MaxHealth)
	}
	if updated.Mana != updated.MaxMana {
		t.Fatalf("expected mana refill to max, got mana=%d max=%d", updated.Mana, updated.MaxMana)
	}
}

func TestSetPlayerLevelRebuildsCanonicalStatsWhenTargetLevelMatchesCurrentLevel(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:            "player-1",
		Type:          TypePlayer,
		SubType:       "Fighter",
		Level:         100,
		Experience:    0,
		MaxExperience: experienceRequiredForLevel(100),
		Health:        100,
		MaxHealth:     595,
		Mana:          100,
		MaxMana:       595,
		TalentRanks:   map[string]int{},
		Equipment:     map[string]Item{},
		Cooldowns:     map[string]time.Time{},
		SkillRunes:    map[string]string{},
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
	}
	player.RecalculateStats()
	w.AddEntity(player)

	updated, ok := w.SetPlayerLevel("player-1", 100)
	if !ok {
		t.Fatal("expected SetPlayerLevel to succeed for same-level stat repair")
	}
	if updated.BaseStats.Strength != 218 || updated.BaseStats.Vitality != 208 {
		t.Fatalf("expected fighter primary stats to rebuild to 218/208 at level 100, got str=%d vit=%d", updated.BaseStats.Strength, updated.BaseStats.Vitality)
	}
	if updated.BaseStats.Dexterity != 109 || updated.BaseStats.Intelligence != 109 || updated.BaseStats.Wisdom != 109 {
		t.Fatalf("expected secondary stats to rebuild to 109 at level 100, got dex=%d int=%d wis=%d", updated.BaseStats.Dexterity, updated.BaseStats.Intelligence, updated.BaseStats.Wisdom)
	}
	if updated.Damage <= 2 {
		t.Fatalf("expected repaired level 100 fighter damage to be useful, got %d", updated.Damage)
	}
	if updated.MaxHealth <= 595 {
		t.Fatalf("expected repaired level 100 fighter max health to exceed poisoned value, got %d", updated.MaxHealth)
	}
}

func TestSetPlayerLevelRejectsOutOfRangeLevel(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-1", Type: TypePlayer, Level: 1, MaxExperience: 100, TalentRanks: map[string]int{}, Equipment: map[string]Item{}, Cooldowns: map[string]time.Time{}, SkillRunes: map[string]string{}}
	w.AddEntity(player)

	updated, ok := w.SetPlayerLevel("player-1", 0)
	if ok || updated != nil {
		t.Fatal("expected SetPlayerLevel to reject invalid level")
	}
	if player.Level != 1 {
		t.Fatalf("expected level to remain 1, got %d", player.Level)
	}
}
