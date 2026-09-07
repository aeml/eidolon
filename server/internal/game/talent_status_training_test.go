package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

// Exercise paid status applications and the target's real periodic consumer.
// A talent definition alone is not proof that the resulting wound uses it.
func TestStatusMasteryActualApplicationsAndTicks(t *testing.T) {
	for _, tc := range []struct{ skill, talent, kind, delivery string }{
		{"Shadow Lunge", "ROG_07", "bleed", ""},
		{"Serrated Edges", "ROG_13", "bleed", "Piercing Throw"},
		{"Serrated Edges", "ROG_13", "bleed", "Fan of Knives"},
		{"Poison Coating", "ROG_21", "poison", "Piercing Throw"},
		{"Poison Coating", "ROG_21", "poison", "Basic Attack"},
	} {
		t.Run(tc.skill+"/"+tc.delivery, func(t *testing.T) {
			baseline := 0
			for _, build := range []struct {
				name      string
				rank      int
				unrelated bool
				generic   bool
			}{
				{"baseline", 0, false, false}, {"rank1", 1, false, false}, {"rank5", 5, false, false}, {"unrelated", 5, true, false},
				{"generic", 0, false, true}, {"combined", 5, false, true},
			} {
				t.Run(build.name, func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("status-training-caster", "Rogue")
					p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_status_training"
					p.Stats.Dexterity, p.Damage, p.CritChanceBonus = 180, 100, 0
					p.UnlockedSkills = []string{tc.skill, tc.delivery}
					p.TalentRanks = map[string]int{tc.talent: build.rank}
					if build.unrelated {
						p.TalentRanks = map[string]int{"ROG_03": build.rank}
					}
					if build.generic {
						p.TalentRanks["ROG_38"] = 5
					}
					w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 100, Height: 100}}}})
					w.AddEntity(p)
					target := &Entity{ID: "status-training-target", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
						X: p.X + 6, Z: p.Z, SpawnX: p.X + 6, SpawnZ: p.Z, Scale: 1, State: "IDLE", Health: 10000, MaxHealth: 10000}
					w.AddEntity(target)
					var ticks []DamageEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(DamageEvent); kind == "damage" && ok && event.Kind == tc.kind {
							ticks = append(ticks, event)
						}
					}
					beforeMana := p.Mana
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill)
					if !result.Accepted || p.Mana >= beforeMana {
						t.Fatalf("paid setup failed: %+v", result)
					}
					if tc.delivery == "Basic Attack" {
						if _, accepted := w.PerformAttack(p.ID, target.ID); !accepted {
							t.Fatal("ordinary coated attack rejected")
						}
						deadline := time.Now().Add(2 * time.Second)
						for time.Now().Before(deadline) {
							target.Mu.RLock()
							applied := target.Poisoned
							target.Mu.RUnlock()
							if applied {
								break
							}
							time.Sleep(time.Millisecond)
						}
					} else if tc.delivery != "" {
						p.LastAbilityTime = time.Now().Add(-time.Second)
						beforeMana = p.Mana
						result = w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.delivery)
						if !result.Accepted || p.Mana >= beforeMana {
							t.Fatalf("paid projectile failed: %+v", result)
						}
						for step := 0; step < 30 && target.Health == target.MaxHealth; step++ {
							for _, e := range w.Entities {
								if e.Type == TypeProjectile && e.OwnerID == p.ID {
									w.updateEntity(e, .05, nil, &deferredActions{})
								}
							}
						}
						if target.Health == target.MaxHealth {
							t.Fatal("actual projectile never hit")
						}
					}
					target.Mu.RLock()
					amount, source := target.BleedDamage, target.BleedSourceID
					directDamage := target.MaxHealth - target.Health
					if tc.kind == "poison" {
						amount, source = target.PoisonDamage, target.PoisonSourceID
					}
					target.Mu.RUnlock()
					if amount <= 0 || source != p.ID {
						t.Fatalf("no attributed status: amount=%d source=%s", amount, source)
					}
					if build.name == "baseline" {
						baseline = amount
					}
					want := baseline
					if !build.unrelated {
						bonus := .04 * float64(build.rank)
						if build.generic && tc.skill != "Serrated Edges" {
							bonus += .1
						}
						base := baseline
						if tc.skill == "Serrated Edges" {
							base = directDamage / 5
						}
						want = int(math.Floor(float64(base)*(1+bonus) + 1e-9))
					}
					if amount != want {
						t.Errorf("%s rank %d tick snapshot=%d want=%d", tc.skill, build.rank, amount, want)
					}
					// The wound is already applied. Later gear/training changes must
					// not multiply its snapshotted damage again on every tick.
					p.Mu.Lock()
					p.TalentRanks = map[string]int{tc.talent: 5}
					p.Mu.Unlock()
					beforeHP := target.Health
					w.updateEntity(target, .05, nil, &deferredActions{})
					if target.Health != beforeHP-amount || len(ticks) != 1 || ticks[0].Amount != amount || ticks[0].SourceID != p.ID {
						t.Fatalf("real tick differs from application: %s", fmt.Sprint(ticks))
					}
				})
			}
		})
	}
}
