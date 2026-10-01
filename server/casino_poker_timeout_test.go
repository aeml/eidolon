package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestPokerMongoTimeoutChairAndSavedCashOut(t *testing.T) {
	for _, currency := range []string{"gold", "ep"} {
		t.Run(currency, func(t *testing.T) {
			oldWorld, oldLoader := world, loadVIPPeriods
			t.Cleanup(func() { world, loadVIPPeriods = oldWorld, oldLoader })
			clients, tokens := setupPokerMongo(t)
			now, tableID, buyIn := time.Now(), publicPokerTable, 100
			if currency == "ep" {
				tableID, buyIn = "vip-poker", 20
				period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(-time.Hour).AddDate(0, 1, 0))
				if err != nil {
					t.Fatal(err)
				}
				loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
				for i, client := range clients {
					player := world.Entities[client.playerID]
					if err := world.ChangeCasinoSeat(player.ID, tokens[i], "leave", false, now, ""); err != nil {
						t.Fatal(err)
					}
					if err := requireCasinoVIPLocked(client, now); err != nil {
						t.Fatal(err)
					}
					player.X, player.Y, player.Z = 0, 0, 104
					if err := world.ChangeCasinoFloor(player.ID, true, now); err != nil {
						t.Fatal(err)
					}
					table, _ := game.CasinoTableByID(tableID)
					player.X, player.Z = table.Seats[i].ExitX, table.Seats[i].ExitZ
					seat, err := world.TakeCasinoSeat(player.ID, tableID, i, now)
					if err != nil {
						t.Fatal(err)
					}
					tokens[i] = seat.SessionID
				}
			}
			view := pokerViewFor(clients[0].playerID)
			for i, client := range clients {
				unlock := lockCharacterWork(client.username)
				err := handlePokerBuyIn(client, tokens[i], view.RoundID, buyIn, now)
				unlock()
				if err != nil {
					t.Fatal(err)
				}
			}
			view = pokerViewFor(clients[0].playerID)
			if err := tickPoker(view.DealAt, tableID); err != nil {
				t.Fatal(err)
			}
			view = pokerViewFor(clients[0].playerID)
			if view.Phase != "playing" || view.Round == nil {
				t.Fatal("real-player hand did not start")
			}
			owner := view.Round.TurnPlayerID
			player := world.GetEntityCopy(owner)
			original := player.CasinoSeat
			// Model an authenticated walk-back to the same funded chair after
			// restart: ownership survives, but the ephemeral live token changes.
			if err := world.ChangeCasinoSeat(owner, original.SessionID, "leave", false, now, ""); err != nil {
				t.Fatal(err)
			}
			seat, err := world.TakeCasinoSeat(owner, tableID, original.Seat, now)
			if err != nil {
				t.Fatal(err)
			}
			if seat.SessionID == original.SessionID {
				t.Fatal("seat token did not rotate")
			}
			deadline := view.Round.Deadline
			if err := tickPoker(deadline.Add(-time.Millisecond), tableID); err != nil {
				t.Fatal(err)
			}
			if world.GetEntityCopy(owner).CasinoSeat == nil {
				t.Fatal("early chair release")
			}
			if err := tickPoker(deadline, tableID); err != nil {
				t.Fatal(err)
			}
			player = world.GetEntityCopy(owner)
			if player.CasinoSeat != nil || player.State != "IDLE" || player.X != seat.ExitX || player.Z != seat.ExitZ {
				t.Fatal("decision timeout did not release the rejoined chair")
			}
			_, savedState, err := loadPokerLocked(tableID)
			if err != nil {
				t.Fatal(err)
			}
			marked := false
			for _, participant := range savedState.Players {
				if participant.PlayerID == owner {
					marked = participant.TimeoutSeatToken == seat.SessionID
				}
			}
			if !marked {
				t.Fatal("saved timeout ownership missing")
			}
			observer := clients[0].playerID
			if observer == owner {
				observer = clients[1].playerID
			}
			public, _ := json.Marshal(pokerViewFor(observer))
			if strings.Contains(string(public), "timeoutSeatToken") || strings.Contains(string(public), seat.SessionID) {
				t.Fatal("private timeout ownership leaked")
			}
			if err := validatePokerSeatClaim("player-replacement", seat.Seat, tableID); err != nil {
				t.Fatal("released chair still reserved", err)
			}
			replacement := &game.Entity{ID: "player-replacement", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, State: "IDLE", Health: 100,
				X: seat.ExitX, Y: seat.ExitY, Z: seat.ExitZ, CasinoVIPFloor: player.CasinoVIPFloor, VIPUntil: player.VIPUntil}
			world.AddEntity(replacement)
			if _, err := world.TakeCasinoSeat(replacement.ID, tableID, seat.Seat, deadline); err != nil {
				t.Fatal(err)
			}
			// Read saved state on each tick, including repeated cash-out attempts.
			for repeat := 0; repeat < 4; repeat++ {
				if err := tickPoker(deadline, tableID); err != nil {
					t.Fatal(err)
				}
			}
			gold, ep := 0, 0
			for _, client := range clients {
				character, err := db.GetCharacter(client.username, client.username)
				if err != nil {
					t.Fatal(err)
				}
				payout := pokerPayout(savedState, client.playerID)
				if currency == "gold" && character.Gold != 300-buyIn+payout || currency == "ep" && (character.EP != 100-buyIn+payout || character.Gold != 300) {
					t.Fatal("cash-out credited the wrong recipient/amount", client.playerID, character.Gold, character.EP, payout)
				}
				gold += character.Gold
				ep += character.EP
			}
			if gold != 600 || currency == "ep" && ep != 200 || currency == "gold" && ep != 0 {
				t.Fatal("cash-out lost/duplicated chips or crossed currencies", gold, ep)
			}
			if world.GetEntityCopy(replacement.ID).CasinoSeat == nil {
				t.Fatal("saved timeout replay evicted replacement")
			}
		})
	}
}

func TestPokerRejectsInvalidTimeoutOwnership(t *testing.T) {
	state, _ := newPokerLobby(-1)
	state.Players = []pokerParticipant{{PlayerID: "player-owner", Seat: 0, SessionID: strings.Repeat("a", 32), BuyIn: 100}}
	encode := func() *database.BlackjackTableRecord {
		data, _ := json.Marshal(state)
		return &database.BlackjackTableRecord{TableID: publicPokerTable, State: data}
	}
	if _, err := decodePokerState(encode()); err != nil {
		t.Fatal("legacy no-marker state rejected", err)
	}
	for _, token := range []string{"invalid", strings.Repeat("a", 32)} {
		state.Players[0].TimeoutSeatToken = token
		if _, err := decodePokerState(encode()); err == nil {
			t.Fatal("invalid/lobby timeout marker accepted")
		}
	}
}
