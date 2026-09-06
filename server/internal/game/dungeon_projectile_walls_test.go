package game

import (
	"encoding/json"
	"math"
	"testing"
)

func TestDungeonWallSegmentUnion(t *testing.T) {
	for _, test := range []struct {
		name                               string
		fromX, fromZ, toX, toZ, hitX, hitZ float64
		secondRoomX                        float64
		blocked                            bool
	}{
		{"inside", 0, 0, 9, 9, 9, 9, 30, false},
		{"wall", 0, 0, 15, 0, 10, 0, 30, true},
		{"reverse", 21, 0, 9, 0, 20, 0, 30, true},
		{"diagonal", 0, 0, 40, 40, 10, 10, 30, true},
		{"parallel boundary", 10, -8, 10, 8, 10, 8, 30, false},
		{"leaving boundary", 10, 0, 11, 0, 10, 0, 30, true},
		{"stationary", 5, 5, 5, 5, 5, 5, 30, false},
		{"outside start", 15, 0, 21, 0, 15, 0, 30, true},
		{"touching rooms", 0, 0, 29, 0, 29, 0, 20, false},
		{"overlap", 0, 0, 28, 0, 28, 0, 19, false},
		{"thin wall", 9, 0, 11, 0, 10, 0, 20.0001, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			for _, offset := range []float64{0, 60000} {
				w := newTestWorld()
				w.storeDungeonInstance("dungeon_segment", &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{
					{X: offset + test.secondRoomX, Z: offset, Width: 20, Height: 20}, // Deliberately unsorted.
					{X: offset, Z: offset, Width: 20, Height: 20},
				}}})
				x, z, blocked := w.firstDungeonWallHit("dungeon_segment", offset+test.fromX, offset+test.fromZ, offset+test.toX, offset+test.toZ)
				if blocked != test.blocked || math.Abs(x-offset-test.hitX) > 1e-6 || math.Abs(z-offset-test.hitZ) > 1e-6 {
					t.Fatalf("offset %v: got (%v,%v,%v), want (%v,%v,%v)", offset, x-offset, z-offset, blocked, test.hitX, test.hitZ, test.blocked)
				}
			}
		})
	}
}

func BenchmarkDungeonProjectileRoomStep(b *testing.B) {
	w := &World{InstanceLayouts: map[string]*DungeonInstance{"dungeon_bench": {Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: 30000, Z: 20000, Width: 100, Height: 100}}}}}}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _, blocked := w.firstDungeonWallHit("dungeon_bench", 30000, 20000, 30001, 20000)
		if blocked {
			b.Fatal("interior step was blocked")
		}
	}
}

func TestDungeonProjectilesStopAtWallsButPassThroughDoorways(t *testing.T) {
	for _, class := range []string{"Wizard", "Rogue"} {
		for _, doorway := range []bool{false, true} {
			for _, largeStep := range []bool{false, true} {
				name := class + "/wall"
				if doorway {
					name = class + "/doorway"
				}
				if largeStep {
					name += "/large-step"
				}
				t.Run(name, func(t *testing.T) {
					const origin = 30000.0
					w := newTestWorld()
					instanceID := "dungeon_projectile_wall"
					// Two rooms have a legal route around the gap, not through the
					// solid walls between them. Both shot endpoints are on floors.
					rects := []DungeonWalkRect{
						{X: origin, Z: origin, Width: 20, Height: 20},
						{X: origin + 30, Z: origin, Width: 20, Height: 20},
						{X: origin, Z: origin + 15, Width: 6, Height: 36},
						{X: origin + 15, Z: origin + 30, Width: 36, Height: 6},
						{X: origin + 30, Z: origin + 15, Width: 6, Height: 36},
					}
					if doorway {
						rects = append(rects, DungeonWalkRect{X: origin + 15, Z: origin, Width: 12, Height: 6})
					}
					w.storeDungeonInstance(instanceID, &DungeonInstance{ID: instanceID, Layout: DungeonLayout{WalkRects: rects}})
					player := newTestPlayer("wall-caster", class)
					player.InstanceID, player.X, player.Z = instanceID, origin+9, origin
					w.AddEntity(player)
					target := &Entity{ID: "wall-target", Type: TypeEnemy, InstanceID: instanceID, X: origin + 21, Z: origin,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1}
					w.AddEntity(target)
					skill := "Fireball"
					if class == "Rogue" {
						skill = "Piercing Throw"
					}
					result := w.PerformAbility(player.ID, target.X, target.Z, target.ID, skill)
					if !result.Accepted {
						t.Fatalf("legal shot was rejected: %+v", result)
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
					var impacts []ProjectileImpactEvent
					w.OnEvent = func(kind string, value interface{}) {
						if kind == "projectile_impact" {
							impacts = append(impacts, value.(ProjectileImpactEvent))
							// Impact callbacks must not retain the projectile lock.
							w.GetEntityCopy(projectile.ID)
						}
					}
					dt := 0.05
					if largeStep {
						dt = (target.X - player.X) / math.Hypot(projectile.VelX, projectile.VelZ)
					}
					removed := false
					for step := 0; step < 60 && !removed && target.Health == target.MaxHealth; step++ {
						deferred := &deferredActions{}
						w.updateEntity(projectile, dt, nil, deferred)
						removed = len(deferred.removals) > 0
					}
					if doorway {
						if target.Health == target.MaxHealth {
							t.Fatal("open doorway blocked a legal projectile")
						}
					} else {
						if target.Health != target.MaxHealth {
							t.Fatal("projectile crossed a solid dungeon wall")
						}
						if !removed {
							t.Fatal("wall impact did not terminate the projectile")
						}
						if len(impacts) != 1 || !impacts[0].Terminal || impacts[0].TargetID != "" || math.Abs(impacts[0].X-origin-10) > 1e-6 || impacts[0].Radius != 0 {
							t.Fatalf("wall impact did not describe the actual boundary/no damage footprint: %+v", impacts)
						}
						encoded, err := json.Marshal(impacts[0])
						if err != nil {
							t.Fatal(err)
						}
						var wire map[string]interface{}
						if err := json.Unmarshal(encoded, &wire); err != nil {
							t.Fatal(err)
						}
						if value, exists := wire["radius"]; !exists || value != float64(0) {
							t.Fatal("wire omitted the authoritative zero damage radius")
						}
					}
				})
			}
		}
	}
}
