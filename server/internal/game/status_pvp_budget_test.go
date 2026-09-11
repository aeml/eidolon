package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidRawWoundsUseRecipientPvPBudget(t *testing.T) {
	for _, skill := range []string{"Shadow Strike", "Shadow Lunge", "coated basic", "coated projectile"} {
		for _, pvp := range []bool{false, true} {
			for _, dex := range []int{100, 10000} {
				t.Run(fmt.Sprintf("%s/pvp%v/dex%d", skill, pvp, dex), func(t *testing.T) {
					cast := skill
					if skill == "coated basic" || skill == "coated projectile" {
						cast = "Poison Coating"
					}
					w, source, target := abilityDefenseDuel(t, "Rogue", cast, "")
					source.Stats.Dexterity, source.CritChanceBonus = dex, 0
					target.ArcaneShieldActive = false
					if !pvp {
						target.Type = TypeEnemy                            // Prepared PvE control, same ordinary application.
						target.Health, target.MaxHealth = 1000000, 1000000 // Survive the high-Dexterity projectile.
					}
					if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, cast); !result.Accepted {
						t.Fatal("paid wound cast rejected")
					}
					if skill == "coated basic" {
						source.AttackCooldown = 100 * time.Millisecond
						if _, accepted := w.PerformAttack(source.ID, target.ID); !accepted {
							t.Fatal("coated swing rejected")
						}
						w.backgroundWork.SealWhenIdle()
					}
					if skill == "coated projectile" {
						source.UnlockedSkills = append(source.UnlockedSkills, "Piercing Throw")
						source.LastAbilityTime = time.Now().Add(-time.Second)
						if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, "Piercing Throw"); !result.Accepted {
							t.Fatal("coated projectile rejected")
						}
						advancePaidProjectileUntilHit(t, w, source, target)
					}
					got, want := target.BleedDamage, 10+dex/2
					if cast == "Poison Coating" {
						got, want = target.PoisonDamage, 8+dex/2
					}
					if pvp {
						want = min(want*65/100, 175)
					}
					if got != want {
						t.Fatalf("stored wound=%d want=%d", got, want)
					}
				})
			}
		}
	}
}

func TestPaidInheritedWoundsDoNotScalePvPTwice(t *testing.T) {
	for _, skill := range []string{"Piercing Throw", "Fan of Knives"} {
		t.Run(skill, func(t *testing.T) {
			w, source, target := abilityDefenseDuel(t, "Rogue", skill, "")
			target.ArcaneShieldActive = false
			source.CritChanceBonus = 1
			rune, divisor := "piercingthrow_serrated", 5
			if skill == "Fan of Knives" {
				rune, divisor = "fanofknives_poisoned", 4
			}
			source.SkillRunes = map[string]string{skill: rune}
			if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
				t.Fatal("paid inherited-wound cast rejected")
			}
			advancePaidProjectileUntilHit(t, w, source, target)
			want, got := (500-target.Health)/divisor, target.BleedDamage
			if skill == "Fan of Knives" {
				got = target.PoisonDamage
			}
			if want < 2 || got != want {
				t.Fatalf("wound did not inherit once-scaled critical hit: got=%d want=%d", got, want)
			}
		})
	}
}

func TestPaidCoatingSpreadScalesEachRecipient(t *testing.T) {
	source, opponent := newTestPlayer("spread-rogue", "Rogue"), newTestPlayer("spread-opponent", "Wizard")
	source.X, source.Z, opponent.X, opponent.Z = 50000, 50000, 50003, 50000
	source.Level, source.Stats.Dexterity, source.AttackCooldown = 100, 100, 100*time.Millisecond
	source.UnlockedSkills = []string{"Poison Coating"}
	source.ActiveSetBonuses = map[string]map[string]int{"spread": {"poisonSpread": 1}}
	w := newPvPTestWorld(source, opponent)
	t.Cleanup(w.StopBackground)
	if err := w.SetOpenWorldPvP(source.ID, true); err != nil {
		t.Fatal(err)
	}
	if err := w.SetOpenWorldPvP(opponent.ID, true); err != nil {
		t.Fatal(err)
	}
	primary := &Entity{ID: "spread-monster", Type: TypeEnemy, Health: 10000, MaxHealth: 10000, State: "IDLE", X: 50002, Z: 50000}
	w.AddEntity(primary)
	if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Poison Coating"); !result.Accepted {
		t.Fatal("paid coating rejected")
	}
	if _, accepted := w.PerformAttack(source.ID, primary.ID); !accepted {
		t.Fatal("coated primary hit rejected")
	}
	w.backgroundWork.SealWhenIdle()
	if primary.PoisonDamage != 58 || opponent.PoisonDamage != 37 || !opponent.Poisoned {
		t.Fatalf("spread reused wrong target budget: monster=%d player=%d", primary.PoisonDamage, opponent.PoisonDamage)
	}
}

func TestStatusSpreadBudgetKeepsInheritedScalingAndRecipientCap(t *testing.T) {
	for _, inherited := range []bool{false, true} {
		w, source, target := abilityDefenseDuel(t, "Rogue", "Poison Coating", "")
		target.MaxHealth = 100
		primary := &Entity{ID: "budget-primary", Type: TypeEnemy, InstanceID: source.InstanceID,
			X: target.X, Z: target.Z, Health: 1000, MaxHealth: 1000, State: "IDLE"}
		w.AddEntity(primary)
		for _, amount := range []int{20, 1000} {
			budget := statusDamageBudget{amount: amount, pvpScaled: inherited}
			w.spreadPoison(source, primary, budget, time.Now().Add(time.Minute))
			want := 13
			if inherited {
				want = 20
			}
			if amount == 1000 {
				want = 35
			}
			if target.PoisonDamage != want {
				t.Fatalf("inherited=%v amount=%d: spread=%d want=%d", inherited, amount, target.PoisonDamage, want)
			}
		}
	}
}

