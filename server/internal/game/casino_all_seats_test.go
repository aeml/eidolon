package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

// Prepared in-memory patrons at each canonical approach, not a walking-path,
// capacity, payment or connected-game benchmark. Exercise every actual chair's
// current ownership, private token, floor transform and ordinary safe exit.
func TestEveryCasinoChairPreservesOwnershipAndCurrencyOnOrdinaryExit(t *testing.T) {
	now := time.Now()
	checked := 0
	for _, table := range CasinoTables() {
		for index, position := range table.Seats {
			t.Run(fmt.Sprintf("%s/%d", table.ID, index), func(t *testing.T) {
				w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
				patron := func(id string) *Entity {
					return &Entity{ID: id, Name: id, Type: TypePlayer, InstanceID: CasinoInstanceID,
						State: "IDLE", Health: 100, MaxHealth: 100, Gold: 1234, EP: 100,
						X: position.ExitX, Y: position.Y, Z: position.ExitZ,
						CasinoVIPFloor: table.Floor == "vip", VIPUntil: now.Add(time.Hour)}
				}
				a, b := patron("owner"), patron("next")
				w.AddEntity(a)
				w.AddEntity(b)
				seat, err := w.TakeCasinoSeat(a.ID, table.ID, index, now)
				if err != nil {
					t.Fatal(err)
				}
				if a.X != position.X || a.Y != position.Y || a.Z != position.Z || a.State != "SEATED" || seat.ExitY != position.Y {
					t.Fatal("canonical seat/floor transform was not used")
				}
				if _, err := w.TakeCasinoSeat(b.ID, table.ID, index, now); err == nil {
					t.Fatal("occupied chair stolen")
				}
				public, _ := json.Marshal(w.CasinoPresenceFor(b.ID, now))
				if strings.Contains(string(public), seat.SessionID) {
					t.Fatal("another patron received the private seat token")
				}
				if err := w.ChangeCasinoSeat(a.ID, seat.SessionID, "leave", false, now, ""); err != nil {
					t.Fatal(err)
				}
				if a.CasinoSeat != nil || a.State != "IDLE" || a.X != position.ExitX || a.Y != position.Y || a.Z != position.ExitZ || a.Gold != 1234 || a.EP != 100 {
					t.Fatal("ordinary leave failed to preserve wallet and floor-specific exit")
				}
				replacement, err := w.TakeCasinoSeat(b.ID, table.ID, index, now)
				if err != nil || replacement == nil || replacement.SessionID == seat.SessionID {
					t.Fatal("chair cannot safely turn over", err)
				}
				if w.ReleaseCasinoSeatForSession(a.ID, table.ID, seat.SessionID) || b.CasinoSeat == nil {
					t.Fatal("old owner ejected replacement")
				}
				checked++
			})
		}
	}
	if checked != 232 {
		t.Fatalf("checked %d chairs, want 232 across 92 stations", checked)
	}
}
