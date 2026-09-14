package game

import (
	"testing"
	"time"
)

func TestCasinoVIPFloorGuardSeatHeightAndSafeReturn(t *testing.T) {
	w, p, _, _ := casinoSeatWorld()
	now := time.Now()
	p.X, p.Y, p.Z, p.EP = 0, 0, 153, 10000
	if w.ChangeCasinoFloor(p.ID, true, now) == nil || p.CasinoVIPFloor {
		t.Fatal("EP ownership admitted VIP")
	}
	p.VIPUntil = now.Add(time.Hour)
	p.Z = 190
	if w.ChangeCasinoFloor(p.ID, true, now) == nil {
		t.Fatal("remote stairs accepted")
	}
	p.Z = 153
	if err := w.ChangeCasinoFloor(p.ID, true, now); err != nil || !p.CasinoVIPFloor || p.Y != 8 || p.Z != 140 {
		t.Fatal("VIP landing", err)
	}
	table, _ := CasinoTableByID("vip-blackjack")
	point := table.Seats[0]
	p.X, p.Z = point.ExitX, point.ExitZ
	p.Y = 0
	if _, err := w.TakeCasinoSeat(p.ID, table.ID, 0, now); err == nil {
		t.Fatal("cross-floor seat accepted")
	}
	p.Y = 8
	seat, err := w.TakeCasinoSeat(p.ID, table.ID, 0, now)
	if err != nil || p.Y != 8 || seat.ExitY != 8 {
		t.Fatal("VIP seat height", err)
	}
	p.VIPUntil = now // Existing hand/seat can finish; expiry must not trap leaving.
	if err := w.ChangeCasinoSeat(p.ID, seat.SessionID, "leave", false, now, ""); err != nil || p.Y != 8 {
		t.Fatal("VIP seat exit", err)
	}
	p.X, p.Z = 0, 140
	if err := w.ChangeCasinoFloor(p.ID, false, now); err != nil || p.Y != 0 || p.CasinoVIPFloor {
		t.Fatal("expired guest trapped upstairs", err)
	}
	if w.StartPlayerJump(p.ID, 0, 8, 140) {
		t.Fatal("jump bypassed guard")
	}
}

func TestCasinoVIPFloorAtriumAndLegacySaveBounds(t *testing.T) {
	for _, tc := range []struct{ x, z, oldX, oldZ, wantX, wantZ float64 }{
		{0, 160, 0, 140, 0, 141}, {10, 180, 29, 180, 26, 180}, {-10, 180, -29, 180, -26, 180}, {29, 181, 29, 180, 29, 181},
	} {
		x, z := constrainCasinoVIPInterior(tc.x, tc.z, tc.oldX, tc.oldZ)
		if x != tc.wantX || z != tc.wantZ {
			t.Fatal("walk left upper floor", tc, x, z)
		}
	}
	x, y, z := RestoreCasinoPosition(CasinoInstanceID, 29, 8, 181)
	if x != 0 || y != 0 || z != 153 {
		t.Fatal("save granted upstairs access")
	}
}
