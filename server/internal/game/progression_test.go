package game

import "testing"

func TestLevelOneToCapProgressionForEveryClass(t *testing.T) {
	for _, classType := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(classType, func(t *testing.T) {
			w := NewWorld(nil)
			player := &Entity{
				ID: "progression-" + classType, Type: TypePlayer, SubType: classType, Level: 1,
				MaxExperience: experienceRequiredForLevel(1), BaseStats: canonicalBaseStatsForClass(classType),
			}
			for player.Level < MaxPlayerLevel {
				w.awardExperienceLocked(player, player.MaxExperience)
			}
			if player.Level != MaxPlayerLevel || player.Experience != player.MaxExperience {
				t.Fatalf("progression stopped at level=%d xp=%d/%d", player.Level, player.Experience, player.MaxExperience)
			}
			wantStats := applyLevelGrowth(canonicalBaseStatsForClass(classType), MaxPlayerLevel)
			if player.BaseStats != wantStats {
				t.Fatalf("cap stats = %+v, want %+v", player.BaseStats, wantStats)
			}
			w.awardExperienceLocked(player, ResonanceXPPerLevel)
			if player.ResonanceLevel != 1 || player.ResonancePoints != 1 {
				t.Fatalf("cap reward did not enter Resonance: %+v", player)
			}
		})
	}
}

func TestExperienceCrossesCapIntoResonanceWithoutOverflow(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID: "cap-transition", Type: TypePlayer, SubType: "Fighter", Level: 99,
		MaxExperience: experienceRequiredForLevel(99), BaseStats: canonicalBaseStatsForClass("Fighter"),
	}
	player.Experience = player.MaxExperience - 25
	w.awardExperienceLocked(player, 100)
	if player.Level != MaxPlayerLevel || player.Experience != player.MaxExperience {
		t.Fatalf("cap transition failed: level=%d xp=%d/%d", player.Level, player.Experience, player.MaxExperience)
	}
	if player.ResonanceXP != 75 {
		t.Fatalf("overflow resonance XP = %d, want 75", player.ResonanceXP)
	}
	if player.MaxExperience <= int(^uint32(0)>>1) {
		t.Fatalf("cap XP requirement %d does not exercise int64 protocol range", player.MaxExperience)
	}
}

func TestResonanceEarnSpendAndNormalize(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID: "resonance", Type: TypePlayer, SubType: "Fighter", Level: MaxPlayerLevel,
		MaxExperience: experienceRequiredForLevel(MaxPlayerLevel), BaseStats: canonicalBaseStatsForClass("Fighter"),
	}
	w.AddEntity(player)
	player.Mu.Lock()
	w.awardExperienceLocked(player, ResonanceXPPerLevel*2+123)
	player.Mu.Unlock()
	if player.ResonanceLevel != 2 || player.ResonancePoints != 2 || player.ResonanceXP != 123 {
		t.Fatalf("unexpected resonance accrual: level=%d points=%d xp=%d", player.ResonanceLevel, player.ResonancePoints, player.ResonanceXP)
	}
	if _, err := w.SpendResonancePoint(player.ID, "power"); err != nil {
		t.Fatal(err)
	}
	if player.ResonanceRanks["power"] != 1 || player.ResonancePoints != 1 {
		t.Fatalf("point was not spent: %+v points=%d", player.ResonanceRanks, player.ResonancePoints)
	}

	corrupt := &Entity{ResonanceLevel: 2, ResonanceXP: ResonanceXPPerLevel + 5, ResonancePoints: 99, ResonanceRanks: map[string]int{"power": 50, "invented": 50}}
	corrupt.NormalizeResonanceProgress()
	if corrupt.ResonanceXP != ResonanceXPPerLevel-1 || corrupt.ResonanceRanks["power"] != 2 || corrupt.ResonancePoints != 0 {
		t.Fatalf("corrupt progress was not bounded: %+v", corrupt)
	}
	if _, ok := corrupt.ResonanceRanks["invented"]; ok {
		t.Fatal("unknown resonance trait survived normalization")
	}
}
