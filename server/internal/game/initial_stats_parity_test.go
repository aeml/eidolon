package game

import "testing"

func TestLevelOverrideMatchesOrdinaryStartingStatsAndGrowth(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("override-parity", class)
			w.AddEntity(p)
			// These are the actual character-creation defaults, not the
			// stronger historical prepared-character helper's class bonus.
			earned := &Entity{Type: TypePlayer, SubType: class, Level: 1,
				BaseStats:     Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Wisdom: 10, Vitality: 10},
				MaxExperience: experienceRequiredForLevel(1)}
			for _, level := range []int{1, 10, 30, 60, 70, 100} {
				for earned.Level < level {
					w.awardExperienceLocked(earned, earned.MaxExperience-earned.Experience)
				}
				if _, ok := w.SetPlayerLevel(p.ID, level); !ok {
					t.Fatal("level override failed")
				}
				if p.BaseStats != earned.BaseStats {
					t.Fatalf("level%d prepared=%+v ordinary=%+v", level, p.BaseStats, earned.BaseStats)
				}
			}
		})
	}
}

func TestSavedProgressionDoesNotReplaceHistoricalBaseStats(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			p := newTestPlayer("saved-stats", class)
			p.Level = 30
			// Deliberately noncanonical historic stats, including prior bonuses
			// and allocations: changing QA defaults must not rewrite a save.
			original := Stats{Strength: 78, Dexterity: 49, Intelligence: 62, Wisdom: 53, Vitality: 75}
			p.BaseStats = original
			migration, err := MigrateSavedProgression(30, 0, CurrentProgressionVersion)
			if err != nil {
				t.Fatal(err)
			}
			p.ApplySavedProgression(migration)
			if p.BaseStats != original || p.Level != 30 {
				t.Fatalf("loading saved progression changed historical stats: %+v", p.BaseStats)
			}
		})
	}
}
