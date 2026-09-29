package game

import (
	"math"
	"testing"
	"time"
)

func elevationMovementWorld(t *testing.T) (*World, *Entity) {
	t.Helper()
	w := NewWorld(nil)
	var err error
	w.terrainElevation, err = readWorldElevationCandidate()
	if err != nil {
		t.Fatal(err)
	}
	p := newTestPlayer("elevation-player", "Fighter")
	p.X, p.Y, p.Z = -570, 0, 410 // An existing flat-world save, no migration/wipe.
	w.AddEntity(p)
	return w, p
}

func assertActorOnElevation(t *testing.T, w *World, e *Entity) {
	t.Helper()
	want := w.terrainElevation.sample(e.X, e.Z, "")
	if math.Abs(e.Y-want) > 1e-9 {
		t.Fatalf("actor %s at %f/%f has Y=%f, ground=%f", e.ID, e.X, e.Z, e.Y, want)
	}
}

func TestWorldGroundingPlayerAdmissionAndOrderedMovement(t *testing.T) {
	w, p := elevationMovementWorld(t)
	assertActorOnElevation(t, w, p)
	hp, mana := p.Health, p.Mana
	if !w.UpdatePlayerMovement(p.ID, -560, 999, 416, .3, "MOVING", 1) {
		t.Fatal("normal ordered movement rejected")
	}
	assertActorOnElevation(t, w, p)
	if p.Health != hp || p.Mana != mana || p.X != -560 || p.Z != 416 || p.LastMoveSequence != 1 {
		t.Fatal("grounding changed progression, horizontal position or acknowledgement")
	}
	before := p.Y
	if w.UpdatePlayerMovement(p.ID, -500, -500, 490, 0, "MOVING", 1) || p.Y != before || p.X != -560 {
		t.Fatal("stale movement changed an elevated actor")
	}
	p.MovementContext, p.RecoveryContextReady = "current", true
	if w.UpdatePlayerMovementWithContext(p.ID, -550, 0, 417, 0, "MOVING", 2, "departed") {
		t.Fatal("departed scene context was accepted")
	}
}

func TestWorldGroundingJumpTracksTerrainAndLandsAtAuthoritativeHeight(t *testing.T) {
	w, p := elevationMovementWorld(t)
	if !w.StartPlayerJump(p.ID, -514, 999, 453) {
		t.Fatal("jump rejected")
	}
	if p.JumpTargetY != w.terrainElevation.sample(-514, 453, "") || p.JumpTargetY == p.JumpStartY {
		t.Fatal("jump did not resolve the distinct landing height")
	}
	if w.StartPlayerJump(p.ID, -300, 999, 300) {
		t.Fatal("airborne request restarted the jump")
	}
	duration := p.JumpDuration
	for step := 1; step <= 8; step++ {
		w.Update(duration / 8)
		if step < 8 {
			want := w.terrainElevation.sample(p.X, p.Z, "") + math.Sin(p.JumpProgress*math.Pi)*p.JumpHeight
			if math.Abs(p.Y-want) > 1e-8 || p.State != "JUMPING" {
				t.Fatalf("jump sunk below its ground-relative arc: step=%d y=%f want=%f", step, p.Y, want)
			}
		}
	}
	if p.State != "IDLE" || p.X != -514 || p.Z != 453 {
		t.Fatal("jump did not finish at its requested horizontal landing")
	}
	assertActorOnElevation(t, w, p)
}

