package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestNetworkJumpRejectsInvalidCoordinatesWithoutStartingFlight(t *testing.T) {
	for _, input := range []struct {
		name    string
		x, y, z float64
	}{
		{"nan-x", math.NaN(), 0, 0},
		{"nan-y", 1, math.NaN(), 0},
		{"nan-z", 1, 0, math.NaN()},
		{"infinite", math.Inf(1), 0, 0},
		{"overflow-x", 1e39, 0, 0},
		{"overflow-y", 1, 1e39, 0},
		{"overflow-z", 1, 0, -1e39},
	} {
		t.Run(input.name, func(t *testing.T) {
			p := newTestPlayer("invalid-jumper", "Fighter")
			w := newPvPTestWorld(p)
			if w.StartPlayerJumpWithContext(p.ID, input.x, input.y, input.z, "") {
				t.Fatal("invalid jump started")
			}
			if p.State != "IDLE" || p.JumpDuration != 0 || p.JumpTargetX != 0 || p.JumpTargetY != 0 || p.JumpTargetZ != 0 {
				t.Fatal("invalid jump changed flight state")
			}
		})
	}
}

func TestNetworkJumpKeepsServerLandingHeightAndCannotRestartMidFlight(t *testing.T) {
	for _, instance := range []string{"", "dungeon_jump-input", DarkRealmInstanceID} {
		t.Run(instance, func(t *testing.T) {
			p := newTestPlayer("guarded-jumper", "Fighter")
			p.InstanceID = instance
			if instance == DarkRealmInstanceID {
				p.X, p.Z = 40000, 40800
			}
			w := newPvPTestWorld(p)
			if instance == "dungeon_jump-input" {
				w.InstanceLayouts = map[string]*DungeonInstance{instance: {Layout: singleRoomDungeonLayout()}}
			}
			if !w.StartPlayerJumpWithContext(p.ID, p.X+12, 999, p.Z, "") {
				t.Fatal("ordinary jump rejected")
			}
			if p.JumpTargetY != 0 || p.JumpStartY != 0 || p.State != "JUMPING" {
				t.Fatalf("client controls airborne landing height: start=%v target=%v state=%v", p.JumpStartY, p.JumpTargetY, p.State)
			}
			p.JumpElapsed = .2
			previousX, previousZ, previousDuration := p.JumpTargetX, p.JumpTargetZ, p.JumpDuration
			if w.StartPlayerJumpWithContext(p.ID, p.X+15, 0, p.Z, "") || p.JumpElapsed != .2 ||
				p.JumpTargetX != previousX || p.JumpTargetZ != previousZ || p.JumpDuration != previousDuration {
				t.Fatal("network request restarted or redirected an active jump")
			}
		})
	}
}

func TestNetworkJumpTravelReservesLatencyWithinOnePointFiveSeconds(t *testing.T) {
	for _, flight := range []struct{ distance, duration float64 }{{3, .46}, {17.28, 1.28}, {20.25, 1.3}, {27, 1.3}, {54, 1.3}, {135, 1.3}} {
		distance, wantDuration := flight.distance, flight.duration
		t.Run(fmt.Sprintf("distance-%g", distance), func(t *testing.T) {
			p := newTestPlayer("distance-jumper", "Fighter")
			// No scene geometry in this unit fixture: measure the full accepted
			// horizontal path, not a shorter collision-constrained destination.
			p.InstanceID = "jump-speed-test"
			w := newPvPTestWorld(p)
			if !w.StartPlayerJumpWithContext(p.ID, distance, 999, 0, "") {
				t.Fatal("jump rejected")
			}
			if p.JumpTargetX != distance || p.JumpTargetZ != 0 {
				t.Fatal("fixture did not exercise the requested distance")
			}
			if math.Abs(p.JumpDuration-wantDuration) > 1e-9 {
				t.Fatalf("duration=%g, want=%g for distance=%g", p.JumpDuration, wantDuration, distance)
			}
			w.Update(.25)
			if math.Abs(p.X-distance*.25/wantDuration) > 1e-9 || p.State != "JUMPING" {
				t.Fatalf("jump did not follow accepted duration: x=%g state=%s", p.X, p.State)
			}
			w.Update(wantDuration - .25)
			if p.State != "IDLE" || p.X != distance || p.Z != 0 || p.Y != 0 || p.JumpProgress != 1 {
				t.Fatalf("jump failed to land at the canonical destination: x=%g y=%g z=%g state=%s progress=%g", p.X, p.Y, p.Z, p.State, p.JumpProgress)
			}
		})
	}
}

func TestRealtimeJumpLandsOnElapsedTimeDespiteDelayedFrames(t *testing.T) {
	p := newTestPlayer("realtime-jumper", "Fighter")
	p.InstanceID = "jump-clock-test"
	w := newPvPTestWorld(p)
	if !w.StartPlayerJumpWithContext(p.ID, 135, 999, 0, "") || p.JumpDuration != 1.3 {
		t.Fatal("long jump did not use the 1.3-second flight cap")
	}
	started := p.jumpStartedAt
	w.UpdateRealtime(.033, started.Add(time.Second))
	if math.Abs(p.X-135/1.3) > 1e-9 || p.State != "JUMPING" {
		t.Fatal("delayed frame slowed the flight", p.X, p.State)
	}
	w.UpdateRealtime(.033, started.Add(500*time.Millisecond))
	if math.Abs(p.X-135/1.3) > 1e-9 {
		t.Fatal("older clock rewound the jump", p.X)
	}
	w.UpdateRealtime(.033, started.Add(1300*time.Millisecond))
	if p.X != 135 || p.Y != 0 || p.State != "IDLE" || !p.jumpStartedAt.IsZero() {
		t.Fatal("jump did not land at the accepted point on time")
	}
}
