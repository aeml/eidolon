package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/mongo"
)

// Prepared full-shoe round isolates timeout ownership and saved settlement,
// not random dealing or measured house advantage.
func preparedTimeoutBlackjack(t *testing.T, state *blackjackTableState, currency string, now time.Time) {
	t.Helper()
	p := state.Players[0]
	round := &game.BlackjackRound{ID: state.RoundID, Rules: game.BlackjackRulesVersion, Currency: currency, Revision: 1,
		Phase: "playing", Dealer: []int{9, 6}, TurnPlayer: 0, TurnHand: 0, Deadline: now.Add(30 * time.Second),
		Players: []game.BlackjackPlayer{{PlayerID: p.PlayerID, Seat: p.Seat, Hands: []game.BlackjackHand{{Cards: []int{9, 8}, Bet: p.Bet}}}}}
	used := map[int]int{9: 2, 6: 1, 8: 1}
	for copy := 0; copy < 6; copy++ {
		for card := 0; card < 52; card++ {
			if used[card] > 0 {
				used[card]--
			} else {
				round.Deck = append(round.Deck, card)
			}
		}
	}
	if err := round.Validate(); err != nil {
		t.Fatal("invalid prepared full shoe", err)
	}
	state.Phase, state.Round = "playing", round
}

func TestBlackjackMongoTimeoutChairAndSavedPayout(t *testing.T) {
	for _, tc := range []struct {
		currency string
		reseat   bool
	}{{"gold", false}, {"gold", true}, {"ep", false}} {
		name := tc.currency
		if tc.reseat {
			name += "-reseated"
		}
		t.Run(name, func(t *testing.T) {
			oldWorld, oldExtra, oldAvailable, oldLoader := world, extraBlackjack, extraBlackjackAvailable, loadVIPPeriods
			t.Cleanup(func() {
				world, extraBlackjack, extraBlackjackAvailable, loadVIPPeriods = oldWorld, oldExtra, oldAvailable, oldLoader
			})
			_, username, _ := setupSlotMongo(t)
			extraBlackjack, extraBlackjackAvailable = map[string]*database.BlackjackTableRecord{}, map[string]bool{}
			now := time.Now()
			tableID := "public-blackjack-earth"
			if tc.currency == "ep" {
				tableID = "vip-blackjack-earth"
			}
			table, ok := game.CasinoTableByID(tableID)
			if !ok {
				t.Fatal("missing prepared table", tableID)
			}
			state, _ := newBlackjackLobby()
			encoded, _ := json.Marshal(state)
			if _, err := db.GetBlackjackTable(table.ID); !errors.Is(err, mongo.ErrNoDocuments) {
				t.Fatal("refusing to replace an existing casino table", err)
			}
			if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
				t.Fatal(err)
			}
			setupEPRecordCleanup(t, table.ID)
			world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
			position := table.Seats[0]
			player := &game.Entity{ID: "player-" + username, Name: username, Type: game.TypePlayer, InstanceID: game.CasinoInstanceID,
				State: "IDLE", Health: 100, MaxHealth: 100, Gold: 300, X: position.ExitX, Y: table.Y, Z: position.ExitZ}
			world.AddEntity(player)
			client := &Client{playerID: player.ID, username: username}
			if tc.currency == "ep" {
				period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(-time.Hour).AddDate(0, 1, 0))
				if err != nil {
					t.Fatal(err)
				}
				loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
				if err := requireCasinoVIPLocked(client, now); err != nil {
					t.Fatal(err)
				}
				player.X, player.Y, player.Z = 0, 0, 104
				if err := world.ChangeCasinoFloor(player.ID, true, now); err != nil {
					t.Fatal(err)
				}
				player.X, player.Z = position.ExitX, position.ExitZ
			}
			seat, err := world.TakeCasinoSeat(player.ID, table.ID, 0, now)
			if err != nil {
				t.Fatal(err)
			}
			bet := 100
			if tc.currency == "ep" {
				bet = 20
			}
			unlock := lockCharacterWork(username)
			err = handleBlackjackBet(client, seat.SessionID, state.RoundID, bet, now)
			unlock()
			if err != nil {
				t.Fatal(err)
			}
			r, state, err := loadBlackjackLocked(table.ID)
			if err != nil {
				t.Fatal("funded wager not retained", err)
			}
			preparedTimeoutBlackjack(t, state, tc.currency, now)
			if err := advanceBlackjackLocked(r, state); err != nil {
				t.Fatal(err)
			}
			public, _ := json.Marshal(blackjackViewFor(player.ID))
			if strings.Contains(string(public), seat.SessionID) || strings.Contains(string(public), "seatSessions") || strings.Contains(string(public), "timedOut") {
				t.Fatal("private ownership escaped to public view")
			}
			deadline := state.Round.Deadline
			if err := tickBlackjack(deadline.Add(-time.Millisecond), table.ID); err != nil {
				t.Fatal(err)
			}
			if player.CasinoSeat == nil {
				t.Fatal("early chair release")
			}
			if tc.reseat {
				if err := world.ChangeCasinoSeat(player.ID, seat.SessionID, "leave", false, now, ""); err != nil {
					t.Fatal(err)
				}
				if _, err := world.TakeCasinoSeat(player.ID, table.ID, 0, now); err != nil {
					t.Fatal(err)
				}
			}
			captured := world.GetEntityCopy(player.ID).CasinoSeat
			if err := tickBlackjack(deadline, table.ID); err != nil {
				t.Fatal(err)
			}
			if player.CasinoSeat != nil {
				t.Fatal("timeout chair ownership incorrect")
			}
			if player.CasinoSeat == nil {
				if player.State != "IDLE" || player.X != seat.ExitX || player.Z != seat.ExitZ {
					t.Fatal("timeout exit/controls not restored")
				}
				_, retained, err := loadBlackjackLocked(table.ID)
				if err != nil || retained.TimedOutSeats[player.ID] != captured.SessionID {
					t.Fatal("saved timeout release fence missing", err)
				}
				public, _ := json.Marshal(blackjackViewFor(player.ID))
				if strings.Contains(string(public), captured.SessionID) || strings.Contains(string(public), "timedOutSeats") {
					t.Fatal("private timeout fence escaped to public view")
				}
				// Simulate a missed world update after the saved timeout. A later
				// tick must retry the exact release before chair turnover.
				player.CasinoSeat, player.State = captured, "SEATED"
				if err := tickBlackjack(deadline, table.ID); err != nil || player.CasinoSeat != nil {
					t.Fatal("saved timeout release was not retried", err)
				}
				replacement := &game.Entity{ID: "player-replacement", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID,
					State: "IDLE", Health: 100, X: seat.ExitX, Y: table.Y, Z: seat.ExitZ, CasinoVIPFloor: player.CasinoVIPFloor, VIPUntil: player.VIPUntil}
				world.AddEntity(replacement)
				if _, err := world.TakeCasinoSeat(replacement.ID, table.ID, 0, deadline); err != nil {
					t.Fatal("chair not claimable", err)
				}
			}
			// Re-read the saved timeout and settle twice; neither replay may evict
			// a replacement session or pay the original owner twice.
			// A new chair for the original account after its release must also survive.
			player.X, player.Z = table.Seats[1].ExitX, table.Seats[1].ExitZ
			if _, err := world.TakeCasinoSeat(player.ID, table.ID, 1, deadline); err != nil {
				t.Fatal(err)
			}
			extraBlackjack, extraBlackjackAvailable = map[string]*database.BlackjackTableRecord{}, map[string]bool{}
			for repeat := 0; repeat < 2; repeat++ {
				if err := tickBlackjack(deadline, table.ID); err != nil {
					t.Fatal(err)
				}
			}
			saved, err := db.GetCharacter(username, username)
			if err != nil {
				t.Fatal(err)
			}
			if tc.currency == "gold" && saved.Gold != 400 || tc.currency == "ep" && (saved.EP != 120 || saved.Gold != 300) {
				t.Fatal("saved settlement crossed wallets or duplicated", saved.Gold, saved.EP)
			}
			if player.CasinoSeat == nil || world.GetEntityCopy("player-replacement").CasinoSeat == nil {
				t.Fatal("replayed timeout evicted later patron")
			}
		})
	}
}

