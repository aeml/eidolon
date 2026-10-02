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

func TestBlackjackPublicParticipantsNeedNoSavedSeatTokens(t *testing.T) {
	oldWorld, oldCache, oldAvailable := world, blackjackCached, blackjackAvailable
	t.Cleanup(func() { world, blackjackCached, blackjackAvailable = oldWorld, oldCache, oldAvailable })
	privateSession := strings.Repeat("ab", 16)
	world = &game.World{Entities: map[string]*game.Entity{"player-alice": {
		ID: "player-alice", Type: game.TypePlayer, Health: 100, InstanceID: game.CasinoInstanceID,
		CasinoSeat: &game.CasinoSeatSession{TableID: publicBlackjackTable, Seat: 0, SessionID: privateSession},
	}}}
	lobby, err := newBlackjackLobby()
	if err != nil {
		t.Fatal(err)
	}
	lobby.Players = []blackjackParticipant{{PlayerID: "player-alice", Name: "Alice", Seat: 0, Bet: 100}}
	encode := func() *database.BlackjackTableRecord {
		t.Helper()
		data, err := json.Marshal(lobby)
		if err != nil {
			t.Fatal(err)
		}
		return &database.BlackjackTableRecord{TableID: publicBlackjackTable, State: data}
	}
	blackjackCached, blackjackAvailable = encode(), true
	saved, err := decodeBlackjackState(blackjackCached)
	if err != nil || len(saved.Players) != 1 || strings.Contains(string(blackjackCached.State), privateSession) {
		t.Fatal("legacy participant data changed or acquired a private token", err)
	}
	view := blackjackViewFor("observer")
	public, err := json.Marshal(view)
	if err != nil || !view.Available || len(view.Players) != 1 || strings.Contains(string(public), "seatSession") || strings.Contains(string(public), privateSession) {
		t.Fatal("private seat binding leaked to the table", string(public), err)
	}
}

func TestBlackjackMongoTimeoutReleasesChairWithoutChangingSettlement(t *testing.T) {
	for _, scenario := range []string{"current-seat", "resumed-same-seat", "other-seat"} {
		t.Run(scenario, func(t *testing.T) {
			_, name, _ := setupSlotMongo(t)
			oldWorld, oldCache, oldAvailable := world, blackjackCached, blackjackAvailable
			t.Cleanup(func() { world, blackjackCached, blackjackAvailable = oldWorld, oldCache, oldAvailable })
			world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
			table, _ := game.CasinoTableByID(publicBlackjackTable)
			if _, err := db.GetBlackjackTable(table.ID); !errors.Is(err, mongo.ErrNoDocuments) {
				t.Fatal("requires an unused disposable blackjack table; refusing existing state", err)
			}
			p := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, InstanceID: game.CasinoInstanceID,
				State: "IDLE", Health: 100, MaxHealth: 100, Gold: 300, X: table.Seats[0].ExitX, Z: table.Seats[0].ExitZ}
			world.AddEntity(p)
			now := time.Now()
			seat, err := world.TakeCasinoSeat(p.ID, table.ID, 0, now)
			if err != nil {
				t.Fatal(err)
			}
			lobby, err := newBlackjackLobby()
			if err != nil {
				t.Fatal(err)
			}
			encoded, _ := json.Marshal(lobby)
			if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
				t.Fatal(err)
			}
			setupEPRecordCleanup(t, table.ID)
			client := &Client{playerID: p.ID, username: name}
			unlock := lockCharacterWork(name)
			err = handleBlackjackBet(client, seat.SessionID, lobby.RoundID, 100, now)
			unlock()
			if err != nil {
				t.Fatal(err)
			}
			// A valid prepared shoe isolates timeout persistence and settlement.
			// This is not a random earned round or an odds/RTP test.
			shoe := []int{}
			removed := map[int]int{9: 2, 5: 1, 6: 1}
			for i := 0; i < 312; i++ {
				card := i % 52
				if removed[card] > 0 {
					removed[card]--
				} else {
					shoe = append(shoe, card)
				}
			}
			blackjackMu.Lock()
			record, state, err := loadBlackjackLocked(table.ID)
			if err == nil {
				state.Phase = "playing"
				state.Round = &game.BlackjackRound{ID: state.RoundID, Rules: game.BlackjackRulesVersion, Currency: "gold", Revision: 1,
					Phase: "playing", Dealer: []int{9, 6}, Deck: shoe, Deadline: now.Add(game.BlackjackTurnTime),
					Players: []game.BlackjackPlayer{{PlayerID: p.ID, Seat: 0, Hands: []game.BlackjackHand{{Cards: []int{9, 5}, Bet: 100}}}}}
				err = state.Round.Validate()
				if err == nil {
					err = advanceBlackjackLocked(record, state)
				}
			}
			blackjackMu.Unlock()
			if err != nil {
				t.Fatal(err)
			}
			if scenario != "current-seat" {
				if err := world.ChangeCasinoSeat(p.ID, seat.SessionID, "leave", false, now, ""); err != nil {
					t.Fatal(err)
				}
				index := 0
				if scenario == "other-seat" {
					index = 1
					p.X, p.Z = table.Seats[index].ExitX, table.Seats[index].ExitZ
				}
				if _, err := world.TakeCasinoSeat(p.ID, table.ID, index, now); err != nil {
					t.Fatal(err)
				}
			}
			deadline := state.Round.Deadline
			if scenario == "other-seat" {
				view := blackjackViewFor(p.ID)
				if view.Round == nil || len(view.Round.Actions) != 0 {
					t.Fatal("another chair offered actions for the earlier wager")
				}
				if err := handleBlackjackPlay(client, p.CasinoSeat.SessionID, state.RoundID, "stand", state.Round.Revision, deadline.Add(-time.Second)); err == nil {
					t.Fatal("another chair controlled the earlier funded hand")
				}
			} else if len(blackjackViewFor(p.ID).Round.Actions) == 0 {
				t.Fatal("the current or resumed funded chair lost legal actions")
			}
			if err := tickBlackjack(deadline.Add(-time.Nanosecond), table.ID); err != nil || p.CasinoSeat == nil {
				t.Fatal("early tick released the chair", err)
			}
			if err := tickBlackjack(deadline, table.ID); err != nil {
				t.Fatal(err)
			}
			if (p.CasinoSeat == nil) != (scenario != "other-seat") {
				t.Fatal("timeout released the wrong session", scenario)
			}
			for i := 0; i < 3; i++ {
				if err := tickBlackjack(deadline, table.ID); err != nil {
					t.Fatal(err)
				}
			}
			blackjackMu.Lock()
			_, settled, err := loadBlackjackLocked(table.ID)
			blackjackMu.Unlock()
			if err != nil || settled.Phase != "complete" || settled.Round.Players[0].Hands[0].Outcome != "lose" || settled.Round.Players[0].Hands[0].Payout != 0 || p.Gold != 200 || p.EP != 0 {
				t.Fatal("timeout changed the saved hand or currency", err)
			}
			saved, err := db.GetCharacter(name, name)
			if err != nil || saved.Gold != 200 {
				t.Fatal("timeout recharged the accepted wager", err)
			}
		})
	}
}
