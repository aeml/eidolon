package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestHouseTransferRecomputesWagerAndRejectsOutcomeTampering(t *testing.T) {
	now := time.Now()
	for _, kind := range []string{"roulette", "baccarat"} {
		s, _ := newHouseLobby(kind, now)
		spot := "red"
		if kind == "baccarat" {
			spot = "banker"
		}
		encoded, _ := json.Marshal(s)
		next := *s
		next.Players = []houseParticipant{{PlayerID: "player-hero", Name: "Hero", Seat: 0, SessionID: "seat", Wagers: []game.CasinoWager{{Spot: spot, Amount: 20}}}}
		proposed, _ := json.Marshal(next)
		r := &database.BlackjackTableRecord{TableID: "public-" + kind, Version: 2, State: encoded, Pending: &database.BlackjackTransfer{
			ID: fmt.Sprintf("casino:%s:%s:1:wager", kind, s.RoundID), PlayerID: "player-hero", Currency: "gold", Amount: -20, NextState: proposed}}
		if err := validateHouseTransfer(r, s); err != nil {
			t.Fatal("valid wager", kind, err)
		}
		for _, mutation := range []string{"amount", "owner", "currency", "id", "deadline", "outcome"} {
			copyRecord := *r
			op := *r.Pending
			copyRecord.Pending = &op
			candidate := next
			switch mutation {
			case "amount":
				op.Amount = -40
			case "owner":
				op.PlayerID = "player-another"
			case "currency":
				op.Currency = "ep"
			case "id":
				op.ID = "casino:forged:wager"
			case "deadline":
				candidate.DealAt = candidate.DealAt.Add(time.Second)
			case "outcome":
				zero := 0
				candidate.Number = &zero
			}
			op.NextState, _ = json.Marshal(candidate)
			if validateHouseTransfer(&copyRecord, s) == nil {
				t.Fatal("forged intent accepted", kind, mutation)
			}
		}
	}
}

func TestHouseViewRedactsPendingOutcomeAndPrivateSeatToken(t *testing.T) {
	c, _, _ := epWalletFixture(t)
	old := houseCache
	defer func() { houseCache = old }()
	p := world.Entities[c.playerID]
	p.CasinoSeat = &game.CasinoSeatSession{TableID: "public-roulette", Seat: 0, SessionID: "private-secret"}
	s, _ := newHouseLobby("roulette", time.Now())
	zero := 0
	s.Players = []houseParticipant{{PlayerID: c.playerID, Name: "Hero", Seat: 0, SessionID: "private-secret", Wagers: []game.CasinoWager{{Spot: "number:0", Amount: 20}}}}
	s.Phase, s.Number, s.RevealAt = "revealing", &zero, s.DealAt.Add(houseRevealTime)
	encoded, _ := json.Marshal(s)
	houseCache = map[string]houseCacheEntry{"public-roulette": {record: &database.BlackjackTableRecord{TableID: "public-roulette", Version: 1, State: encoded}, available: true}}
	v := houseViewFor(c.playerID)
	payload, _ := json.Marshal(v)
	if v == nil || !v.Available || v.Number != nil || strings.Contains(string(payload), "private-secret") {
		t.Fatal("private round state leaked", string(payload))
	}
	s.Phase = "settling"
	encoded, _ = json.Marshal(s)
	houseCache["public-roulette"].record.State = encoded
	v = houseViewFor(c.playerID)
	if v.Number == nil || *v.Number != 0 || v.Players[0].Payout != 720 {
		t.Fatal("persisted result not projected", v)
	}
}

