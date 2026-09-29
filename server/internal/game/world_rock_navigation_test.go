package game

import (
	"math"
	"testing"
	"time"
)

func newRockWorldForTest(t *testing.T) *World {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	// Exercise real consumers without random ambient spawns crossing the shot
	// or acquiring the fixture player. This changes test data only.
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50)
	return w
}

func TestRockNavigationAcrossJoinedFormations(t *testing.T) {
	w := &World{rockSolids: rockSolidsForTest(t)}
	for _, center := range []rockPoint{{-102, -321}, {62, -307}, {-111, -210}, {390, 155}, {590, 251}, {690, 142}} {
		for _, radius := range []float64{.8, 1.25, 3.75} {
			for direction := 0; direction < 16; direction++ {
				angle := float64(direction) * math.Pi / 8
				start := rockPoint{center.X + 30*math.Cos(angle), center.Z + 30*math.Sin(angle)}
				goal := rockPoint{center.X - 30*math.Cos(angle), center.Z - 30*math.Sin(angle)}
				e := &Entity{Type: TypeEnemy, X: start.X, Z: start.Z, BodyRadius: radius}
				now := time.Now()
				arrived := false
				for step := 0; step < 300; step++ {
					point := w.rockNavigationTarget(e, goal, now.Add(time.Duration(step)*50*time.Millisecond))
					dx, dz := point.X-e.X, point.Z-e.Z
					distance := math.Hypot(dx, dz)
					if distance > .5 {
						dx, dz = dx*.5/distance, dz*.5/distance
					}
					old := rockPoint{e.X, e.Z}
					e.X, e.Z = w.constrainRockStep(e, e.X+dx, e.Z+dz)
					if insideRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, radius) || math.Hypot(e.X-old.X, e.Z-old.Z) > .501 {
						t.Fatalf("route entered solid or teleported: radius=%v angle=%v", radius, direction)
					}
					if math.Hypot(e.X-goal.X, e.Z-goal.Z) < .01 {
						arrived = true
						break
					}
				}
				if !arrived {
					t.Fatalf("route stalled: radius=%v angle=%v at %v,%v", radius, direction, e.X, e.Z)
				}
			}
		}
	}
}

func TestRockNavigationRefreshesMovedTargetsAndBodySize(t *testing.T) {
	w := &World{rockSolids: rockSolidsForTest(t)}
	e := &Entity{Type: TypeEnemy, X: -102, Z: -337}
	goal, now := rockPoint{-102, -305}, time.Now()
	w.rockNavigationTarget(e, goal, now)
	if len(e.rockRoute) == 0 {
		t.Fatal("expected cached detour")
	}
	first := &e.rockRoute[0]
	w.rockNavigationTarget(e, goal, now.Add(time.Millisecond))
	if &e.rockRoute[0] != first {
		t.Fatal("unchanged chase replanned unnecessarily")
	}
	goal.X += 5
	w.rockNavigationTarget(e, goal, now.Add(2*time.Millisecond))
	if e.rockRouteGoal != goal {
		t.Fatal("moving target retained obsolete route")
	}
	e.BodyRadius = 3.75
	w.rockNavigationTarget(e, goal, now.Add(3*time.Millisecond))
	if e.rockRouteRadius != 3.75 {
		t.Fatal("size change retained narrow route")
	}
	clear := rockPoint{-102, -350}
	if w.rockNavigationTarget(e, clear, now) != clear || len(e.rockRoute) != 0 {
		t.Fatal("clear chase failed to resume direct steering")
	}
}

func TestRockEnemyChaseRoamAndRespawn(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-ai-player", "Fighter")
	p.X, p.Z = -102, -305
	w.AddEntity(p)
	for _, chase := range []bool{false, true} {
		e := &Entity{ID: "rock-ai", Type: TypeEnemy, SubType: "Skeleton", Level: 30,
			X: -102, Z: -337, SpawnX: -102, SpawnZ: -320, TargetX: p.X, TargetZ: p.Z,
			Health: 100, MaxHealth: 100, Speed: 8, State: "IDLE", AttackCooldown: time.Second}
		w.AddEntity(e)
		var players []*Entity
		if chase {
			players = []*Entity{p}
		}
		arrived := false
		for step := 0; step < 160; step++ {
			old := rockPoint{e.X, e.Z}
			w.updateEntity(e, .05, players, &deferredActions{})
			if insideRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, e.ReplicatedBodyRadius()) || math.Hypot(e.X-old.X, e.Z-old.Z) > .401 {
				t.Fatalf("AI crossed rock/teleported (chase=%v)", chase)
			}
			if math.Hypot(e.X-p.X, e.Z-p.Z) < 3 {
				arrived = true
				break
			}
		}
		if !arrived {
			t.Fatalf("AI failed to round rock (chase=%v) at %v,%v", chase, e.X, e.Z)
		}
		e.State, e.Health, e.LastAttackTime = "DEAD", 0, time.Now().Add(-20*time.Second)
		w.updateEntity(e, .05, nil, &deferredActions{})
		if e.State == "DEAD" || insideRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, e.ReplicatedBodyRadius()) {
			t.Fatal("respawn retained invalid inside-rock position")
		}
	}
}