func TestWorldGroundingChargeAndEnemyMotion(t *testing.T) {
	w, p := elevationMovementWorld(t)
	p.IsCharging = true
	p.ChargeStartX, p.ChargeStartZ = p.X, p.Z
	p.ChargeTargetX, p.ChargeTargetZ = -549, 413
	for step := 0; step < 6; step++ {
		w.Update(.1)
		assertActorOnElevation(t, w, p)
	}
	if p.IsCharging || p.X != -549 || p.Z != 413 {
		t.Fatal("charge did not reach its existing horizontal destination")
	}
	enemy := newOverworldEnemy("elevation-enemy", "Skeleton", -575, 440, 5)
	w.AddEntity(enemy)
	assertActorOnElevation(t, w, enemy)
	oldX, oldZ := enemy.X, enemy.Z
	w.Update(.2)
	if enemy.X == oldX && enemy.Z == oldZ {
		t.Fatal("enemy AI did not exercise movement")
	}
	assertActorOnElevation(t, w, enemy)
	enemy.State, enemy.Health = "DEAD", 0
	enemy.LastAttackTime = time.Now().Add(-11 * time.Second)
	w.Update(.01)
	if enemy.X != enemy.SpawnX || enemy.Z != enemy.SpawnZ || enemy.State != "IDLE" {
		t.Fatal("ordinary enemy respawn changed")
	}
	assertActorOnElevation(t, w, enemy)
}

func TestWorldGroundingRecoveryAndInstanceOwnership(t *testing.T) {
	w, p := elevationMovementWorld(t)
	p.Y = 50
	if !w.SetEntityDisconnected(p.ID, time.Now()) {
		t.Fatal("disconnect failed")
	}
	if _, ok := w.ClearEntityDisconnected(p.ID); !ok {
		t.Fatal("resume failed")
	}
	assertActorOnElevation(t, w, p)
	p.Health = 0
	p.State = "DEAD"
	if err := w.PerformRespawn(p.ID, "town-recovery"); err != nil {
		t.Fatal(err)
	}
	if p.X != -1.25 || p.Y != 0 || p.Z != 200 || p.InstanceID != "" {
		t.Fatal("town recovery moved off its original foundation")
	}
	for _, instanceID := range []string{"dungeon_test", CasinoInstanceID, "arena_test"} {
		e := newTestPlayer("floor-owner", "Fighter")
		e.InstanceID, e.Y = instanceID, 8
		w.groundActorLocked(e)
		if e.Y != 8 {
			t.Fatal("Earth elevation replaced an instance-owned floor")
		}
	}
	for _, kind := range []EntityType{TypeNPC, TypeProjectile, TypeLoot} {
		e := &Entity{Type: kind, X: -570, Y: .5, Z: 410}
		w.groundActorLocked(e)
		if e.Y != .5 {
			t.Fatal("actor grounding consumed a separate placement/airborne offset")
		}
	}
}

func TestWorldGroundingMovementAbilities(t *testing.T) {
	for _, tc := range []struct{ class, skill string }{
		{"Wizard", "Teleport"}, {"Rogue", "Shadow Strike"}, {"Rogue", "Shadow Lunge"}, {"Fighter", "Unbreakable Grip"},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			w, p := elevationMovementWorld(t)
			p.SubType, p.Level = tc.class, 100
			p.UnlockedSkills = []string{tc.skill}
			p.Mana, p.MaxMana = 1000, 1000
			target := newOverworldEnemy("elevation-target", "Skeleton", p.X+7, p.Z+2, 100)
			target.Health, target.MaxHealth = 100000, 100000
			w.AddEntity(target)
			px, pz, tx, tz := p.X, p.Z, target.X, target.Z
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, tc.skill); !result.Accepted {
				t.Fatalf("ability rejected: %+v", result)
			}
			if p.X == px && p.Z == pz && target.X == tx && target.Z == tz {
				t.Fatal("test did not exercise displacement")
			}
			assertActorOnElevation(t, w, p)
			assertActorOnElevation(t, w, target)
		})
	}
}

func TestWorldGroundingDisabledUntilFullIntegration(t *testing.T) {
	w := NewWorld(nil)
	if w.terrainElevation != nil {
		t.Fatal("elevation must not ship enabled before scene/effect integration")
	}
	e := &Entity{Type: TypePlayer, X: -570, Y: 3, Z: 410}
	w.groundActorLocked(e)
	if e.Y != 3 {
		t.Fatal("inactive elevation changed legacy world coordinates")
	}
}
