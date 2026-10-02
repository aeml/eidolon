package game

import (
	"math"
	"time"
)

// Permit up to two seconds of coalesced/delayed walking, not an unbounded burst
// after a long idle. Credit is expressed in travel time: server-owned haste and
// slow modify distance without accepting a speed or timestamp from the browser.
const movementCreditSeconds = 2.0

type movementBudget struct {
	last   time.Time
	credit float64
}

func (b *movementBudget) allow(distance, speed float64, now time.Time) bool {
	if b.last.IsZero() {
		b.last, b.credit = now, movementCreditSeconds
	} else if elapsed := now.Sub(b.last).Seconds(); elapsed > 0 {
		b.last = now
		b.credit = math.Min(movementCreditSeconds, b.credit+elapsed)
	}
	if !finiteCoordinate(distance) || distance < 0 {
		return false
	}
	if distance == 0 {
		return true // Idle/rotation updates do not need positive movement speed.
	}
	if !finiteCoordinate(speed) || speed <= 0 {
		return false
	}
	cost := distance / speed
	if cost > b.credit {
		return false
	}
	b.credit -= cost
	return true
}

func replicableMovementNumber(value float64) bool {
	return finiteCoordinate(value) && math.Abs(value) <= math.MaxFloat32
}

func acknowledgeDeniedMovement(e *Entity, sequence uint64) {
	if sequence > 0 {
		e.LastMoveSequence = sequence
	}
}