func setupHouseMongo(t *testing.T, kind, currency string) ([]*Client, []string, string) {
	t.Helper()
	uri, a, _ := setupSlotMongo(t)
	_, b, _ := setupSlotMongo(t)
	oldCache, oldLoader := houseCache, loadVIPPeriods
	houseCache = map[string]houseCacheEntry{}
	t.Cleanup(func() { houseCache, loadVIPPeriods = oldCache, oldLoader })
	now := time.Now()
	period, err := database.NewVIPPeriod(now.Add(-time.Hour), now.Add(-time.Hour).AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return []database.VIPPeriod{period}, nil }
	prefix := "public"
	if currency == "ep" {
		prefix = "vip"
	}
	id := prefix + "-" + kind
	if _, err := db.GetBlackjackTable(id); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatal("refusing pre-existing house table", id, err)
	}
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": id})
		cleanup.Disconnect(context.Background())
	})
	s, _ := newHouseLobby(kind, now)
	encoded, _ := json.Marshal(s)
	if _, err := db.CreateBlackjackTable(id, encoded); err != nil {
		t.Fatal(err)
	}
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	table, _ := game.CasinoTableByID(id)
	clients, tokens := []*Client{}, []string{}
	for index, name := range []string{a, b} {
		point := table.Seats[index]
		p := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, SubType: "Fighter", Level: 1, InstanceID: game.CasinoInstanceID,
			State: "IDLE", Health: 100, MaxHealth: 100, Gold: 300, X: point.ExitX, Z: point.ExitZ, Y: table.Y, CasinoVIPFloor: currency == "ep"}
		world.AddEntity(p)
		c := &Client{playerID: p.ID, username: name}
		if currency == "ep" {
			unlock := lockCharacterWork(name)
			err := requireCasinoVIPLocked(c, now)
			unlock()
			if err != nil {
				t.Fatal(err)
			}
		}
		seat, err := world.TakeCasinoSeat(p.ID, id, index, now)
		if err != nil {
			t.Fatal(err)
		}
		clients = append(clients, c)
		tokens = append(tokens, seat.SessionID)
	}
	houseMu.Lock()
	_, _, err = loadHouseLocked(id)
	houseMu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	return clients, tokens, id
}

func TestHouseMongoSharedRoundsAndReplay(t *testing.T) {
	for _, kind := range []string{"roulette", "baccarat"} {
		for _, currency := range []string{"gold", "ep"} {
			t.Run(kind+"-"+currency, func(t *testing.T) {
				clients, tokens, id := setupHouseMongo(t, kind, currency)
				now := time.Now()
				v := houseViewFor(clients[0].playerID)
				for i, c := range clients {
					spot := []string{"red", "black"}[i]
					if kind == "baccarat" {
						spot = []string{"player", "banker"}[i]
					}
					unlock := lockCharacterWork(c.username)
					for retry := 0; retry < 2; retry++ {
						if err := handleHouseBet(c, tokens[i], v.RoundID, []game.CasinoWager{{Spot: spot, Amount: 20}}, now); err != nil {
							unlock()
							t.Fatal(err)
						}
					}
					if err := handleHouseBet(c, tokens[i], v.RoundID, []game.CasinoWager{{Spot: spot, Amount: 40}}, now); err == nil {
						unlock()
						t.Fatal("replaced funded bet")
					}
					unlock()
					want := 280
					if currency == "ep" {
						want = 80
					}
					if casinoBalance(world.GetEntityCopy(c.playerID), currency) != want {
						t.Fatal("replay charged twice")
					}
				}
				if err := tickHouseTables(v.DealAt, id); err != nil {
					t.Fatal(err)
				}
				v = houseViewFor(clients[0].playerID)
				if v.Phase != "revealing" || len(v.Players) != 2 || v.Number != nil || v.Baccarat != nil {
					t.Fatal("shared round leaked early result", v)
				}
				// Leaving/expiry cannot cancel committed bets or their eventual payout.
				if err := world.ChangeCasinoSeat(clients[0].playerID, tokens[0], "leave", false, now, ""); err != nil {
					t.Fatal(err)
				}
				loadVIPPeriods = func(string) ([]database.VIPPeriod, error) { return nil, errors.New("membership service offline") }
				world.Entities[clients[1].playerID].VIPUntil = time.Time{}
				if err := tickHouseTables(v.RevealAt, id); err != nil {
					t.Fatal(err)
				}
				for i := 0; i < 2; i++ {
					if err := tickHouseTables(v.RevealAt.Add(time.Second), id); err != nil {
						t.Fatal(err)
					}
				}
				r, err := db.GetBlackjackTable(id)
				if err != nil {
					t.Fatal(err)
				}
				s, err := decodeHouseState(r)
				if err != nil || s.Phase != "complete" {
					t.Fatal("round not settled", err)
				}
				for i, c := range clients {
					payout, err := housePayout(s, currency, s.Players[i])
					if err != nil {
						t.Fatal(err)
					}
					saved, err := db.GetCharacter(c.username, c.username)
					if err != nil {
						t.Fatal(err)
					}
					if currency == "gold" && (saved.Gold != 280+payout || saved.EP != 0) {
						t.Fatal("Gold settlement", saved.Gold, saved.EP)
					}
					if currency == "ep" && (saved.EP != 80+payout || saved.Gold != 300) {
						t.Fatal("EP settlement crossed wallets", saved.EP, saved.Gold)
					}
				}
				// Process-cache loss preserves the same result and never pays twice.
				houseCache = map[string]houseCacheEntry{}
				if err := tickHouseTables(s.FinishedAt, id); err != nil {
					t.Fatal(err)
				}
				if err := tickHouseTables(s.FinishedAt.Add(casinoResultPause), id); err != nil {
					t.Fatal(err)
				}
				view := houseViewFor(clients[1].playerID)
				if view.Phase != "betting" || view.RoundID == s.RoundID || len(view.Players) != 0 || !view.DealAt.After(s.FinishedAt) {
					t.Fatal("next round waited for wager", view)
				}
				deadline := view.DealAt
				if err := tickHouseTables(deadline, id); err != nil {
					t.Fatal(err)
				}
				if !houseViewFor(clients[1].playerID).DealAt.After(deadline) {
					t.Fatal("idle betting clock stopped")
				}
			})
		}
	}
}

