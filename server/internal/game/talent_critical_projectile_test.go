package game

import (
	"fmt"
	"math/rand"
	"os"
	"testing"
)

func TestTalentedCriticalChanceRealProjectiles(t *testing.T) {
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	for _, tc := range []struct{ skill, talent string }{
		{"Piercing Throw", "ROG_02"}, {"Fan of Knives", "ROG_12"},
		{"Blade Storm", "ROG_16"}, {"Phantom Volley", "ROG_18"},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			baseline := 0
			for _, build := range []struct {
				name, talent string
				rank         int
			}{
				{"baseline", tc.talent, 0}, {"one", tc.talent, 1},
				{"five", tc.talent, 5}, {"unrelated Backstab", "ROG_04", 5},
			} {
				t.Run(build.name, func(t *testing.T) {
					w := newTestWorld()
					w.Entities, w.Grid = make(map[string]*Entity), NewSpatialMap(50)
					p := newTestPlayer("critical-projectile-caster", "Rogue")
					p.Level, p.InstanceID, p.UnlockedSkills = 100, "qa-critical-projectile", []string{tc.skill}
					p.TalentRanks, p.CritChanceBonus = map[string]int{build.talent: build.rank}, .60
					w.AddEntity(p)
					target := &Entity{ID: "critical-projectile-target", Type: TypeEnemy, InstanceID: p.InstanceID,
						X: 8, Health: 10000, MaxHealth: 10000, Radius: 1, Scale: 1, State: "IDLE"}
					w.AddEntity(target)
					mana := p.Mana
					if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill); !result.Accepted || p.Mana >= mana {
						t.Fatalf("paid projectile cast failed: %+v mana=%d before=%d", result, p.Mana, mana)
					}
					var projectiles []*Entity
					for _, entity := range w.Entities {
						if entity.Type == TypeProjectile {
							if entity.ProjectileSkill != tc.skill {
								t.Fatalf("projectile lost skill identity: %+v", entity.ProjectileSkill)
							}
							projectiles = append(projectiles, entity)
						}
					}
					if len(projectiles) == 0 {
						t.Fatal("accepted cast did not create a projectile")
					}
					removed := make(map[string]bool)
					for step := 0; step < 80 && target.Health == target.MaxHealth; step++ {
						for _, projectile := range projectiles {
							if removed[projectile.ID] {
								continue
							}
							// Reset the real RNG at each update so the first actual hit
							// uses the same roll regardless of flight time or projectile order.
							rand.Seed(1)
							deferred := &deferredActions{}
							w.updateEntity(projectile, .05, nil, deferred)
							for _, id := range deferred.removals {
								removed[id] = true
							}
							if target.Health < target.MaxHealth {
								break
							}
						}
					}
					damage := target.MaxHealth - target.Health
					if damage <= 0 {
						t.Fatal("normal projectile updates never hit the target")
					}
					if build.name == "baseline" {
						baseline = damage
					}
					want := baseline
					if build.talent == tc.talent && build.rank > 0 {
						want *= 2
					}
					if damage != want {
						t.Fatalf("%s damage=%d want=%d", fmt.Sprint(build), damage, want)
					}
				})
			}
		})
	}
}
