package game

import (
	"math/rand"
	"os"
	"testing"
	"time"
)

func rawWoundOutgoingFixture(t *testing.T, delivery string) (*World, *Entity, *Entity, func()) {
	t.Helper()
	source := newTestPlayer("raw-wound-source", "Rogue")
	source.Level, source.X, source.Z, source.InstanceID = 100, 50000, 50000, "raw-wound-outgoing"
	source.Stats.Dexterity, source.CritChanceBonus = 180, .55
	source.UnlockedSkills = []string{"Shadow Lunge", "Poison Coating", "Piercing Throw"}
	source.AttackCooldown = 100 * time.Millisecond
	w := newPvPTestWorld(source)
	t.Cleanup(w.StopBackground)
	target := &Entity{ID: "raw-wound-target", Type: TypeEnemy, InstanceID: source.InstanceID,
		X: source.X + 2, Z: source.Z, Health: 10000, MaxHealth: 10000, State: "IDLE"}
	w.AddEntity(target)
	apply := func() {
		if delivery == "lunge" {
			if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, "Shadow Lunge"); !result.Accepted {
				t.Fatal("paid Shadow Lunge rejected")
			}
			return
		}
		if result := w.PerformAbility(source.ID, source.X, source.Z, "", "Poison Coating"); !result.Accepted {
			t.Fatal("paid Poison Coating rejected")
		}
		if delivery == "basic" {
			if _, accepted := w.PerformAttack(source.ID, target.ID); !accepted {
				t.Fatal("coated ordinary attack rejected")
			}
			w.backgroundWork.SealWhenIdle()
			return
		}
		source.LastAbilityTime = time.Now().Add(-time.Second)
		if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, "Piercing Throw"); !result.Accepted {
			t.Fatal("coated projectile rejected")
		}
		advancePaidProjectileUntilHit(t, w, source, target)
	}
	return w, source, target, apply
}

func TestPaidRawWoundCriticalTechniqueChangesActualApplication(t *testing.T) {
	// Use the same explicit deterministic global-RNG fixture as ordinary
	// critical composition tests; do not substitute a damage implementation.
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	for _, delivery := range []string{"lunge", "basic", "projectile"} {
		for _, build := range []string{"baseline", "trained", "unrelated"} {
			t.Run(delivery+"/"+build, func(t *testing.T) {
				_, source, target, apply := rawWoundOutgoingFixture(t, delivery)
				talent, nthRoll, base := "ROG_22", 1, 98
				if delivery == "lunge" {
					talent, nthRoll, base = "ROG_08", 0, 100
				}
				if build == "trained" {
					source.TalentRanks = map[string]int{talent: 5}
				} else if build == "unrelated" {
					source.TalentRanks = map[string]int{"ROG_10": 5}
				}
				// Coated delivery first rolls its direct hit; the separate raw
				// wound's roll must cross .55 only with its own +.10 Technique.
				seed := int64(0)
				for ; seed < 1000; seed++ {
					rng := rand.New(rand.NewSource(seed))
					roll := rng.Float64()
					for i := 0; i < nthRoll; i++ {
						roll = rng.Float64()
					}
					if roll > .55 && roll < .65 {
						break
					}
				}
				if seed == 1000 {
					t.Fatal("could not construct the critical threshold fixture")
				}
				rand.Seed(seed)
				apply()
				got, want := target.PoisonDamage, base
				if delivery == "lunge" {
					got = target.BleedDamage
				}
				if build == "trained" {
					want *= 2
				}
				if got != want {
					t.Fatalf("raw wound ignored its critical Technique: got=%d want=%d seed=%d", got, want, seed)
				}
			})
		}
	}
}

func TestPaidCoatingSnapshotsPoisonDamageBonusOnce(t *testing.T) {
	for _, delivery := range []string{"basic", "projectile"} {
		t.Run(delivery, func(t *testing.T) {
			w, source, target, apply := rawWoundOutgoingFixture(t, delivery)
			source.CritChanceBonus, source.PoisonDamageBonus = 0, .5
			apply()
			if target.PoisonDamage != 147 { //98 raw *1.5 poison bonus.
				t.Fatalf("paid coating ignored poison bonus: got=%d want=147", target.PoisonDamage)
			}
			before := target.Health
			source.PoisonDamageBonus, source.CritChanceBonus = 10, 1
			w.updateEntity(target, .01, nil, &deferredActions{})
			if target.Health != before-147 {
				t.Fatal("stored poison rerolled outgoing damage on tick")
			}
		})
	}
}

