package game

import (
	"math"
	"testing"
)

func TestRockJumpAndMovementAbilitiesStopBeforeCover(t *testing.T) {
	for _, spec := range []struct{ class, skill string }{
		{"Fighter", "jump"}, {"Fighter", "Charge"}, {"Fighter", "Juggernaut Charge"},
		{"Wizard", "Teleport"}, {"Rogue", "Shadow Strike"},
	} {
		t.Run(spec.skill, func(t *testing.T) {
			w := newRockWorldForTest(t)
			w.rockSolids = rockSolidsForTest(t)
			p := newTestPlayer("rock-mover", spec.class)
			p.X, p.Z, p.Mana = -102, -337, 1000
			p.UnlockedSkills = []string{spec.skill}
			w.AddEntity(p)
			castZ, targetID := -310.0, ""
			if spec.skill == "Teleport" {
				// Blink's authored 22.5m range can reach the other side.
				p.SkillRunes = map[string]string{"Teleport": "teleport_blink"}
				castZ = -315
			}
			if spec.skill == "Shadow Strike" {
				// The enemy is visible on our side; its behind-the-back landing
				// would be inside the rock without body-clearance clipping.
				target := &Entity{ID: "rock-strike-target", Type: TypeEnemy, X: -102, Z: -326.3,
					Rotation: math.Pi, Health: 10000, MaxHealth: 10000, State: "IDLE"}
				w.AddEntity(target)
				targetID, castZ = target.ID, target.Z
			}
			if spec.skill == "jump" {
				if !w.StartPlayerJump(p.ID, -102, 0, -310) {
					t.Fatal("jump rejected")
				}
			} else if result := w.PerformAbility(p.ID, -102, castZ, targetID, spec.skill); !result.Accepted {
				t.Fatal(result)
			}
			for step := 0; step < 40; step++ {
				w.updateEntity(p, .05, nil, &deferredActions{})
				if insideRockSolids(w.rockSolids, rockPoint{p.X, p.Z}, p.ReplicatedBodyRadius()) {
					t.Fatal("ability crossed or landed inside rock")
				}
			}
			if p.Z <= -337 || p.Z >= -326.25 || p.IsCharging || p.State == "JUMPING" {
				t.Fatalf("bad clipped completion: position=%v,%v state=%v charging=%v", p.X, p.Z, p.State, p.IsCharging)
			}
		})
	}
}

func TestRockShockwaveCannotKnockEnemyIntoFormation(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-shockwave", "Fighter")
	p.X, p.Z = -102, -340
	p.SkillRunes = map[string]string{"Charge": "charge_shockwave"}
	w.AddEntity(p)
	target := &Entity{ID: "rock-knock-target", Type: TypeEnemy, X: -102, Z: -328, Health: 10000, MaxHealth: 10000, State: "IDLE"}
	w.AddEntity(target)
	if result := w.PerformAbility(p.ID, -102, -330, "", "Charge"); !result.Accepted {
		t.Fatal(result)
	}
	for step := 0; step < 20 && p.IsCharging; step++ {
		w.updateEntity(p, .05, nil, &deferredActions{})
	}
	if target.Health >= target.MaxHealth || target.Z <= -328 || target.Z >= -326.25 ||
		insideRockSolids(w.rockSolids, rockPoint{target.X, target.Z}, target.ReplicatedBodyRadius()) {
		t.Fatalf("shockwave failed damage/clearance: hp=%v position=%v,%v", target.Health, target.X, target.Z)
	}
}

func TestRockStraightDisplacementRetainsLineAndInstanceOwnership(t *testing.T) {
	w := &World{rockSolids: rockSolidsForTest(t)}
	e := &Entity{Type: TypePlayer, X: -102, Z: -337, BodyRadius: 2}
	x, z, active := w.constrainDungeonMovementDestination(e, -80, -310)
	if !active || insideRockSolids(w.rockSolids, rockPoint{x, z}, e.BodyRadius) ||
		math.Abs((x-e.X)*27-(z-e.Z)*22) > 1e-7 {
		t.Fatal("straight movement slid off line or violated clearance")
	}
	e.InstanceID = "test-instance"
	x, z, active = w.constrainDungeonMovementDestination(e, -80, -310)
	if active || x != -80 || z != -310 {
		t.Fatal("rocks constrained instance movement")
	}
}

func TestRockSeraphFollowsOwnerAroundFormation(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-summoner", "Cleric")
	p.X, p.Z, p.Mana = -102, -337, 1000
	p.UnlockedSkills = []string{"Avenging Seraph"}
	w.AddEntity(p)
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Avenging Seraph"); !result.Accepted {
		t.Fatal(result)
	}
	var seraph *Entity
	for _, e := range w.Entities {
		if e.SubType == "AvengingSeraph" {
			seraph = e
		}
	}
	if seraph == nil {
		t.Fatal("summon absent")
	}
	p.Z = -305
	w.Grid.Update(p, -102, -337)
	for step := 0; step < 300; step++ {
		oldX, oldZ := seraph.X, seraph.Z
		w.updateEntity(seraph, .05, nil, &deferredActions{})
		if insideRockSolids(w.rockSolids, rockPoint{seraph.X, seraph.Z}, seraph.ReplicatedBodyRadius()) ||
			math.Hypot(seraph.X-oldX, seraph.Z-oldZ) > .301 {
			t.Fatal("summon crossed formation or teleported")
		}
	}
	if math.Hypot(seraph.X-p.X, seraph.Z-p.Z) > 3.01 {
		t.Fatalf("summon stuck behind formation at %v,%v", seraph.X, seraph.Z)
	}
}
