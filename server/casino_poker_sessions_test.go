package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func setupPokerMongo(t *testing.T) ([]*Client, []string) {
	t.Helper()
	uri, a, _ := setupSlotMongo(t)
	_, b, _ := setupSlotMongo(t)
	oldCache, oldAvailable, oldOwner, oldGrace := pokerCached, pokerAvailable, pokerPendingOwner, pokerRecoveryUntil
	pokerCached, pokerAvailable, pokerPendingOwner, pokerRecoveryUntil = nil, false, "", time.Time{}
	t.Cleanup(func() {
		pokerCached, pokerAvailable, pokerPendingOwner, pokerRecoveryUntil = oldCache, oldAvailable, oldOwner, oldGrace
	})
	if _, err := db.GetBlackjackTable(publicPokerTable); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatal("disposable poker table already exists", err)
	}
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": publicPokerTable})
		cleanup.Disconnect(context.Background())
	})
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	clients, tokens := []*Client{}, []string{}
	for i, name := range []string{a, b} {
		point := game.CasinoTables()[1].Seats[i]
		p := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 300, X: point.ExitX, Z: point.ExitZ}
		world.AddEntity(p)
		seat, err := world.TakeCasinoSeat(p.ID, publicPokerTable, i, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		clients = append(clients, &Client{playerID: p.ID, username: name})
		tokens = append(tokens, seat.SessionID)
	}
	return clients, tokens
}

func TestPokerMongoFundedHandPrivacyAndCashOut(t *testing.T) {
	clients, tokens := setupPokerMongo(t)
	roundID := pokerViewFor(clients[0].playerID).RoundID
	now := time.Now()
	buy := func(i int, amount int) {
		t.Helper()
		unlock := lockCharacterWork(clients[i].username)
		defer unlock()
		if err := handlePokerBuyIn(clients[i], tokens[i], roundID, amount, now); err != nil {
			t.Fatal(err)
		}
	}
	buy(0, 100)
	buy(0, 100)
	if world.GetEntityCopy(clients[0].playerID).Gold != 200 {
		t.Fatal("duplicate buy-in charged twice")
	}
	if err := tickPoker(now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if pokerViewFor(clients[0].playerID).Phase != "betting" {
		t.Fatal("solo hand started")
	}
	buy(1, 200)
	if err := tickPoker(now.Add(16 * time.Second)); err != nil {
		t.Fatal(err)
	}
	view := pokerViewFor(clients[0].playerID)
	if view.Phase != "playing" || view.Round == nil {
		t.Fatal("two real funded seats failed to start")
	}
	encoded, _ := json.Marshal(view)
	if strings.Contains(string(encoded), "sessionId") || strings.Contains(string(encoded), "deck") || view.Round.Players[1].Cards[0] != -1 {
		t.Fatal("private poker state leaked")
	}
	if err := validatePokerSeatClaim("player-outsider", 0); err == nil {
		t.Fatal("funded seat not reserved")
	}
	// Simulate losing ephemeral seat tokens across restart, while preserving the
	// saved deck/hand and same authenticated account taking its reserved chair.
	entity := world.Entities[clients[0].playerID]
	entity.Mu.Lock()
	entity.CasinoSeat.SessionID = "reconnected-seat"
	entity.Mu.Unlock()
	tokens[0] = "reconnected-seat"
	pokerCached = nil
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	view = pokerViewFor(clients[0].playerID)
	if view.Round.Revision != 1 {
		t.Fatal("restart changed a live, unexpired hand")
	}
	turn := 0
	if view.Round.TurnPlayerID == clients[1].playerID {
		turn = 1
	}
	unlock := lockCharacterWork(clients[turn].username)
	err := handlePokerPlay(clients[turn], tokens[turn], roundID, "fold", 0, view.Round.Revision, now.Add(17*time.Second))
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	// Stop at a real completed-hand payout's saved receipt, before resolving
	// its table intent. Reopening must deliver the other payout, not this one twice.
	record, settling, err := loadPokerLocked()
	if err != nil {
		t.Fatal(err)
	}
	first := settling.Players[0]
	amount := pokerPayout(settling, first.PlayerID)
	settling.Players[0].Paid = true
	payload, _ := json.Marshal(settling)
	op := database.BlackjackTransfer{ID: "casino:poker:" + roundID + ":interrupted-cash-out", PlayerID: first.PlayerID, Currency: "gold", Amount: amount, NextState: payload}
	if _, err := db.BeginBlackjackTransfer(publicPokerTable, record.Version, op); err != nil {
		t.Fatal(err)
	}
	unlock = lockCharacterWork(strings.TrimPrefix(first.PlayerID, "player-"))
	err = applyCasinoGoldTransferLocked(op)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	pokerCached, pokerPendingOwner = nil, ""
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		if err := tickPoker(now.Add(18 * time.Second)); err != nil {
			t.Fatal(err)
		}
	}
	view = pokerViewFor(clients[0].playerID)
	if view.Phase != "complete" {
		t.Fatal("hand cash-out incomplete")
	}
	gold := 0
	for _, c := range clients {
		saved, err := db.GetCharacter(c.username, c.username)
		if err != nil {
			t.Fatal(err)
		}
		gold += saved.Gold
		if saved.Gold != world.GetEntityCopy(c.playerID).Gold {
			t.Fatal("live/save balance mismatch")
		}
	}
	if gold != 600 {
		t.Fatal("poker created or destroyed Gold", gold)
	}
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	for _, c := range clients {
		saved, _ := db.GetCharacter(c.username, c.username)
		if len(saved.GoldCreditReceipts) != 2 {
			t.Fatal("cash-out replay changed receipts")
		}
	}
}