func TestHouseMongoPendingDebitReceiptSurvivesRestart(t *testing.T) {
	for _, currency := range []string{"gold", "ep"} {
		t.Run(currency, func(t *testing.T) {
			clients, tokens, id := setupHouseMongo(t, "roulette", currency)
			c := clients[0]
			unlock := lockCharacterWork(c.username)
			r, s, err := loadHouseLocked(id)
			if err != nil {
				unlock()
				t.Fatal(err)
			}
			s.Players = append(s.Players, houseParticipant{PlayerID: c.playerID, Name: c.username, Seat: 0, SessionID: tokens[0], Wagers: []game.CasinoWager{{Spot: "number:0", Amount: 20}}})
			encoded, _ := json.Marshal(s)
			op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:roulette:%s:%d:wager", s.RoundID, r.Version), PlayerID: c.playerID, Currency: currency, Amount: -20, NextState: encoded}
			_, err = db.BeginBlackjackTransfer(id, r.Version, op)
			if err != nil {
				unlock()
				t.Fatal(err)
			}
			if err := applyCasinoTransferLocked(id, op); err != nil {
				unlock()
				t.Fatal(err)
			}
			// Crash after the character receipt, before the table acknowledges it.
			unlock()
			world = nil
			houseCache = map[string]houseCacheEntry{}
			for retry := 0; retry < 2; retry++ {
				if err := tickHouseTables(time.Now(), id); err != nil {
					t.Fatal(err)
				}
			}
			saved, err := db.GetCharacter(c.username, c.username)
			if err != nil {
				t.Fatal(err)
			}
			if currency == "gold" && saved.Gold != 280 || currency == "ep" && saved.EP != 80 {
				t.Fatal("recovery duplicated debit", saved.Gold, saved.EP)
			}
			r, s, err = loadHouseLocked(id)
			if err != nil || r.Pending != nil || len(s.Players) != 1 {
				t.Fatal("pending intent not resolved", err)
			}
		})
	}
}

