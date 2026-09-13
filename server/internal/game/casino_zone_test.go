package game

import "testing"

func TestCasinoRestoreDoesNotTrapLegacyGuestsOrGrantVIP(t *testing.T) {
	x, y, z := RestoreCasinoPosition("", 0, 6, 170)
	if x != 0 || y != 0 || z != 181.5 {
		t.Fatal("old upstairs guest trapped in facade")
	}
	x, y, z = RestoreCasinoPosition("", -8, 0, 185)
	if x != -8 || y != 0 || z != 185 {
		t.Fatal("stash visitor moved")
	}
	x, y, z = RestoreCasinoPosition(CasinoInstanceID, 0, 8, 140)
	if x != 0 || y != 0 || z < 148 {
		t.Fatal("saved height bypassed guard")
	}
}

func TestCasinoDoorSharedZoneAndSafeReturn(t *testing.T) {
	w, a, b, _ := casinoSeatWorld()
	for _, p := range []*Entity{a, b} {
		p.InstanceID, p.X, p.Z = "", 0, 200
		if w.EnterCasino(p.ID) == nil {
			t.Fatal("remote door accepted")
		}
		p.Z = 181
		if err := w.EnterCasino(p.ID); err != nil {
			t.Fatal(err)
		}
		if p.InstanceID != CasinoInstanceID || p.Z != 200 || !w.inSafeZone(p) {
			t.Fatal("not in shared safe casino", p.InstanceID)
		}
	}
	if a.InstanceID != b.InstanceID {
		t.Fatal("created private casino copies")
	}
	if _, ok := w.GetInstanceLayout(CasinoInstanceID); !ok || w.GetInstanceType(CasinoInstanceID) != CasinoInstanceType {
		t.Fatal("reconnect cannot restore casino")
	}
	if err := w.PerformRecall(a.ID); err != nil {
		t.Fatal(err)
	}
	if a.InstanceID != "" || a.Z != 200 || b.InstanceID != CasinoInstanceID {
		t.Fatal("return moved other guests")
	}
}

func TestCasinoDoorRejectsDeadAndCrossInstance(t *testing.T) {
	w, p, _, _ := casinoSeatWorld()
	p.InstanceID, p.X, p.Z = "dungeon-other", 0, 181
	if w.EnterCasino(p.ID) == nil {
		t.Fatal("cross-dungeon entrance")
	}
	p.InstanceID, p.State, p.Health = "", "DEAD", 0
	if w.EnterCasino(p.ID) == nil {
		t.Fatal("dead entrance bypassed respawn")
	}
}
