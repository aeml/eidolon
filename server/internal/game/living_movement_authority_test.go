package game

import "testing"

func TestNetworkMovementRejectsUnavailableActorsWithoutMutatingState(t *testing.T) {
	for _, mutation := range []struct {
		name  string
		apply func(*Entity)
	}{
		{"zero-health-idle", func(p *Entity) { p.Health = 0 }},
		{"negative-health-idle", func(p *Entity) { p.Health = -10 }},
		{"disconnected", func(p *Entity) { p.Disconnected = true }},
		{"dead-state", func(p *Entity) { p.State = "DEAD" }},
		{"non-player", func(p *Entity) { p.Type = TypeEnemy }},
	} {
		for _, command := range []string{"walk", "jump"} {
			t.Run(mutation.name+"/"+command, func(t *testing.T) {
				p := newTestPlayer("unavailable-mover", "Fighter")
				p.X, p.Z, p.TargetX, p.TargetZ, p.Rotation = 100, 200, 100, 200, .4
				p.LastMoveSequence = 3
				p.MovementContext, p.RecoveryContextReady = "current", true
				mutation.apply(p)
				w := newPvPTestWorld(p)
				state, budget := p.State, p.networkMovement
				var accepted bool
				if command == "walk" {
					accepted = w.UpdatePlayerMovementWithContext(p.ID, 101, 0, 200, .8, "MOVING", 4, "current")
				} else {
					accepted = w.StartPlayerJumpWithContext(p.ID, 112, 0, 200, "current")
				}
				if accepted || p.X != 100 || p.Y != 0 || p.Z != 200 || p.State != state || p.Rotation != .4 ||
					p.TargetX != 100 || p.TargetZ != 200 || p.LastMoveSequence != 3 || p.networkMovement != budget ||
					p.JumpDuration != 0 || p.JumpElapsed != 0 || p.JumpTargetX != 0 || p.JumpTargetZ != 0 {
					t.Fatalf("unavailable actor admitted or mutated: accepted=%v state=%s position=%g/%g/%g", accepted, p.State, p.X, p.Y, p.Z)
				}
			})
		}
	}
}

func TestNetworkMovementStillAcceptsLivingActorsAndTrustedReposition(t *testing.T) {
	p := newTestPlayer("living-mover", "Fighter")
	p.X, p.Z, p.MovementContext, p.RecoveryContextReady = 100, 200, "current", true
	w := newPvPTestWorld(p)
	if !w.UpdatePlayerMovementWithContext(p.ID, 101, 0, 200, .8, "MOVING", 4, "current") || p.X != 101 || p.LastMoveSequence != 4 {
		t.Fatal("living connected walking rejected")
	}
	if !w.StartPlayerJumpWithContext(p.ID, 112, 0, 200, "current") || p.State != "JUMPING" {
		t.Fatal("living connected jump rejected")
	}
	// Server-owned recovery can reposition an actor before restoring health.
	p.State, p.Health, p.Disconnected = "IDLE", 0, true
	if !w.UpdatePlayerMovement(p.ID, 110, 0, 200, 0, "IDLE", 0) || p.X != 110 {
		t.Fatal("network-only admission blocked trusted recovery reposition")
	}
}