func TestPokerMongoCancelledBuyInAndInterruptedDebit(t *testing.T) {
	clients, tokens := setupPokerMongo(t)
	c := clients[0]
	now := time.Now()
	r, s, err := loadPokerLocked()
	if err != nil {
		t.Fatal(err)
	}
	s.Players = append(s.Players, pokerParticipant{PlayerID: c.playerID, Name: c.username, Seat: 0, SessionID: tokens[0], BuyIn: 100})
	encoded, _ := json.Marshal(s)
	op := database.BlackjackTransfer{ID: "casino:poker:" + s.RoundID + ":interrupted", PlayerID: c.playerID, Currency: "gold", Amount: -100, NextState: encoded}
	if _, err := db.BeginBlackjackTransfer(publicPokerTable, r.Version, op); err != nil {
		t.Fatal(err)
	}
	unlock := lockCharacterWork(c.username)
	err = applyCasinoGoldTransferLocked(op)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	// Receipt durably saved, table intent not resolved. Startup must not charge twice.
	pokerCached = nil
	pokerPendingOwner = ""
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	if world.GetEntityCopy(c.playerID).Gold != 200 {
		t.Fatal("recovery charged twice")
	}
	unlock = lockCharacterWork(c.username)
	err = handlePokerLeave(c, tokens[0], now)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	if world.GetEntityCopy(c.playerID).Gold != 300 || len(pokerViewFor(c.playerID).Players) != 0 {
		t.Fatal("cancelled lobby buy-in not refunded")
	}
	if err := initializePoker(); err != nil {
		t.Fatal(err)
	}
	saved, _ := db.GetCharacter(c.username, c.username)
	if saved.Gold != 300 || len(saved.GoldCreditReceipts) != 2 {
		t.Fatal("cancel replay altered funds")
	}
}

func TestPokerPendingAccountFence(t *testing.T) {
	oldDB, oldOwner, oldAvailable := db, pokerPendingOwner, pokerAvailable
	t.Cleanup(func() { db, pokerPendingOwner, pokerAvailable = oldDB, oldOwner, oldAvailable })
	db = nil
	pokerPendingOwner = "player-owner"
	if err := recoverAccountPokerLocked("unrelated"); err != nil {
		t.Fatal("unrelated movement touched storage")
	}
	if err := recoverAccountPokerLocked("owner"); err == nil {
		t.Fatal("ambiguous own intent did not fail closed")
	}
}
