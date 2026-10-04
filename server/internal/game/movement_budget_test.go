package game

import (
	"math"
	"testing"
	"time"
)

func movementBudgetWorld() (*World, *Entity, time.Time) {
	w := NewWorld(nil)
	e := &Entity{ID: "budget-player", Type: TypePlayer, State: "IDLE", Speed: 5, Health: 100, MaxHealth: 100,
		X: 0, Z: 200, MovementContext: "budget-context", RecoveryContextReady: true}
	w.AddEntity(e)
	return w, e, time.Unix(1000, 0)
}

func TestNetworkMovementBudgetRejectsPacketRateSpeedupAndAcknowledgesCorrection(t *testing.T) {
	for _, sequenced := range []bool{false, true} {
		w, e, now := movementBudgetWorld()
		for i := uint64(1); i <= 180; i++ {
			sequence := i
			if !sequenced {
				sequence = 0 // Legacy messages do not get an unmetered bypass.
			}
			accepted := w.updatePlayerMovementAt(e.ID, e.X+1, 0, e.Z, .5, "MOVING", sequence, &e.MovementContext, now)
			if accepted != (i <= 10) {
				t.Fatalf("sequenced=%v sample=%d accepted=%v", sequenced, i, accepted)
			}
		}
		if e.X != 10 || (sequenced && e.LastMoveSequence != 180) {
			t.Fatalf("burst moved too far or failed to acknowledge correction: x=%v ack=%d", e.X, e.LastMoveSequence)
		}
	}
}

func TestNetworkMovementBudgetAcceptsSustainedWalkingAndDelayedSamples(t *testing.T) {
	w, e, now := movementBudgetWorld()
	for i := uint64(1); i <= 200; i++ {
		now = now.Add(100 * time.Millisecond)
		if !w.updatePlayerMovementAt(e.ID, e.X+.5, 0, e.Z, 0, "MOVING", i, &e.MovementContext, now) {
			t.Fatalf("normal walking rejected at sample %d", i)
		}
	}
	// Two coalesced seconds are valid, but a long idle cannot buy hours of travel.
	now = now.Add(time.Hour)
	if !w.updatePlayerMovementAt(e.ID, e.X+10, 0, e.Z, 0, "MOVING", 201, &e.MovementContext, now) {
		t.Fatal("delayed movement rejected")
	}
	if w.updatePlayerMovementAt(e.ID, e.X+.5, 0, e.Z, 0, "MOVING", 202, &e.MovementContext, now) {
		t.Fatal("idle/repeated samples minted additional movement credit")
	}
	if e.LastMoveSequence != 202 || e.X != 110 {
		t.Fatalf("unexpected corrected position/ack: x=%v ack=%d", e.X, e.LastMoveSequence)
	}
}

func TestNetworkMovementBudgetUsesModifiedSpeedAndDoesNotResetOnRecovery(t *testing.T) {
	w, e, now := movementBudgetWorld()
	if !w.updatePlayerMovementAt(e.ID, 10, 0, 200, 0, "MOVING", 1, &e.MovementContext, now) {
		t.Fatal("initial allowance rejected")
	}
	// Simulate a server-derived haste, then slow. No client speed is consulted.
	e.Speed = 10
	now = now.Add(time.Second)
	if !w.updatePlayerMovementAt(e.ID, 20, 0, 200, 0, "MOVING", 2, &e.MovementContext, now) {
		t.Fatal("server haste was not honored")
	}
	e.Speed = 2
	now = now.Add(time.Second)
	if w.updatePlayerMovementAt(e.ID, 23, 0, 200, 0, "MOVING", 3, &e.MovementContext, now) {
		t.Fatal("server slow was bypassed")
	}
	if !w.updatePlayerMovementAt(e.ID, 22, 0, 200, 0, "MOVING", 4, &e.MovementContext, now) {
		t.Fatal("denial spent credit needed for valid slower movement")
	}
	setRecoveryMovementContextLocked(e, "returned")
	if w.updatePlayerMovementAt(e.ID, 23, 0, 200, 0, "MOVING", 5, &e.MovementContext, now) {
		t.Fatal("context transition minted fresh walking credit")
	}
	// A trusted server teleport does not spend or reset network walking credit.
	if !w.UpdatePlayerMovement(e.ID, 50, 0, 200, 0, "IDLE", 0) {
		t.Fatal("trusted movement setup unexpectedly throttled")
	}
	if w.updatePlayerMovementAt(e.ID, 51, 0, 200, 0, "MOVING", 6, &e.MovementContext, now) {
		t.Fatal("trusted reposition minted credit")
	}
	if !w.updatePlayerMovementAt(e.ID, 50, 0, 200, 1, "IDLE", 7, &e.MovementContext, now) {
		t.Fatal("stationary rotation requires no travel credit")
	}
}

