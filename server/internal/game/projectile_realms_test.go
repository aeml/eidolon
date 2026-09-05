package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPlayerProjectilesTravelAndHitInEveryOverworldRealm(t *testing.T) {
	realms := []struct {
		name string
		x, z float64
	}{
		{"Earth", 200, 200}, {"Water", 200, -1800},
		{"Air entrance", 1010, 200}, {"Air far reaches", 2850, 200},
		{"Fire entrance", -1020, 200}, {"Fire far reaches", -2850, 200},
	}
	for _, realm := range realms {
		for _, class := range []string{"Wizard", "Rogue"} {
			t.Run(fmt.Sprintf("%s/%s", realm.name, class), func(t *testing.T) {
				w := newTestWorld()
				w.Entities = make(map[string]*Entity)
				w.Grid = NewSpatialMap(50)
				player := newTestPlayer("realm-caster", class)
				player.X, player.Z = realm.x, realm.z
				w.AddEntity(player)
				target := &Entity{ID: "realm-target", Type: TypeEnemy, X: realm.x + 12, Z: realm.z, Health: 10000, MaxHealth: 10000, Radius: 1, State: "IDLE", Scale: 1}
				w.AddEntity(target)
				skill := "Fireball"
				if class == "Rogue" {
					skill = "Piercing Throw"
				}
				if result := w.PerformAbility(player.ID, target.X, target.Z, target.ID, skill); !result.Accepted {
					t.Fatalf("cast rejected: %+v", result)
				}
				var projectile *Entity
				for _, entity := range w.Entities {
					if entity.Type == TypeProjectile {
						projectile = entity
						break
					}
				}
				if projectile == nil {
					t.Fatal("no projectile spawned")
				}
				for step := 0; step < 30 && target.Health == target.MaxHealth; step++ {
					deferred := &deferredActions{}
					w.updateEntity(projectile, 0.05, nil, deferred)
					if step == 0 && len(deferred.removals) > 0 {
						t.Fatalf("projectile culled immediately in %s", realm.name)
					}
					if len(deferred.removals) > 0 {
						break
					}
				}
				if target.Health == target.MaxHealth {
					t.Fatal("projectile never reached or damaged the enemy")
				}
			})
		}
	}
}

func TestProjectileOuterBoundsAndInstanceExemption(t *testing.T) {
	for _, instance := range []string{"", "dungeon-far-away"} {
		w := newTestWorld()
		projectile := &Entity{ID: "outside", Type: TypeProjectile, SubType: "Fireball", X: 3100, Z: 200, InstanceID: instance, CreatedAt: time.Now()}
		w.AddEntity(projectile)
		deferred := &deferredActions{}
		w.updateEntity(projectile, 0.05, nil, deferred)
		if removed := len(deferred.removals) > 0; removed != (instance == "") {
			t.Fatalf("instance=%q removed=%t", instance, removed)
		}
	}
}
