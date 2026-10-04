package main

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Actual table CAS, journals and wallets, not generated casino odds/outcomes.
func TestCasinoCheckpointActualMongoTableRaceSaveAndReopen(t *testing.T) {
	uri, owner, _ := setupSlotMongo(t)
	fixtureClient, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = fixtureClient.Disconnect(context.Background()) })
	tables := fixtureClient.Database("eidolon").Collection("casino_blackjack_tables")
	character, err := db.GetCharacter(owner, owner)
	if err != nil {
		t.Fatal(err)
	}
	character.EP = 100
	character.GoldCreditReceipts = map[string]int{"old-credit": 7}
	character.EPCasinoReceipts = map[string]int{"casino:old:credit": 3}
	if err := db.SaveCharacter(owner, character); err != nil {
		t.Fatal(err)
	}
	keys := []string{slotRecordKey("player-"+owner, "earth", "gold"), slotRecordKey("player-"+owner, "earth", "ep")}
	state := []byte(`{"phase":"checkpoint-only-fixture"}`)
	records := make([]*database.BlackjackTableRecord, 2)
	cleanupKeys := append(append([]string(nil), keys...), "legacy-"+owner)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, key := range cleanupKeys {
			if _, err := tables.DeleteOne(ctx, bson.M{"_id": key}); err != nil {
				t.Error(err)
			}
		}
	})
	for index, key := range keys {
		records[index], err = db.CreateBlackjackTable(key, state)
		if err != nil {
			t.Fatal(err)
		}
	}
	plan := func(currency string, number int, amount int) database.BlackjackTransfer {
		return database.BlackjackTransfer{ID: fmt.Sprintf("casino:checkpoint:%s:%08d", currency, number), PlayerID: "player-" + owner, Currency: currency, Amount: amount, NextState: state}
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	var first *database.BlackjackTableRecord
	losers := 0
	for index := 0; index < 8; index++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			got, err := db.BeginBlackjackTransfer(keys[0], records[0].Version, plan("gold", index, -1))
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				if first != nil {
					t.Error("two funding intents admitted")
				}
				first = got
			} else {
				if !errors.Is(err, database.ErrBlackjackTableConflict) {
					t.Error("unexpected race denial", err)
				}
				losers++
			}
		}(index)
	}
	wg.Wait()
	if first == nil || losers != 7 || first.Pending.TableVersion != first.Version {
		t.Fatal("durable table did not freeze exactly one versioned intent")
	}
	if err := applyCasinoTransferLocked(keys[0], *first.Pending); err != nil {
		t.Fatal(err)
	}
	// The table is deliberately left pending after an ACTUAL successful full
	// character commit. A fresh repository must resolve without a second debit.
	if err := db.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	db, err = database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	reopened := db
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	characterSaveCommitter = db
	records[0], err = recoverBlackjackTransferLocked(*first)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := db.GetDirectTradeCharacter(owner, owner)
	if err != nil || saved.Gold != 299 || saved.EP != 100 || saved.CasinoWalletCheckpoints[keys[0]].Fingerprint != first.Pending.Fingerprint {
		t.Fatal("reopen repeated wallet debit or lost head", err)
	}
	if _, err := recoverBlackjackTransferLocked(*first); err != nil {
		t.Fatal("stale resolution replay failed", err)
	}
	started := time.Now()
	initialSize := 0
	for number := 1; number <= 100; number++ {
		for index, currency := range []string{"gold", "ep"} {
			if index == 0 && number == 1 {
				continue
			} // Already committed above.
			amount := 1
			if number%2 == 1 {
				amount = -1
			}
			pending, err := db.BeginBlackjackTransfer(keys[index], records[index].Version, plan(currency, number+100, amount))
			if err != nil {
				t.Fatal(number, currency, err)
			}
			records[index], err = recoverBlackjackTransferLocked(*pending)
			if err != nil {
				t.Fatal(number, currency, err)
			}
		}
		if number == 10 || number == 100 {
			saved, err = db.GetDirectTradeCharacter(owner, owner)
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := bson.Marshal(saved)
			if err != nil {
				t.Fatal(err)
			}
			if number == 10 {
				initialSize = len(encoded)
			} else if len(encoded) != initialSize {
				t.Fatal("actual complete saved character grew per round", initialSize, len(encoded))
			}
		}
	}
	elapsed := time.Since(started)
	if saved.Gold != 300 || saved.EP != 100 || len(saved.CasinoWalletCheckpoints) != 2 || !maps.Equal(saved.GoldCreditReceipts, character.GoldCreditReceipts) || !maps.Equal(saved.EPCasinoReceipts, character.EPCasinoReceipts) {
		t.Fatal("ordered signed effects lost money or changed old receipt maps")
	}
	if err := applyCasinoTransferLocked(keys[0], *first.Pending); err != nil {
		t.Fatal("canonical old transfer replay failed", err)
	}
	saved, _ = db.GetDirectTradeCharacter(owner, owner)
	if saved.Gold != 300 || saved.EP != 100 {
		t.Fatal("old canonical intent replay paid/charged again")
	}
	// Simulate only an original pre-upgrade persisted table intent. No conversion
	// or invented backfill: recovery must follow its original signed receipt path.
	legacy := plan("gold", 9999, 7)
	legacyRecord := database.BlackjackTableRecord{TableID: "legacy-" + owner, Version: 2, State: state, Pending: &legacy}
	if _, err := tables.InsertOne(t.Context(), legacyRecord); err != nil {
		t.Fatal(err)
	}
	if _, err := recoverBlackjackTransferLocked(legacyRecord); err != nil {
		t.Fatal("original legacy pending intent failed", err)
	}
	saved, err = db.GetDirectTradeCharacter(owner, owner)
	if err != nil || saved.Gold != 307 || saved.EP != 100 || saved.GoldCreditReceipts[legacy.ID] != 7 || len(saved.CasinoWalletCheckpoints) != 2 {
		t.Fatal("legacy funded outcome lost or silently converted", err)
	}
	t.Logf("8 actual contenders/1 frozen winner;200 signed wallet effects across2 records; repository reopen and old pending replay; saved BSON constant %d bytes;199 serial settlements %s", initialSize, elapsed)
}
