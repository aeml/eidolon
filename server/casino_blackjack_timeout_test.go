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

func TestBlackjackPrivateSeatOwnershipValidation(t *testing.T) {
	state, _ := newBlackjackLobby()
	owner, token := "player-alice", strings.Repeat("a", 32)
	state.Players = []blackjackParticipant{{PlayerID: owner, Seat: 0, Bet: 100}}
	state.SeatSessions = map[string]string{owner: token}
	check := func(valid bool) {
		t.Helper()
		encoded, _ := json.Marshal(state)
		_, err := decodeBlackjackState(&database.BlackjackTableRecord{TableID: publicBlackjackTable, State: encoded})
		if (err == nil) != valid {
			t.Fatal("ownership validation mismatch", valid, err)
		}
	}
	check(true)
	state.SeatSessions["player-outsider"] = token
	check(false)
	delete(state.SeatSessions, "player-outsider")
	state.SeatSessions[owner] = "invalid"
	check(false)
	state.SeatSessions = nil // Older funded rounds remain readable.
	check(true)
	state.TimedOut = map[string]bool{owner: true}
	check(false)
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
			if err != nil || state.SeatSessions[player.ID] != seat.SessionID {
				t.Fatal("funded ownership not retained", err)
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
			if err := tickBlackjack(deadline, table.ID); err != nil {
				t.Fatal(err)
			}
			if (player.CasinoSeat != nil) != tc.reseat {
				t.Fatal("timeout chair ownership incorrect")
			}
			if !tc.reseat {
				if player.State != "IDLE" || player.X != seat.ExitX || player.Z != seat.ExitZ {
					t.Fatal("timeout exit/controls not restored")
				}
				replacement := &game.Entity{ID: "player-replacement", Type: game.TypePlayer, InstanceID: game.CasinoInstanceID,
					State: "IDLE", Health: 100, X: seat.ExitX, Y: table.Y, Z: seat.ExitZ, CasinoVIPFloor: player.CasinoVIPFloor, VIPUntil: player.VIPUntil}
				world.AddEntity(replacement)
				if _, err := world.TakeCasinoSeat(replacement.ID, table.ID, 0, deadline); err != nil {
					t.Fatal("chair not claimable", err)
				}
			}
			// Re-read the saved timeout and settle twice; neither replay may evict
			// a replacement/re-seated session or pay the original owner twice.
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
			if tc.reseat && player.CasinoSeat == nil || !tc.reseat && world.GetEntityCopy("player-replacement").CasinoSeat == nil {
				t.Fatal("replayed timeout evicted later patron")
			}
		})
	}
}
