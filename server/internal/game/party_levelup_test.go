package game

import "testing"

func TestLevelUpHealingRequiresLivingRecipient(t *testing.T) {
	for _, tc := range []struct {
		name, state string
		health      int
		heal        bool
	}{
		{"living", "IDLE", 10, true},
		{"downed", "DEAD", 0, false},
		{"lethal-pending", "IDLE", 0, false},
		{"dead-state", "DEAD", 10, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("level-heal", "Cleric")
			p.Level, p.MaxExperience = 30, experienceRequiredForLevel(30)
			p.BaseStats = applyLevelGrowth(InitialPlayerStats(), 30)
			p.Experience, p.Health, p.State = p.MaxExperience-1, tc.health, tc.state
			p.Mu.Lock()
			w.awardExperienceLocked(p, 5)
			p.Mu.Unlock()
			if p.Level != 31 || p.Experience != 4 || p.State != tc.state {
				t.Fatal("earned level or death state changed incorrectly")
			}
			want := tc.health
			if tc.heal {
				want = p.MaxHealth
			}
			if p.Health != want {
				t.Fatalf("level-up health=%d, want %d", p.Health, want)
			}
		})
	}
}