func TestHouseMongoPendingPayoutReceiptSurvivesRestart(t *testing.T) {
	for _, kind := range []string{"roulette", "baccarat"} {
		for _, currency := range []string{"gold", "ep"} {
			t.Run(kind+"-"+currency, func(t *testing.T) {
				clients, tokens, id := setupHouseMongo(t, kind, currency)
				c := clients[0]
				v := houseViewFor(c.playerID)
				spot := "number:0"
				if kind == "baccarat" {
					spot = "banker"
				}
				unlock := lockCharacterWork(c.username)
				if err := handleHouseBet(c, tokens[0], v.RoundID, []game.CasinoWager{{Spot: spot, Amount: 20}}, time.Now()); err != nil {
					unlock()
					t.Fatal(err)
				}
				r, s, err := loadHouseLocked(id)
				if err != nil {
					unlock()
					t.Fatal(err)
				}
				// Prepared winning outcome exercises recovery, not claimed random play.
				s.Phase, s.RevealAt = "settling", s.DealAt.Add(houseRevealTime)
				if kind == "roulette" {
					zero := 0
					s.Number = &zero
				} else {
					s.Baccarat = &game.BaccaratResult{Player: []int{2, 3}, Banker: []int{3, 3}, PlayerTotal: 7, BankerTotal: 8, Winner: "banker"}
				}
				if err := advanceHouseLocked(r, s); err != nil {
					unlock()
					t.Fatal(err)
				}
				r, s, err = loadHouseLocked(id)
				if err != nil {
					unlock()
					t.Fatal(err)
				}
				amount, err := housePayout(s, currency, s.Players[0])
				if err != nil {
					unlock()
					t.Fatal(err)
				}
				next := *s
				next.Players = append([]houseParticipant(nil), s.Players...)
				next.Players[0].Paid = true
				markHouseComplete(&next, s.RevealAt)
				encoded, _ := json.Marshal(next)
				op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:%s:%s:%d:payout", kind, s.RoundID, r.Version), PlayerID: c.playerID, Currency: currency, Amount: amount, NextState: encoded}
				candidate := *r
				candidate.Version++
				candidate.Pending = &op
				if err := validateHouseTransfer(&candidate, s); err != nil {
					unlock()
					t.Fatal(err)
				}
				if _, err := db.BeginBlackjackTransfer(id, r.Version, op); err != nil {
					unlock()
					t.Fatal(err)
				}
				if err := applyCasinoTransferLocked(id, op); err != nil {
					unlock()
					t.Fatal(err)
				}
				unlock()
				world = nil
				houseCache = map[string]houseCacheEntry{}
				for retry := 0; retry < 2; retry++ {
					if err := tickHouseTables(s.RevealAt, id); err != nil {
						t.Fatal(err)
					}
				}
				saved, err := db.GetCharacter(c.username, c.username)
				if err != nil {
					t.Fatal(err)
				}
				if currency == "gold" && (saved.Gold != 280+amount || saved.EP != 0) || currency == "ep" && (saved.EP != 80+amount || saved.Gold != 300) {
					t.Fatal("payout duplicated or crossed wallets", saved.Gold, saved.EP)
				}
				r, s, err = loadHouseLocked(id)
				if err != nil || r.Pending != nil || s.Phase != "complete" {
					t.Fatal("payout intent not completed", err)
				}
			})
		}
	}
}

func TestHouseAmbiguousIntentFencesOnlyItsOwner(t *testing.T) {
	oldDB, oldCache := db, houseCache
	defer func() { db, houseCache = oldDB, oldCache }()
	db = nil
	houseCache = map[string]houseCacheEntry{"public-roulette": {pendingOwner: "player-owner"}}
	if err := recoverAccountHouseLocked("another"); err != nil {
		t.Fatal("unrelated player blocked", err)
	}
	if err := recoverAccountHouseLocked("owner"); err == nil {
		t.Fatal("owner bypassed ambiguous intent")
	}
	if houseCache["public-roulette"].pendingOwner != "player-owner" {
		t.Fatal("failed read discarded owner fence")
	}
}
