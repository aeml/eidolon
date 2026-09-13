package game

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"
)

func casinoSeatWorld() (*World, *Entity, *Entity, CasinoTable) {
	table := CasinoTables()[0]
	position := table.Seats[0]
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	a := &Entity{ID: "alice", Name: "Alice", Type: TypePlayer, InstanceID: CasinoInstanceID, State: "IDLE", Health: 100, MaxHealth: 100, Mana: 50, MaxMana: 50, X: position.ExitX, Z: position.ExitZ}
	b := &Entity{ID: "bob", Name: "Bob", Type: TypePlayer, InstanceID: CasinoInstanceID, State: "IDLE", Health: 100, MaxHealth: 100, X: position.ExitX, Z: position.ExitZ}
	w.AddEntity(a)
	w.AddEntity(b)
	return w, a, b, table
}

func TestCasinoSeatAtomicOwnershipAndPrivateSessions(t *testing.T) {
	w, a, b, table := casinoSeatWorld()
	now := time.Now()
	var wg sync.WaitGroup
	results := make(chan string, 2)
	for _, id := range []string{a.ID, b.ID} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			if _, err := w.TakeCasinoSeat(id, table.ID, 0, now); err == nil {
				results <- id
			}
		}(id)
	}
	wg.Wait()
	close(results)
	winners := []string{}
	for id := range results {
		winners = append(winners, id)
	}
	if len(winners) != 1 {
		t.Fatal("non-exclusive seat", winners)
	}
	owner := winners[0]
	seat := w.CasinoPresenceFor(owner, now).YourSeat
	if seat == nil {
		t.Fatal("missing owner session")
	}
	public := w.CasinoPresenceFor("observer", now)
	encoded, _ := json.Marshal(public)
	if public.YourSeat != nil || strings.Contains(string(encoded), seat.SessionID) {
		t.Fatal("private session leaked")
	}
	if _, err := w.TakeCasinoSeat(owner, table.ID, 1, now); err == nil {
		t.Fatal("double seat")
	}
	if err := w.ChangeCasinoSeat(owner, "wrong", "leave", false, now, ""); err == nil {
		t.Fatal("stale command")
	}
	if err := w.ChangeCasinoSeat(owner, seat.SessionID, "ready", true, now, public.Preparation[table.ID].Revision); err != nil {
		t.Fatal(err)
	}
	if !w.CasinoPresenceFor(owner, now).YourSeat.Ready {
		t.Fatal("ready state not shared")
	}
	copy := w.GetEntityCopy(owner)
	copy.CasinoSeat.Ready = false
	if !w.GetEntityCopy(owner).CasinoSeat.Ready {
		t.Fatal("snapshot aliases seat")
	}
	if err := w.ChangeCasinoSeat(owner, seat.SessionID, "leave", false, now, ""); err != nil {
		t.Fatal(err)
	}
	player := w.GetEntityCopy(owner)
	if player.State != "IDLE" || player.X != seat.ExitX || player.Z != seat.ExitZ || player.CasinoSeat != nil {
		t.Fatal("did not restore safe exit")
	}
	if w.UpdatePlayerMovementWithContext(owner, 0, 0, 200, 0, "MOVING", 1, "casino-seat:"+seat.SessionID) {
		t.Fatal("departed seat movement context accepted")
	}
}