func TestRockAttacksRespectCoverAndSceneOwnership(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-caster", "Wizard")
	p.X, p.Z = -102, -328
	e := &Entity{ID: "rock-target", Type: TypeEnemy, X: -102, Z: -314, Health: 100, MaxHealth: 100, State: "IDLE"}
	w.AddEntity(p)
	w.AddEntity(e)
	if !w.rockLineBlocked("", rockPoint{p.X, p.Z}, rockPoint{e.X, e.Z}) {
		t.Fatal("test line does not cross formation")
	}
	if _, accepted := w.PerformAttack(p.ID, e.ID); accepted || !p.LastAttackTime.IsZero() {
		t.Fatal("basic attack through rock admitted/consumed cooldown")
	}
	if validDirectAbilityTarget(w, p, e, 50, TypeEnemy) || w.validDungeonGroundCastTarget(p, e.X, e.Z) {
		t.Fatal("hostile direct/ground cast bypassed rock")
	}
	w.applyAttackImpact(p.ID, e.ID, "", nil, 0)
	if e.Health != 100 {
		t.Fatal("moving behind rock during wind-up did not prevent impact")
	}
	p.InstanceID, e.InstanceID = "test-instance", "test-instance"
	if !validDirectAbilityTarget(w, p, e, 50, TypeEnemy) || !w.validDungeonGroundCastTarget(p, e.X, e.Z) {
		t.Fatal("overworld rocks blocked instance casts")
	}
	goal := rockPoint{e.X, e.Z}
	if w.rockNavigationTarget(p, goal, time.Now()) != goal {
		t.Fatal("overworld routing affected instance")
	}
	p.InstanceID, e.InstanceID, w.rockSolids = "", "", nil
	if !validDirectAbilityTarget(w, p, e, 50, TypeEnemy) {
		t.Fatal("inactive candidate blocked combat")
	}
}

func TestRockMovementUsesReplicatedBodyRadius(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-wide", "Fighter")
	p.X, p.Z, p.BodyRadius = -102, -345, 3.75
	w.AddEntity(p)
	w.UpdatePlayerMovement(p.ID, -102, 0, -290, 0, "MOVING", 1)
	if insideRockSolids(w.rockSolids, rockPoint{p.X, p.Z}, p.BodyRadius) || p.Z > -328.75 {
		t.Fatal("server movement ignored replicated body size")
	}
}

func TestRockProjectilesStopAtActualFace(t *testing.T) {
	for _, class := range []string{"Wizard", "Rogue"} {
		for _, bounded := range []bool{false, true} {
			for _, dt := range []float64{.05, .8} {
				w := newRockWorldForTest(t)
				w.rockSolids = rockSolidsForTest(t)
				p := newTestPlayer("rock-shot", class)
				p.X, p.Z = -102, -328
				w.AddEntity(p)
				target := &Entity{ID: "rock-hidden", Type: TypeEnemy, X: -102, Z: -314, State: "IDLE", Health: 1000, MaxHealth: 1000}
				w.AddEntity(target)
				skill := "Fireball"
				if class == "Rogue" {
					skill = "Piercing Throw"
				}
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill)
				if !result.Accepted {
					t.Fatalf("projectile launch rejected: %+v", result)
				}
				var shot *Entity
				for _, entity := range w.Entities {
					if entity.Type == TypeProjectile && entity.OwnerID == p.ID {
						shot = entity
						break
					}
				}
				if shot == nil {
					t.Fatal("no projectile")
				}
				if bounded {
					shot.ProjectileTravelLimit = 50
				} else {
					shot.ProjectileTravelLimit = 0
				}
				var impacts []ProjectileImpactEvent
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "projectile_impact" {
						impacts = append(impacts, value.(ProjectileImpactEvent))
						w.GetEntityCopy(shot.ID) // Callback must remain lock-free.
					}
				}
				removed := false
				for step := 0; step < 30 && !removed; step++ {
					deferred := &deferredActions{}
					w.updateEntity(shot, dt, nil, deferred)
					removed = len(deferred.removals) > 0
				}
				if !removed || target.Health != target.MaxHealth || len(impacts) != 1 ||
					!impacts[0].Terminal || impacts[0].TargetID != "" || math.Abs(impacts[0].Z+325) > 1e-6 || impacts[0].Radius != 0 {
					t.Fatalf("bad rock impact: class=%v bounded=%v dt=%v removed=%v health=%v impact=%+v", class, bounded, dt, removed, target.Health, impacts)
				}
			}
		}
	}
}