func TestBlackjackRejectsInvalidTimeoutOwnership(t *testing.T) {
	state, _ := newBlackjackLobby()
	owner, token := "player-alice", strings.Repeat("ab", 16)
	state.Players = []blackjackParticipant{{PlayerID: owner, Seat: 0, Bet: 100}}
	preparedTimeoutBlackjack(t, state, "gold", time.Now())
	for _, invalid := range []map[string]string{{owner: "invalid"}, {"player-outsider": token}} {
		state.TimedOutSeats = invalid
		encoded, _ := json.Marshal(state)
		if _, err := decodeBlackjackState(&database.BlackjackTableRecord{TableID: publicBlackjackTable, State: encoded}); err == nil {
			t.Fatal("invalid private timeout ownership accepted")
		}
	}
	state.TimedOutSeats = map[string]string{owner: token}
	encoded, _ := json.Marshal(state)
	if _, err := decodeBlackjackState(&database.BlackjackTableRecord{TableID: publicBlackjackTable, State: encoded}); err != nil {
		t.Fatal(err)
	}
	state.Phase, state.Round = "betting", nil
	encoded, _ = json.Marshal(state)
	if _, err := decodeBlackjackState(&database.BlackjackTableRecord{TableID: publicBlackjackTable, State: encoded}); err == nil {
		t.Fatal("lobby accepted a timeout marker")
	}
}
