package game

import (
	"fmt"
	"testing"
	"time"
)

// Uses ordinary mutually accepted duels and paid skill casts, not damage helpers.
func TestPaidHostileAbilitiesRespectArcaneShield(t *testing.T) {
	for _, attack := range []struct{ class, skill string }{
		{"Fighter", "basic"},
		{"Fighter", "Shield Slam"}, {"Fighter", "Earthshaker"},
		{"Fighter", "Sweeping Strike"}, {"Fighter", "Juggernaut Charge"},
		{"Cleric", "Smite"}, {"Wizard", "Flame Whip"},
		{"Cleric", "Radiant Strike"}, {"Cleric", "Heaven's Trumpet"},
		{"Wizard", "Gravity Well"}, {"Wizard", "Scorch Beam"}, {"Wizard", "Frost Nova"},
		{"Rogue", "Shadow Strike"}, {"Rogue", "Rain of Arrows"},
		{"Rogue", "Backstab"}, {"Rogue", "Death Spiral"},
	} {
		for _, shielded := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/shielded%v", attack.skill, shielded), func(t *testing.T) {
				source, defender := newTestPlayer("skill-attacker", attack.class), newTestPlayer("shield-defender", "Wizard")
				source.Level, defender.Level = 100, 100
				source.UnlockedSkills = []string{attack.skill}
				defender.UnlockedSkills = []string{"Arcane Shield"}
				source.Stats.Strength, source.Stats.Intelligence, source.Stats.Wisdom = 10, 10, 10
				// Slow/stun applications recalculate the defender. Start from
				// real derived maxima, not the helper's arbitrary 500 HP, so
				// resource normalization cannot masquerade as shield bypass.
				defender.BaseStats.Intelligence = 100
				defender.RecalculateStats()
				defender.Health, defender.Mana = defender.MaxHealth, defender.MaxMana
				w := newPvPTestWorld(source, defender)
				defer w.StopBackground()
				challenge, err := w.RequestDuel(source.ID, defender.ID)
				if err != nil {
					t.Fatal(err)
				}
				if _, err := w.RespondDuel(defender.ID, challenge.RequesterID, true); err != nil {
					t.Fatal(err)
				}
				// Move within ordinary cast range after setup, and expire only the
				// match-start grace window, leaving actual ability defenses intact.
				for i, p := range []*Entity{source, defender} {
					oldX, oldZ := p.X, p.Z
					p.X, p.Z = float64(i*2), 0
					p.InvulnerableEndTime = time.Now().Add(-time.Second)
					w.Grid.Update(p, oldX, oldZ)
				}
				if shielded {
					mana := defender.Mana
					if result := w.PerformAbility(defender.ID, defender.X, defender.Z, "", "Arcane Shield"); !result.Accepted || defender.Mana >= mana || defender.ArcaneShieldHP != 600 {
						t.Fatal("paid Arcane Shield setup failed")
					}
				}
				health, capacity, mana := defender.Health, defender.ArcaneShieldHP, source.Mana
				if attack.skill == "basic" {
					source.AttackCooldown = 100 * time.Millisecond
					if _, accepted := w.PerformAttack(source.ID, defender.ID); !accepted {
						t.Fatal("ordinary basic attack rejected")
					}
					w.backgroundWork.SealWhenIdle() // Observe actual scheduled impact, not helper invocation.
				} else {
					result := w.PerformAbility(source.ID, defender.X, defender.Z, defender.ID, attack.skill)
					if !result.Accepted || source.Mana >= mana {
						t.Fatalf("paid attack rejected: %+v", result)
					}
				}
				if !shielded {
					if defender.Health >= health {
						t.Fatal("unshielded control took no damage")
					}
					return
				}
				if defender.Health != health || defender.ArcaneShieldHP >= capacity || defender.ArcaneShieldAbsorbed <= 0 {
					t.Fatalf("ability bypassed shield: health=%d->%d shield=%d->%d absorbed=%d", health, defender.Health, capacity, defender.ArcaneShieldHP, defender.ArcaneShieldAbsorbed)
				}
			})
		}
	}
}