func TestCasinoPreparationRosterConsentAndRealPlayerMinimum(t *testing.T) {
	for _, table := range CasinoTables()[:2] {
		t.Run(table.Game, func(t *testing.T) {
			w, a, b, _ := casinoSeatWorld()
			now := time.Now()
			a.X, a.Z = table.Seats[0].ExitX, table.Seats[0].ExitZ
			b.X, b.Z = table.Seats[1].ExitX, table.Seats[1].ExitZ
			seatA, err := w.TakeCasinoSeat(a.ID, table.ID, 0, now)
			if err != nil {
				t.Fatal(err)
			}
			ready := func(id, session string) {
				t.Helper()
				revision := w.CasinoPresenceFor(id, now).Preparation[table.ID].Revision
				if err := w.ChangeCasinoSeat(id, session, "ready", true, now, revision); err != nil {
					t.Fatal(err)
				}
			}
			ready(a.ID, seatA.SessionID)
			solo := w.CasinoPresenceFor(a.ID, now).Preparation[table.ID]
			if table.Game == "poker" && solo.Phase != "waiting_players" {
				t.Fatal("solo poker allowed", solo)
			}
			if table.Game == "blackjack" && solo.Phase != "ready" {
				t.Fatal("solo blackjack blocked", solo)
			}
			seatB, err := w.TakeCasinoSeat(b.ID, table.ID, 1, now)
			if err != nil {
				t.Fatal(err)
			}
			joined := w.CasinoPresenceFor(a.ID, now)
			if joined.YourSeat.Ready || joined.Preparation[table.ID].Phase != "preparing" {
				t.Fatal("join retained old consent", joined)
			}
			if err := w.ChangeCasinoSeat(a.ID, seatA.SessionID, "ready", true, now, solo.Revision); err == nil {
				t.Fatal("delayed readiness accepted")
			}
			ready(a.ID, seatA.SessionID)
			ready(b.ID, seatB.SessionID)
			both := w.CasinoPresenceFor(a.ID, now).Preparation[table.ID]
			if both.Phase != "ready" || both.Ready != 2 {
				t.Fatal("shared readiness missing", both)
			}
			w.SetEntityDisconnected(b.ID, now)
			if p := w.CasinoPresenceFor(a.ID, now).Preparation[table.ID]; p.Phase != "waiting_reconnect" || p.Ready != 0 {
				t.Fatal("disconnected roster still ready", p)
			}
			w.ClearEntityDisconnected(b.ID)
			if err := w.ChangeCasinoSeat(a.ID, seatA.SessionID, "ready", true, now, both.Revision); err == nil {
				t.Fatal("reconnect revived old revision")
			}
			ready(a.ID, seatA.SessionID)
			if err := w.ChangeCasinoSeat(b.ID, seatB.SessionID, "leave", false, now, ""); err != nil {
				t.Fatal(err)
			}
			if w.CasinoPresenceFor(a.ID, now).YourSeat.Ready {
				t.Fatal("departure retained readiness")
			}
		})
	}
}

func TestCasinoSeatPhysicalRangeCombatAndReconnect(t *testing.T) {
	w, a, b, table := casinoSeatWorld()
	now := time.Now()
	a.X = 100
	if _, err := w.TakeCasinoSeat(a.ID, table.ID, 0, now); err == nil {
		t.Fatal("remote seating")
	}
	a.X = table.Seats[0].ExitX
	a.InstanceID = "dungeon-other"
	if _, err := w.TakeCasinoSeat(a.ID, table.ID, 0, now); err == nil {
		t.Fatal("cross-scene seating")
	}
	a.InstanceID = CasinoInstanceID
	seat, err := w.TakeCasinoSeat(a.ID, table.ID, 0, now)
	if err != nil {
		t.Fatal(err)
	}
	if w.UpdatePlayerMovement(a.ID, 0, 0, 200, 0, "IDLE", 1) || w.StartPlayerJump(a.ID, 0, 0, 200) {
		t.Fatal("seated movement accepted")
	}
	if result := w.PerformAbility(a.ID, 0, 200, "", "Fireball"); result.Reason != "action_locked" {
		t.Fatal("seated cast accepted", result)
	}
	if _, hit := w.PerformAttack(a.ID, b.ID); hit {
		t.Fatal("seated attack accepted")
	}
	w.SetEntityDisconnected(a.ID, now)
	if _, err := w.TakeCasinoSeat(b.ID, table.ID, 0, now.Add(30*time.Second)); err == nil {
		t.Fatal("stolen reconnect reservation")
	}
	if _, ok := w.ClearEntityDisconnected(a.ID); !ok || a.CasinoSeat == nil || a.State != "SEATED" {
		t.Fatal("resume lost chair")
	}
	if a.CasinoSeat.SessionID != seat.SessionID {
		t.Fatal("resume changed session")
	}
	w.SetEntityDisconnected(a.ID, now.Add(-2*time.Minute))
	if _, err := w.TakeCasinoSeat(b.ID, table.ID, 0, now); err != nil {
		t.Fatal("expired reservation not released", err)
	}
	if a.CasinoSeat != nil || a.X != seat.ExitX || a.Z != seat.ExitZ {
		t.Fatal("expired owner stranded")
	}
}

func TestCasinoSeatSceneTransitionAndCatalogCopies(t *testing.T) {
	w, a, _, table := casinoSeatWorld()
	now := time.Now()
	seat, err := w.TakeCasinoSeat(a.ID, table.ID, 0, now)
	if err != nil {
		t.Fatal(err)
	}
	a.InstanceID = "dungeon-new"
	a.X = 21
	a.Z = 32
	w.CasinoPresenceFor(a.ID, now)
	if a.CasinoSeat != nil || a.X != 21 || a.Z != 32 {
		t.Fatal("seat cleanup overwrote new scene")
	}
	a.CasinoSeat = seat
	resetSceneMovementLocked(a)
	if a.CasinoSeat != nil {
		t.Fatal("scene lifecycle retained seat")
	}
	first := CasinoTables()
	first[0].Seats[0].X = 999
	if CasinoTables()[0].Seats[0].X == 999 {
		t.Fatal("catalog alias")
	}
}
