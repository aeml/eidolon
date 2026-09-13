package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestCasinoMongoTransferRecovery(t *testing.T) {
	uri := os.Getenv("EIDOLON_CASINO_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable casino Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires disposable loopback Mongo")
	}
	dir, _ := setupCharacterJournalTest(t)
	oldDB := db
	defer func() { db = oldDB }()
	var err error
	db, err = database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(context.Background())
	characterSaveCommitter = db
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	name := fmt.Sprintf("casino-funds-%d", time.Now().UnixNano())
	tableID := name + "-table"
	defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": tableID})
	if err := db.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
		t.Fatal(err)
	}
	if err := db.SetFirstCharacter(name, &database.Character{Name: name, Class: "Fighter", Level: 1, Gold: 300}); err != nil {
		t.Fatal(err)
	}
	round, err := game.NewBlackjackRound(name, []game.BlackjackEntry{{PlayerID: "player-" + name, Seat: 0, Bet: 100}}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	state, _ := json.Marshal(round)
	initial, err := db.CreateBlackjackTable(tableID, []byte(`{"phase":"betting"}`))
	if err != nil {
		t.Fatal(err)
	}
	debit := database.BlackjackTransfer{ID: "casino:" + name + ":bet", PlayerID: "player-" + name, Currency: "gold", Amount: -100, NextState: state}
	pending, err := db.BeginBlackjackTransfer(tableID, initial.Version, debit)
	if err != nil {
		t.Fatal(err)
	}
	unlock := lockCharacterWork(name)
	defer unlock()
	if err := applyCasinoGoldTransferLocked(debit); err != nil {
		t.Fatal(err)
	}
	// Simulate interruption between character commit and table acknowledgement.
	// Reopen the real journal and repository; no live entity or mocked wallet.
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	db, characterSaveCommitter = reopened, reopened
	accepted, err := recoverBlackjackTransferLocked(*pending)
	if err != nil {
		t.Fatal(err)
	}
	if accepted.Pending != nil || string(accepted.State) != string(state) {
		t.Fatal("round not durably accepted")
	}
	character, err := db.GetCharacter(name, name)
	if err != nil || character.Gold != 200 {
		t.Fatal("recovery charged twice", err)
	}
	if _, err := recoverBlackjackTransferLocked(*pending); err != nil {
		t.Fatal("old recovery handle changed accepted round", err)
	}
	character, err = db.GetCharacter(name, name)
	if err != nil || character.Gold != 200 {
		t.Fatal("stale recovery charged again", err)
	}

	payout := database.BlackjackTransfer{ID: "casino:" + name + ":payout", PlayerID: debit.PlayerID, Currency: "gold", Amount: 250, NextState: []byte(`{"phase":"paid"}`)}
	pending, err = db.BeginBlackjackTransfer(tableID, accepted.Version, payout)
	if err != nil {
		t.Fatal(err)
	}
	if err := applyCasinoGoldTransferLocked(payout); err != nil {
		t.Fatal(err)
	}
	paid, err := recoverBlackjackTransferLocked(*pending)
	if err != nil {
		t.Fatal(err)
	}
	character, err = db.GetCharacter(name, name)
	if err != nil || character.Gold != 450 || character.GoldCreditReceipts[payout.ID] != 250 {
		t.Fatal("ambiguous payout duplicated or lost", err)
	}
	unfunded := debit
	unfunded.ID += ":insufficient"
	unfunded.Amount = -500
	pending, err = db.BeginBlackjackTransfer(tableID, paid.Version, unfunded)
	if err != nil {
		t.Fatal(err)
	}
	aborted, err := recoverBlackjackTransferLocked(*pending)
	if !errors.Is(err, database.ErrInsufficientGold) || aborted.Pending != nil || string(aborted.State) != string(paid.State) {
		t.Fatal("unfunded proposal advanced round", err)
	}
	character, err = db.GetCharacter(name, name)
	if err != nil || character.Gold != 450 {
		t.Fatal("unfunded bet changed balance", err)
	}
}
