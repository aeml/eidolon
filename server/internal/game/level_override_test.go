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
	if updated.Health != updated.MaxHealth {
		t.Fatalf("expected health refill to max, got health=%d max=%d", updated.Health, updated.MaxHealth)
	}
	if updated.Mana != updated.MaxMana {
		t.Fatalf("expected mana refill to max, got mana=%d max=%d", updated.Mana, updated.MaxMana)
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