func TestPaidRawWoundOutgoingComposition(t *testing.T) {
	for _, delivery := range []string{"lunge", "basic", "projectile"} {
		for _, modifier := range []string{"critical", "executioner", "fortress-set", "mark", "combined-training"} {
			t.Run(delivery+"/"+modifier, func(t *testing.T) {
				w, source, target, apply := rawWoundOutgoingFixture(t, delivery)
				source.CritChanceBonus = 0
				want := 98
				if delivery == "lunge" {
					want = 100
				}
				switch modifier {
				case "critical":
					source.CritChanceBonus = 1
					want *= 2
				case "executioner":
					source.ActiveUniqueEffects = []string{"executioner"}
					target.Health = target.MaxHealth / 4
					want = want * 125 / 100
				case "fortress-set":
					source.IronFortressActive = true
					source.IronFortressEndTime = time.Now().Add(time.Minute)
					source.ActiveSetBonuses = map[string]map[string]int{"fortress": {"ironFortressDamage": 100}}
					want *= 2
				case "mark":
					target.MarkWeakness, target.MarkWeaknessFactor = true, .2
					target.MarkWeaknessEndTime = time.Now().Add(time.Minute)
					want = want * 120 / 100
				case "combined-training":
					talent := "ROG_21"
					if delivery == "lunge" {
						talent = "ROG_07"
					}
					source.TalentRanks = map[string]int{talent: 5, "ROG_38": 5}
					source.CritChanceBonus, source.PoisonDamageBonus = 1, .5
					want = want * 130 / 100 * 2
					if delivery != "lunge" {
						want = want * 150 / 100
					}
				}
				apply()
				got := target.PoisonDamage
				if delivery == "lunge" {
					got = target.BleedDamage
				}
				if got != want {
					t.Fatalf("raw outgoing composition got=%d want=%d", got, want)
				}
				before := target.Health
				source.CritChanceBonus, source.PoisonDamageBonus = 1, 10
				target.MarkWeakness = false
				w.updateEntity(target, .01, nil, &deferredActions{})
				if target.Health != before-want {
					t.Fatal("tick recalculated its outgoing snapshot")
				}
			})
		}
	}
}

func TestPaidRawWoundCriticalStillRespectsPvPBudget(t *testing.T) {
	for _, skill := range []string{"Shadow Lunge", "Poison Coating"} {
		t.Run(skill, func(t *testing.T) {
			w, source, target := abilityDefenseDuel(t, "Rogue", skill, "")
			target.ArcaneShieldActive = false
			source.Stats.Dexterity, source.CritChanceBonus, source.PoisonDamageBonus = 180, 1, .5
			if result := w.PerformAbility(source.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
				t.Fatal("paid raw-wound cast rejected")
			}
			want := 130 //100 raw *2 ordinary critical *.65 PvP.
			got := target.BleedDamage
			if skill == "Poison Coating" {
				source.AttackCooldown = 100 * time.Millisecond
				if _, accepted := w.PerformAttack(source.ID, target.ID); !accepted {
					t.Fatal("coated ordinary attack rejected")
				}
				w.backgroundWork.SealWhenIdle()
				got, want = target.PoisonDamage, 175 //98*2*1.5*.65 capped to35% of500HP.
			}
			if got != want {
				t.Fatalf("critical wound bypassed PvP scaling/cap: got=%d want=%d", got, want)
			}
		})
	}
}

func TestPaidRawCoatingSpreadAppliesOutgoingPerRecipient(t *testing.T) {
	for _, delivery := range []string{"basic", "projectile"} {
		t.Run(delivery, func(t *testing.T) {
			w, source, primary, apply := rawWoundOutgoingFixture(t, delivery)
			source.CritChanceBonus, source.PoisonDamageBonus = 1, .5
			source.ActiveSetBonuses = map[string]map[string]int{"poison-set": {"poisonSpread": 1}}
			secondary := &Entity{ID: "marked-spread-target", Type: TypeEnemy, InstanceID: source.InstanceID,
				X: primary.X, Z: primary.Z + 2, Health: 10000, MaxHealth: 10000, State: "IDLE",
				MarkWeakness: true, MarkWeaknessFactor: .5, MarkWeaknessEndTime: time.Now().Add(time.Minute)}
			w.AddEntity(secondary)
			apply()
			if primary.PoisonDamage != 294 || secondary.PoisonDamage != 441 {
				t.Fatalf("spread reused or doubled primary outgoing effects: primary=%d secondary=%d", primary.PoisonDamage, secondary.PoisonDamage)
			}
			source.CritChanceBonus, source.PoisonDamageBonus = 0, 10
			secondary.MarkWeakness = false
			before := secondary.Health
			w.updateEntity(secondary, .01, nil, &deferredActions{})
			if secondary.Health != before-441 {
				t.Fatal("spread tick reread outgoing modifiers")
			}
		})
	}
}
