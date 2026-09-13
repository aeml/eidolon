package game

import "testing"

func vigilFixture(element string) *CrystalRepairState {
	return &CrystalRepairState{InstanceID: "raid", Element: element, CenterX: 80000, CenterZ: 19280, Vigil: &CrystalVigil{}}
}

func atVigil(s *CrystalRepairState, index int, id string) vigilPlayer {
	p := s.vigilPoint(index)
	return vigilPlayer{id, p.X, p.Z}
}

func TestCrystalVigilEarthRequiresDefendedOccupiedTime(t *testing.T) {
	s := vigilFixture("Earth")
	players := []vigilPlayer{atVigil(s, 0, "tank")}
	for range 20 {
		s.advanceVigil(players, true, 0.5)
	}
	if s.Vigil.Channel != 0 {
		t.Fatal("contested ward advanced")
	}
	for range 15 {
		s.advanceVigil(players, false, 0.5)
	}
	if s.vigilComplete() {
		t.Fatal("ward completed before eight defended seconds")
	}
	s.advanceVigil(players, false, 0.5)
	if !s.vigilComplete() {
		t.Fatal("defended ward never completed")
	}
}

func TestCrystalVigilWaterRequiresActualReturnAndDropsLostCarrier(t *testing.T) {
	s := vigilFixture("Water")
	font := atVigil(s, 0, "runner")
	s.advanceVigil([]vigilPlayer{font}, false, 0.5)
	s.advanceVigil([]vigilPlayer{font}, false, 0.5)
	if s.Vigil.Step != 0 || !s.Vigil.Carriers["runner"] {
		t.Fatal("standing at font awarded a delivery")
	}
	other := atVigil(s, 1, "healer")
	s.advanceVigil([]vigilPlayer{other}, false, 0.5)
	if s.Vigil.Carriers["runner"] || s.Vigil.Step != 0 {
		t.Fatal("absent carrier kept or delivered its memory")
	}
	for range 2 {
		s.advanceVigil([]vigilPlayer{font, other}, false, 0.5)
		s.advanceVigil([]vigilPlayer{atVigil(s, 1, "runner"), other}, false, 0.5)
	}
	if !s.vigilComplete() {
		t.Fatal("two actual carries did not finish the facet")
	}
}

func TestCrystalVigilFireInterruptsAndRequiresThreeOrderedVents(t *testing.T) {
	s := vigilFixture("Fire")
	s.advanceVigil([]vigilPlayer{atVigil(s, 2, "rogue")}, false, 0.5)
	if s.Vigil.Channel != 0 {
		t.Fatal("out-of-order vent progressed")
	}
	s.advanceVigil([]vigilPlayer{atVigil(s, 0, "rogue")}, false, 0.5)
	s.advanceVigil([]vigilPlayer{{"rogue", s.CenterX, s.CenterZ}}, false, 0.5)
	if s.Vigil.Channel != 0 {
		t.Fatal("leaving vent retained channel")
	}
	for step := 0; step < 3; step++ {
		for range 4 {
			s.advanceVigil([]vigilPlayer{atVigil(s, step, "rogue")}, false, 0.5)
		}
		if s.Vigil.Step != step+1 {
			t.Fatal("vent did not quench after two seconds")
		}
	}
	if !s.vigilComplete() {
		t.Fatal("three vents did not finish the facet")
	}
}

func TestCrystalVigilAirRequiresAlternatingRealParticipants(t *testing.T) {
	s := vigilFixture("Air")
	s.advanceVigil([]vigilPlayer{atVigil(s, 0, "wizard")}, false, 0.5)
	s.advanceVigil([]vigilPlayer{atVigil(s, 1, "wizard")}, false, 0.5)
	if s.Vigil.Step != 1 {
		t.Fatal("one raider bypassed the handoff")
	}
	for step, id := range []string{"cleric", "wizard", "cleric"} {
		s.advanceVigil([]vigilPlayer{atVigil(s, step+1, id)}, false, 0.5)
	}
	if !s.vigilComplete() {
		t.Fatal("four-anchor relay did not complete")
	}
}

func TestCrystalVigilWipeResetsOnlyCurrentWaveAndSnapshotDoesNotAlias(t *testing.T) {
	for _, element := range []string{"Earth", "Water", "Fire", "Air"} {
		s := vigilFixture(element)
		s.ClearedWaves = 2
		s.Vigil = &CrystalVigil{Step: s.vigilTotal(), Channel: 1, LastRelay: "wizard", Carriers: map[string]bool{"rogue": true}}
		s.advanceVigil(nil, false, 0.5)
		if s.vigilComplete() || !s.Vigil.Paused || s.Vigil.Step != 0 || s.ClearedWaves != 2 || len(s.Vigil.Carriers) != 0 {
			t.Fatalf("%s unattended ritual retained partial work or lost earned waves: %+v", element, s)
		}
		snapshot := s.vigilSnapshot()
		snapshot.Points[0].X = 0
		if s.vigilSnapshot().Points[0].X == 0 {
			t.Fatal("wire marker aliases authority")
		}
	}
}

func TestCrystalVigilObservesOnlyLivingLocalParticipantsAndEveryAttacker(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	s := vigilFixture("Earth")
	for _, id := range []string{"tank", "dead", "offline", "town", "far", "outsider"} {
		p := &Entity{ID: id, Type: TypePlayer, InstanceID: "raid", Health: 100, State: "IDLE", X: s.CenterX, Z: s.CenterZ}
		switch id {
		case "dead":
			p.Health = 0
		case "offline":
			p.Disconnected = true
		case "town":
			p.InstanceID = ""
		case "far":
			p.X += 120
		}
		w.AddEntity(p)
		if id != "outsider" {
			s.Participants = append(s.Participants, id)
		}
	}
	w.AddEntity(&Entity{ID: "attacker", Type: TypeEnemy, InstanceID: "raid", Health: 1, X: s.CenterX, Z: s.CenterZ})
	players, defeated, contested := w.observeCrystalVigil(s, []string{"removed", "attacker"})
	if len(players) != 1 || players[0].ID != "tank" || defeated || !contested {
		t.Fatalf("invalid participation or attacker observation: %+v %v %v", players, defeated, contested)
	}
}
