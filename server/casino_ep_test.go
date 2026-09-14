package main

import (
	"context"
	"eidolon-server/internal/database"
	"errors"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func epCasinoOperation(id string, amount int) database.BlackjackTransfer {
	return database.BlackjackTransfer{ID: "casino:round:" + id, PlayerID: "player-hero", Currency: "ep", Amount: amount, NextState: []byte(`{"phase":"playing"}`)}
}

func TestCasinoEPMongoOfflineIntentRecovery(t *testing.T) {
	uri, name, dir := setupSlotMongo(t)
	owner := "player-" + name
	key := strings.Replace(slotRecordKey(owner, "earth"), "slots:", "slots:ep:", 1)
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": key})
	character, err := db.GetCharacter(name, name)
	if err != nil {
		t.Fatal(err)
	}
	character.EP = 100
	if err := db.SaveCharacter(name, character); err != nil {
		t.Fatal(err)
	}
	r, err := db.CreateBlackjackTable(key, []byte(`{"phase":"betting"}`))
	if err != nil {
		t.Fatal(err)
	}
	op := database.BlackjackTransfer{ID: "casino:slots:" + name + ":stake", PlayerID: owner, Currency: "ep", Amount: -100, NextState: []byte(`{"phase":"playing"}`)}
	bad := op
	bad.Currency = "gold"
	if _, err := db.BeginBlackjackTransfer(key, r.Version, bad); err == nil {
		t.Fatal("Gold intent accepted at EP record")
	}
	pending, err := db.BeginBlackjackTransfer(key, r.Version, op)
	if err != nil {
		t.Fatal(err)
	}
	unlock := lockCharacterWork(name)
	defer unlock()
	if err := applyCasinoTransferLocked(key, op); err != nil {
		t.Fatal(err)
	}
	// No live entity or membership. Reopen the real repository and character
	// journal after commit but before the table receives its acknowledgement.
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
	if err != nil || accepted.Pending != nil {
		t.Fatal("EP intent not resolved", err)
	}
	character, err = db.GetCharacter(name, name)
	if err != nil || character.EP != 0 || character.Gold != 300 || character.EPCasinoReceipts[op.ID] != -100 {
		t.Fatal("offline debit replay changed money", err)
	}
	unfunded := op
	unfunded.ID += ":unfunded"
	unfunded.Amount = -1
	pending, err = db.BeginBlackjackTransfer(key, accepted.Version, unfunded)
	if err != nil {
		t.Fatal(err)
	}
	aborted, err := recoverBlackjackTransferLocked(*pending)
	if !errors.Is(err, database.ErrInsufficientEP) || aborted == nil || aborted.Pending != nil || aborted.LastAccepted || string(aborted.State) != string(accepted.State) {
		t.Fatal("EP shortfall not resolved safely", err)
	}
	win := op
	win.ID, win.Amount, win.NextState = "casino:slots:"+name+":return", 20000, []byte(`{"phase":"paid"}`)
	pending, err = db.BeginBlackjackTransfer(key, aborted.Version, win)
	if err != nil {
		t.Fatal(err)
	}
	if err := applyCasinoTransferLocked(key, win); err != nil {
		t.Fatal(err)
	}
	if _, err := recoverBlackjackTransferLocked(*pending); err != nil {
		t.Fatal(err)
	}
	if _, err := recoverBlackjackTransferLocked(*pending); err != nil {
		t.Fatal("stale recovery", err)
	}
	character, err = db.GetCharacter(name, name)
	if err != nil || character.EP != 20000 || character.Gold != 300 || character.EPCasinoReceipts[win.ID] != 20000 || len(character.GoldCreditReceipts) != 0 {
		t.Fatal("offline jackpot paid twice or entered Gold wallet", err)
	}
}

func TestCasinoEPTransferDurableAndCurrencyFenced(t *testing.T) {
	c, committer, _ := epWalletFixture(t)
	p := world.Entities[c.playerID]
	p.EP = 100
	stake := epCasinoOperation("stake", -100)
	if err := applyCasinoTransferLocked("vip-blackjack", stake); err != nil {
		t.Fatal(err)
	}
	if err := applyCasinoTransferLocked("vip-blackjack", stake); err != nil {
		t.Fatal("retry", err)
	}
	if p.EP != 0 || p.Gold != 3_000_000 || committer.saved.EP != 0 || committer.saved.EPCasinoReceipts[stake.ID] != -100 {
		t.Fatal("EP balance/receipt not saved together or Gold changed")
	}
	if err := applyCasinoTransferLocked("vip-blackjack", epCasinoOperation("shortfall", -1)); !errors.Is(err, database.ErrInsufficientEP) {
		t.Fatal("EP shortfall fell back to Gold", err)
	}
	win := epCasinoOperation("payout", 250)
	if err := applyCasinoGoldTransferLocked(win); err == nil {
		t.Fatal("EP entered Gold path")
	}
	if err := applyCasinoTransferLocked("public-blackjack", win); err == nil {
		t.Fatal("public table paid EP")
	}
	if err := applyCasinoTransferLocked("vip-blackjack", win); err != nil {
		t.Fatal(err)
	}
	if err := applyCasinoTransferLocked("vip-blackjack", win); err != nil {
		t.Fatal(err)
	}
	if p.EP != 250 || p.Gold != 3_000_000 || len(p.GoldCreditReceipts) != 0 {
		t.Fatal("incorrect EP-only return")
	}
	encoded, err := bson.Marshal(committer.saved)
	if err != nil {
		t.Fatal(err)
	}
	var restored database.Character
	if err := bson.Unmarshal(encoded, &restored); err != nil || restored.EP != 250 || restored.EPCasinoReceipts[win.ID] != 250 {
		t.Fatal("EP casino ledger lost in BSON", err)
	}
	gold := win
	gold.Currency = "gold"
	if applyCasinoTransferLocked("vip-blackjack", gold) == nil || applyCasinoEPTransferLocked(gold) == nil {
		t.Fatal("VIP transferred Gold")
	}
}

func TestCasinoEPPendingSaveRecoveryRetainsReceipt(t *testing.T) {
	for _, amount := range []int{-100, 250} {
		t.Run(map[bool]string{true: "debit", false: "payout"}[amount < 0], func(t *testing.T) {
			c, committer, dir := epWalletFixture(t)
			p := world.Entities[c.playerID]
			p.EP = 100
			characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
			op := epCasinoOperation("interrupted", amount)
			if err := applyCasinoTransferLocked("vip-blackjack", op); err == nil {
				t.Fatal("failed save acknowledged")
			}
			pending, err := characterSaveJournal.Read("hero")
			if err != nil || pending == nil {
				t.Fatal("missing durable EP snapshot", err)
			}
			world = nil
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			failedCharacterSaves.users = map[string]bool{}
			characterSaveCommitter = committer
			if err := retryPendingCharacterSaves(); err != nil {
				t.Fatal(err)
			}
			if committer.saved.EP != 100+amount || committer.saved.Gold != 3_000_000 || committer.saved.EPCasinoReceipts[op.ID] != amount {
				t.Fatal("restart split EP receipt and balance")
			}
			if err := database.ApplyEPTransfer(&committer.saved.EP, &committer.saved.EPCasinoReceipts, op.ID, amount); err != nil || committer.saved.EP != 100+amount {
				t.Fatal("restart replay paid/charged twice", err)
			}
		})
	}
}
