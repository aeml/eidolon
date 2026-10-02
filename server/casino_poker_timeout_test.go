package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestPokerMongoDecisionTimeoutReleasesChairAndConservesFunds(t *testing.T) {
	for _, scenario := range []string{"facing-bet", "free-check", "resumed-seat"} {
		t.Run(scenario, func(t *testing.T) {
			oldWorld := world
			t.Cleanup(func() { world = oldWorld })
			clients, tokens := setupPokerMongo(t)
			initial := pokerViewFor(clients[0].playerID)
			for i, c := range clients {
				unlock := lockCharacterWork(c.username)
				err := handlePokerBuyIn(c, tokens[i], initial.RoundID, 100, time.Now())
				unlock()
				if err != nil {
					t.Fatal(err)
				}
			}
			view := pokerViewFor(clients[0].playerID)
			if err := tickPoker(view.DealAt); err != nil {
				t.Fatal(err)
			}
			view = pokerViewFor(clients[0].playerID)
			want := []int{295, 305} // Small blind folds: 95 returned, big blind receives 105.
			if scenario == "free-check" {
				unlock := lockCharacterWork(clients[0].username)
				err := handlePokerPlay(clients[0], tokens[0], view.RoundID, "call", 0, view.Round.Revision, view.Round.Deadline.Add(-time.Second))
				unlock()
				if err != nil {
					t.Fatal(err)
				}
				view = pokerViewFor(clients[1].playerID)
				want = []int{310, 290} // Both committed 10; big blind folds its remaining 90.
			}
			if view.Round == nil || view.Phase != "playing" {
				t.Fatal("two real funded seats did not begin a hand")
			}
			turn := 0
			if view.Round.TurnPlayerID == clients[1].playerID {
				turn = 1
			}
			if scenario == "free-check" && view.Round.CallAmount != 0 {
				t.Fatal("fixture did not reach a free-check decision")
			}
			if scenario == "resumed-seat" {
				// Retire/reacquire only ephemeral world seating, as after restart.
				// The saved funded hand and its account ownership remain unchanged.
				if err := world.ChangeCasinoSeat(clients[turn].playerID, tokens[turn], "leave", false, time.Now(), ""); err != nil {
					t.Fatal(err)
				}
				seat, err := world.TakeCasinoSeat(clients[turn].playerID, publicPokerTable, turn, time.Now())
				if err != nil || seat.SessionID == tokens[turn] {
					t.Fatal("fixture did not acquire a fresh session", err)
				}
				tokens[turn] = seat.SessionID
			}
			deadline := view.Round.Deadline
			if err := tickPoker(deadline.Add(-time.Nanosecond)); err != nil || world.GetEntityCopy(clients[turn].playerID).CasinoSeat == nil {
				t.Fatal("early decision tick released the chair", err)
			}
			if err := tickPoker(deadline); err != nil {
				t.Fatal(err)
			}
			if world.GetEntityCopy(clients[turn].playerID).CasinoSeat != nil || world.GetEntityCopy(clients[1-turn].playerID).CasinoSeat == nil {
				t.Fatal("timeout did not release only the current player's chair")
			}
			if err := validatePokerSeatClaim("player-waiting-visitor", turn); err != nil {
				t.Fatal("folded hand still reserves its released chair", err)
			}
			table, _ := game.CasinoTableByID(publicPokerTable)
			visitor := &game.Entity{ID: "player-waiting-visitor", Name: "Waiting visitor", Type: game.TypePlayer,
				InstanceID: game.CasinoInstanceID, State: "IDLE", Health: 100, X: table.Seats[turn].ExitX, Z: table.Seats[turn].ExitZ}
			world.AddEntity(visitor)
			if _, err := world.TakeCasinoSeat(visitor.ID, table.ID, turn, deadline); err != nil {
				t.Fatal("a waiting visitor cannot claim the released chair", err)
			}
			for i := 0; i < 4; i++ {
				if err := tickPoker(deadline); err != nil {
					t.Fatal(err)
				}
			}
			settled := pokerViewFor(clients[1-turn].playerID)
			if settled.Phase != "complete" || settled.Round == nil || !settled.Round.Players[turn].Folded || settled.Round.Showdown {
				t.Fatal("timeout did not persist the fold and complete normal settlement")
			}
			if visitor.CasinoSeat == nil || world.ReleaseCasinoSeatForSession(clients[turn].playerID, table.ID, tokens[turn]) {
				t.Fatal("a repeated timeout stole the visitor's chair")
			}
			for i, c := range clients {
				player := world.GetEntityCopy(c.playerID)
				saved, err := db.GetCharacter(c.username, c.username)
				if err != nil || player.Gold != want[i] || saved.Gold != want[i] || player.EP != 0 || saved.EP != 0 {
					t.Fatal("timeout changed stakes, replayed a debit or mixed wallets", i, err)
				}
			}
		})
	}
}
