package game

import "testing"

func TestPvPReturnsEntryResourcesOnEveryExit(t *testing.T) {
	for _, exit := range []string{"win", "forfeit", "maintenance", "timeout"} {
		t.Run(exit, func(t *testing.T) {
			a := &Entity{ID: "a", Type: TypePlayer, MaxHealth: 100, Health: 23, MaxMana: 80, Mana: 7}
			b := &Entity{ID: "b", Type: TypePlayer, MaxHealth: 100, Health: 61, MaxMana: 80, Mana: 0}
			w := newPvPTestWorld(a, b)
			match := startTestPvPMatch(w, PvPModeArena1v1, []string{a.ID}, []string{b.ID})
			if a.Health != 100 || a.Mana != 80 || b.Health != 100 || b.Mana != 80 {
				t.Fatal("arena must still start with full resources")
			}
			a.Health, a.Mana, b.Health, b.Mana = 5, 2, 0, 0
			switch exit {
			case "win":
				w.PvP.Matches[match.ID].Status = PvPMatchComplete
				w.PvP.Matches[match.ID].WinnerIDs = []string{a.ID}
				w.completePvPMatch(match.ID, false)
			case "forfeit":
				w.ForfeitPvP(a.ID)
			case "maintenance":
				w.FinishPvPForShutdown()
			case "timeout":
				w.UpdatePvP(match.EndsAt.Add(1))
			}
			if a.Health != 23 || a.Mana != 7 || b.Health != 61 || b.Mana != 0 || a.InstanceID != "" || b.InstanceID != "" {
				t.Fatalf("entry resources not restored: a=%d/%d b=%d/%d", a.Health, a.Mana, b.Health, b.Mana)
			}
		})
	}
}

func TestDuelRevalidatesPlayersOnAcceptance(t *testing.T) {
	for _, change := range []string{"party", "queue", "distance", "dead", "offline", "instance"} {
		t.Run(change, func(t *testing.T) {
			a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
			w := newPvPTestWorld(a, b)
			if _, err := w.RequestDuel(a.ID, b.ID); err != nil {
				t.Fatal(err)
			}
			switch change {
			case "party":
				a.PartyID, b.PartyID = "allies", "allies"
			case "queue":
				if _, err := w.JoinArenaQueue(a.ID, 1); err != nil {
					t.Fatal(err)
				}
			case "distance":
				b.X = 100
			case "dead":
				b.Health = 0
			case "offline":
				b.Disconnected = true
			case "instance":
				b.InstanceID = "dungeon"
			}
			if _, err := w.RespondDuel(b.ID, a.ID, true); err == nil {
				t.Fatal("accepted a now-invalid challenge")
			}
			if _, err := w.RequestDuel(a.ID, b.ID); err == nil {
				t.Fatal("created an invalid challenge")
			}
			if w.HasPvPMatch(a.ID) || w.HasPvPMatch(b.ID) {
				t.Fatal("failed admission reserved a match")
			}
		})
	}
}