func TestPaidPoisonedFanSpreadKeepsInheritedPvPBudget(t *testing.T) {
	w, source, target := abilityDefenseDuel(t, "Rogue", "Fan of Knives", "")
	target.ArcaneShieldActive = false
	source.CritChanceBonus = 1
	source.ActiveSetBonuses = map[string]map[string]int{"spread": {"poisonSpread": 1}}
	source.SkillRunes = map[string]string{"Fan of Knives": "fanofknives_poisoned"}
	secondary := newTestPlayer("fan-spread-opponent", "Wizard")
	secondary.X, secondary.Z, secondary.InstanceID = target.X, target.Z+3, target.InstanceID
	w.AddEntity(secondary)
	// Prepared second opposing seat; the cast, projectile, spread and ticks
	// use ordinary code. This tests budget provenance, not queue admission.
	w.PvP.mu.Lock()
	match := w.PvP.Matches[w.PvP.MatchByPlayer[target.ID]]
	match.TeamB = append(match.TeamB, secondary.ID)
	w.PvP.MatchByPlayer[secondary.ID] = match.ID
	w.PvP.mu.Unlock()
	if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, "Fan of Knives"); !result.Accepted {
		t.Fatal("paid poisoned fan rejected")
	}
	advancePaidProjectileUntilHit(t, w, source, target)
	if target.PoisonDamage < 2 || secondary.PoisonDamage != target.PoisonDamage || secondary.PoisonSourceID != source.ID {
		t.Fatalf("spread scaled inherited PvP poison again: primary=%d secondary=%d", target.PoisonDamage, secondary.PoisonDamage)
	}
	before, budget := secondary.Health, secondary.PoisonDamage
	source.Stats.Dexterity, source.PoisonDamageBonus = 10000, 100
	w.updateEntity(secondary, .01, nil, &deferredActions{})
	if secondary.Health != before-budget {
		t.Fatal("spread tick rerolled its stored budget")
	}
}

func TestPaidMagmaSpreadUsesRecipientPvPBudget(t *testing.T) {
	for _, primaryPvP := range []bool{false, true} {
		t.Run(fmt.Sprint(primaryPvP), func(t *testing.T) {
			source := newTestPlayer("magma-budget-wizard", "Wizard")
			source.X, source.Z, source.Level, source.Stats.Intelligence = 50000, 50000, 100, 10
			source.UnlockedSkills = []string{"Fireball"}
			source.SkillRunes = map[string]string{"Fireball": "fireball_magma"}
			primary, secondary := newTestPlayer("magma-primary", "Wizard"), newTestPlayer("magma-secondary", "Wizard")
			primary.X, primary.Z, secondary.X, secondary.Z = 50002, 50000, 50002, 50003
			if primaryPvP {
				secondary.Type = TypeEnemy
			} else {
				primary.Type = TypeEnemy
			}
			w := newPvPTestWorld(source, primary, secondary)
			t.Cleanup(w.StopBackground)
			for _, p := range []*Entity{source, primary, secondary} {
				if p.Type == TypePlayer {
					if err := w.SetOpenWorldPvP(p.ID, true); err != nil {
						t.Fatal(err)
					}
				}
			}
			if result := w.PerformAbility(source.ID, primary.X, primary.Z, primary.ID, "Fireball"); !result.Accepted {
				t.Fatal("paid Magma fireball rejected")
			}
			advancePaidProjectileUntilHit(t, w, source, primary)
			want := 3 //PvE hit40 /6 =6, spread to a player becomes3.
			if primaryPvP {
				want = 4 //PvP hit26 /6 =4, inherited budget is not amplified for PvE.
			}
			if !secondary.Bleeding || secondary.BleedDamage != want {
				t.Fatalf("Magma copied wrong recipient budget: primaryPvP=%v wound=%d want=%d", primaryPvP, secondary.BleedDamage, want)
			}
		})
	}
}

func TestPaidMagmaWoundCannotCrossDungeonWall(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, source, beyond := directSkillWallFixture("Wizard", doorway)
			t.Cleanup(w.StopBackground)
			source.UnlockedSkills = []string{"Fireball"}
			source.SkillRunes = map[string]string{"Fireball": "fireball_magma"}
			primary := &Entity{ID: "magma-wall-primary", Type: TypeEnemy, InstanceID: source.InstanceID,
				X: source.X + .5, Z: source.Z, Health: 10000, MaxHealth: 10000, State: "IDLE"}
			w.AddEntity(primary)
			if result := w.PerformAbility(source.ID, primary.X, primary.Z, primary.ID, "Fireball"); !result.Accepted {
				t.Fatal("legal same-side paid Magma rejected")
			}
			advancePaidProjectileUntilHit(t, w, source, primary)
			if !primary.Bleeding || primary.BleedDamage <= 0 {
				t.Fatal("same-side Magma positive control failed")
			}
			if beyond.Bleeding != doorway {
				t.Fatalf("doorway=%v Magma crossed cover or failed to spread: bleed=%v", doorway, beyond.Bleeding)
			}
		})
	}
}
