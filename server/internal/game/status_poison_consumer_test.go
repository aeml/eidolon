package game

import (
	"math"
	"testing"
	"time"
)

func TestPoisonProjectilesActuallyTickOnEnemies(t *testing.T) {
	for _, skill := range []string{"Piercing Throw", "Fan of Knives", "Basic Attack"} {
		t.Run(skill, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("poison-caster", "Rogue")
			p.Level, p.Stats.Dexterity, p.Damage = 100, 20, 40
			p.X, p.Z, p.InstanceID = 60000, 60000, "dungeon_poison_consumer"
			p.UnlockedSkills = []string{"Poison Coating", skill}
			p.SkillRunes = map[string]string{"Fan of Knives": "fanofknives_poisoned"}
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: p.X, Z: p.Z, Width: 100, Height: 100}}}})
			w.AddEntity(p)
			target := &Entity{ID: "poison-target", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				X: p.X + 6, Z: p.Z, SpawnX: p.X + 6, SpawnZ: p.Z, Scale: 1, State: "IDLE", Health: 10000, MaxHealth: 10000}
			w.AddEntity(target)
			var ticks []DamageEvent
			w.OnEvent = func(kind string, payload interface{}) {
				if event, ok := payload.(DamageEvent); kind == "damage" && ok && event.Kind == "poison" {
					ticks = append(ticks, event)
				}
			}
			if skill != "Fan of Knives" {
				if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Poison Coating"); !result.Accepted {
					t.Fatal(result)
				}
				p.LastAbilityTime = time.Now().Add(-time.Second)
			}
			if skill == "Basic Attack" {
				if _, accepted := w.PerformAttack(p.ID, target.ID); !accepted {
					t.Fatal("ordinary coated attack rejected")
				}
				// Basic impacts are scheduled asynchronously; observe the normal
				// callback under the target lock, without invoking it ourselves.
				deadline := time.Now().Add(2 * time.Second)
				for time.Now().Before(deadline) {
					target.Mu.RLock()
					poisoned := target.Poisoned
					target.Mu.RUnlock()
					if poisoned {
						break
					}
					time.Sleep(time.Millisecond)
				}
			} else {
				if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
					t.Fatal(result)
				}
				var projectile *Entity
				for _, candidate := range w.Entities {
					if candidate.Type == TypeProjectile && candidate.OwnerID == p.ID && candidate.VelX > 0 && math.Abs(candidate.VelZ) < 1e-8 {
						projectile = candidate
						break
					}
				}
				if projectile == nil {
					t.Fatal("cast produced no forward projectile")
				}
				for step := 0; step < 30 && !target.Poisoned; step++ {
					w.updateEntity(projectile, .05, []*Entity{p}, &deferredActions{})
				}
			}
			if !target.Poisoned || target.PoisonSourceID != p.ID || target.PoisonDamage <= 0 || target.Health == 10000 {
				t.Fatal("ordinary projectile failed to apply poison")
			}
			before, damage := target.Health, target.PoisonDamage
			w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
			if target.Health != before-damage || len(ticks) != 1 || ticks[0].Amount != damage || ticks[0].SourceID != p.ID || ticks[0].InstanceID != p.InstanceID {
				t.Fatalf("poison flag did not become an attributed tick: health=%d before=%d damage=%d events=%+v", target.Health, before, damage, ticks)
			}
			w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
			if target.Health != before-damage || len(ticks) != 1 {
				t.Fatal("poison ticked twice within one second")
			}
			target.PoisonEndTime = time.Now().Add(-time.Second)
			w.updateEntity(target, .05, []*Entity{p}, &deferredActions{})
			if target.Poisoned || target.PoisonSourceID != "" || len(ticks) != 1 {
				t.Fatal("expired poison remained active or ticked")
			}
		})
	}
}

func TestPoisonSpreadRetainsBodyRangeAndRelationships(t *testing.T) {
	for _, mode := range []string{"inside", "outside", "friendly", "other-instance"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("spread-owner", "Rogue")
			p.X, p.Z = 50000, 50000
			w.AddEntity(p)
			primary := &Entity{ID: "spread-primary", Type: TypeEnemy, X: p.X, Z: p.Z, State: "IDLE"}
			w.AddEntity(primary)
			target := &Entity{ID: "spread-edge", Type: TypeEnemy, X: p.X, Z: p.Z, State: "IDLE", Health: 100, MaxHealth: 100, Scale: 4}
			target.X += 5 + entityVisualRadius(target) - .01
			if mode == "outside" {
				target.X += .02
			}
			if mode == "friendly" {
				target.Type = TypePlayer
			}
			if mode == "other-instance" {
				target.InstanceID = "dungeon_elsewhere"
			}
			w.AddEntity(target)
			w.spreadPoison(p, primary, 9, time.Now().Add(8*time.Second))
			if target.Poisoned != (mode == "inside") {
				t.Fatalf("incorrect spread outcome for %s", mode)
			}
		})
	}
}

func TestPoisonSpreadRespectsDungeonCover(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		w, p, target := directSkillWallFixture("Rogue", doorway)
		primary := &Entity{ID: "poison-primary", Type: TypeEnemy, InstanceID: p.InstanceID, X: p.X, Z: p.Z,
			Health: 10000, MaxHealth: 10000, State: "IDLE", Scale: 1}
		w.AddEntity(primary)
		w.spreadPoison(p, primary, 9, time.Now().Add(8*time.Second))
		if target.Poisoned != doorway {
			t.Fatalf("doorway=%v: poison spread=%v", doorway, target.Poisoned)
		}
	}
}
