package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidEnemyVulnerabilityAndArmorDebuffsExpire(t *testing.T) {
	for _, tc := range []struct {
		class, skill string
		mark         float64
	}{
		{"Cleric", "Mark of Weakness", .2},
		{"Cleric", "Heaven's Trumpet", .5},
		{"Wizard", "Scorch Beam", 0},
		{"Fighter", "Shattering Charge", 0},
	} {
		for _, stunned := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/stunned%v", tc.skill, stunned), func(t *testing.T) {
				w, source, target, _ := rawWoundOutgoingFixture(t, "lunge")
				source.SubType, source.UnlockedSkills, source.CritChanceBonus = tc.class, []string{tc.skill}, 0
				source.Stats.Wisdom, source.Stats.Intelligence = 50, 50
				mana := source.Mana
				if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, tc.skill); !result.Accepted || source.Mana >= mana {
					t.Fatalf("ordinary paid cast failed: %+v", result)
				}
				if tc.skill == "Shattering Charge" {
					for step := 0; step < 20 && source.IsCharging; step++ {
						w.updateEntity(source, .05, nil, &deferredActions{})
					}
					if source.IsCharging {
						t.Fatal("actual charge did not land")
					}
				}
				if tc.mark > 0 {
					if !target.MarkWeakness || target.MarkWeaknessFactor != tc.mark {
						t.Fatal("actual vulnerability was not applied")
					}
				} else if target.ArmorReduction != 5 {
					t.Fatal("actual armor break was not applied")
				}
				if tc.skill != "Mark of Weakness" && target.Health >= target.MaxHealth {
					t.Fatal("damaging cast/impact did not hit")
				}
				target.Stunned = stunned
				target.StunEndTime = time.Now().Add(time.Minute)
				w.updateEntity(target, 0, nil, &deferredActions{})
				if tc.mark > 0 && !target.MarkWeakness || tc.mark == 0 && target.ArmorReduction != 5 {
					t.Fatal("active debuff expired early")
				}
				var beforeView *Entity
				if tc.mark > 0 {
					beforeView = w.GetStateForPlayer(source.ID, 200)[target.ID]
					if beforeView == nil || !beforeView.MarkWeakness {
						t.Fatal("active vulnerability missing from observer snapshot")
					}
				}
				target.MarkWeaknessEndTime = time.Now().Add(-time.Second)
				target.ArmorReductionEndTime = time.Now().Add(-time.Second)
				w.updateEntity(target, 0, nil, &deferredActions{})
				if target.MarkWeakness || target.MarkWeaknessFactor != 0 || target.ArmorReduction != 0 {
					t.Fatalf("expired enemy debuff retained: mark=%v factor=%v armor=%d", target.MarkWeakness, target.MarkWeaknessFactor, target.ArmorReduction)
				}
				if beforeView != nil {
					afterView := w.GetStateForPlayer(source.ID, 200)[target.ID]
					if afterView == nil || afterView.MarkWeakness || afterView.MarkWeaknessFactor != 0 || !afterView.MarkWeaknessEndTime.IsZero() {
						t.Fatal("observer snapshot retained expired vulnerability")
					}
					if !beforeView.MarkWeakness {
						t.Fatal("snapshot aliases mutable target status")
					}
				}
			})
		}
	}
}

func TestExpiredEnemyDebuffNoLongerAmplifiesActualAttack(t *testing.T) {
	for _, skill := range []string{"Mark of Weakness", "Scorch Beam"} {
		for _, expired := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/expired%v", skill, expired), func(t *testing.T) {
				w, source, target, _ := rawWoundOutgoingFixture(t, "lunge")
				source.SubType, source.UnlockedSkills, source.CritChanceBonus = "Cleric", []string{skill}, 0
				if skill == "Scorch Beam" {
					source.SubType = "Wizard"
				}
				if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
					t.Fatal("paid debuff cast rejected")
				}
				if expired {
					target.MarkWeaknessEndTime = time.Now().Add(-time.Second)
					target.ArmorReductionEndTime = time.Now().Add(-time.Second)
				}
				w.updateEntity(target, 0, nil, &deferredActions{})
				source.Damage, target.Defense = 100, 50
				before := target.Health
				if _, accepted := w.PerformAttack(source.ID, target.ID); !accepted {
					t.Fatal("ordinary attack rejected")
				}
				w.backgroundWork.SealWhenIdle()
				want := 50
				if !expired {
					want = 60 //50 after defense, then the actual20% mark.
					if skill == "Scorch Beam" {
						want = 55
					} //Five-point armor break.
				}
				if got := before - target.Health; got != want {
					t.Fatalf("ordinary post-debuff impact=%d want=%d", got, want)
				}
			})
		}
	}
}

func TestTargetDebuffExpiryClearsExactAndMissingDeadlines(t *testing.T) {
	now := time.Now()
	for _, deadline := range []time.Time{now.Add(time.Second), now, now.Add(-time.Second), {}} {
		target := &Entity{MarkWeakness: true, MarkWeaknessFactor: .2, MarkWeaknessEndTime: deadline, ArmorReduction: 5, ArmorReductionEndTime: deadline}
		expireTargetDebuffsLocked(target, now)
		active := deadline.After(now)
		if target.MarkWeakness != active || (target.ArmorReduction > 0) != active {
			t.Fatal("incorrect target debuff deadline boundary")
		}
		if !active && (target.MarkWeaknessFactor != 0 || !target.MarkWeaknessEndTime.IsZero() || !target.ArmorReductionEndTime.IsZero()) {
			t.Fatal("expired target modifiers or deadlines retained")
		}
	}
}
