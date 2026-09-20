package game

import (
	"math"
	"testing"
	"time"
)

func TestCasinoStairsRoundTripAndFloorBoundaries(t *testing.T) {
	x, y, z := 0.0, 0.0, 180.0
	for _, target := range [][3]float64{{0, 0, 176.4}, {10.5, 0, 176.4}, {10.5, 6, 163.5}, {0, 6, 163.5}, {0, 6, 170}} {
		x, y, z = constrainCasinoWalk(x, y, z, target[0], target[2])
		if math.Abs(x-target[0])+math.Abs(y-target[1])+math.Abs(z-target[2]) > .001 {
			t.Fatalf("cannot reach landing %v: %v %v %v", target, x, y, z)
		}
	}
	_, edgeY, edgeZ := constrainCasinoWalk(x, y, z, 0, 190)
	if edgeY != 6 || edgeZ > 177.1 {
		t.Fatal("walked off upstairs balcony")
	}
	railX, railY, _ := constrainCasinoWalk(x, y, z, 11, 170)
	if railX > 8.5 || railY != 6 {
		t.Fatal("crossed stairwell rail")
	}
	for _, target := range [][3]float64{{0, 6, 163.5}, {10.5, 6, 163.5}, {10.5, 0, 176.4}, {0, 0, 176.4}, {0, 0, 180}} {
		x, y, z = constrainCasinoWalk(x, y, z, target[0], target[2])
		if math.Abs(x-target[0])+math.Abs(y-target[1])+math.Abs(z-target[2]) > .001 {
			t.Fatalf("cannot descend to %v", target)
		}
	}
	_, sideY, _ := constrainCasinoWalk(0, 0, 170, 10.5, 170)
	if sideY != 0 {
		t.Fatal("side entry skipped stairs")
	}
}

func TestCasinoMovementOwnsFloorAndCannotSeatThroughCeiling(t *testing.T) {
	w, p, _, table := casinoSeatWorld()
	p.X, p.Y, p.Z = 0, 0, 149
	if !w.UpdatePlayerMovement(p.ID, 0, 999, 147, 0, "MOVING", 1) || p.Y != 0 || p.CasinoVIPFloor {
		t.Fatal("client bypassed guarded stairs or forged upstairs height")
	}
	if w.StartPlayerJump(p.ID, 0, 0, 190) {
		t.Fatal("jump escaped upper floor")
	}
	p.X, p.Z = table.Seats[0].ExitX, table.Seats[0].ExitZ
	p.Y = 8 // A forged upper-floor actor must not claim a ground-floor chair.
	if _, err := w.TakeCasinoSeat(p.ID, table.ID, 0, time.Now()); err == nil {
		t.Fatal("claimed downstairs seat from VIP lounge")
	}
}