func TestNetworkMovementBudgetRejectsInvalidStaleAndDepartedSamplesWithoutMutatingBudget(t *testing.T) {
	w, e, now := movementBudgetWorld()
	if !w.updatePlayerMovementAt(e.ID, 5, 0, 200, 0, "MOVING", 10, &e.MovementContext, now) {
		t.Fatal("setup move rejected")
	}
	budget := e.networkMovement
	oldContext := "departed"
	for _, input := range []struct {
		x, y, z, rotation float64
		sequence          uint64
		context           *string
	}{
		{6, 0, 200, 0, 9, &e.MovementContext},
		{6, 0, 200, 0, 11, &oldContext},
		{math.NaN(), 0, 200, 0, 11, &e.MovementContext},
		{6, math.Inf(1), 200, 0, 11, &e.MovementContext},
		{6, 0, 200, math.MaxFloat64, 11, &e.MovementContext},
	} {
		if w.updatePlayerMovementAt(e.ID, input.x, input.y, input.z, input.rotation, "MOVING", input.sequence, input.context, now.Add(time.Hour)) {
			t.Fatal("invalid/stale/departed sample accepted")
		}
		if e.networkMovement != budget || e.X != 5 || e.LastMoveSequence != 10 {
			t.Fatal("invalid/stale/departed sample changed position, allowance or acknowledgement")
		}
	}
}

func TestMovementBudgetNoPositiveSpeedAndBackwardClock(t *testing.T) {
	now := time.Unix(1000, 0)
	var budget movementBudget
	for _, speed := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		if budget.allow(1, speed, now) {
			t.Fatalf("invalid server speed %v allowed travel", speed)
		}
	}
	if !budget.allow(0, 0, now) || !budget.allow(10, 5, now) {
		t.Fatal("stationary update or initial valid burst rejected")
	}
	if budget.allow(1, 5, now.Add(-time.Second)) || budget.allow(1, 5, now) {
		t.Fatal("backward clock/retry minted credit")
	}
	if !budget.allow(5, 5, now.Add(time.Second)) {
		t.Fatal("normal refill rejected after backward clock")
	}
}

func TestNetworkWalkingCannotSetAirborneHeight(t *testing.T) {
	for _, instance := range []string{"", "dungeon_floor-test", DarkRealmInstanceID} {
		w, e, now := movementBudgetWorld()
		e.InstanceID, e.Y = instance, 0
		if instance == DarkRealmInstanceID {
			// Shared expedition geometry lives in a separate world-coordinate range.
			e.X, e.Z = 40000, 40800
		}
		if !w.updatePlayerMovementAt(e.ID, e.X+1, 999, e.Z, 0, "MOVING", 1, &e.MovementContext, now) {
			t.Fatalf("valid horizontal movement rejected in %q", instance)
		}
		if e.Y != 0 {
			t.Fatalf("client supplied airborne walking height in %q: %v", instance, e.Y)
		}
	}
}
