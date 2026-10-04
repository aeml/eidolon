package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type slotStartupCheckingCommitter struct {
	repository           *database.DB
	maxPending, maxCache int
}

func (c *slotStartupCheckingCommitter) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	slotsMu.RLock()
	if n := len(slotsPending); n > c.maxPending {
		c.maxPending = n
	}
	if n := len(slotsCache); n > c.maxCache {
		c.maxCache = n
	}
	slotsMu.RUnlock()
	return c.repository.CommitCharacterSave(username, character, saveID)
}

// A small historical scan with actual late payouts, not capacity or slot odds.
func TestSlotMongoPagedStartupRecoversLatePayoutsWithoutHistoricalCache(t *testing.T) {
	uri, fixtureName, _ := setupSlotMongo(t)
	client, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	tables := client.Database("eidolon").Collection("casino_blackjack_tables")
	users := client.Database("eidolon").Collection("users")
	var keys, owners []string
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, key := range keys {
			if _, err := tables.DeleteOne(ctx, bson.M{"_id": key}); err != nil {
				t.Error(err)
			}
		}
		for _, owner := range owners {
			if _, err := users.DeleteOne(ctx, bson.M{"username": owner}); err != nil {
				t.Error(err)
			}
		}
	})
	rows := make([]interface{}, 0, 131)
	// Closed keys below 'e' sort before the deliberately late 'f' payout keys.
	for candidate := 0; len(rows) < 128 && candidate < 4096; candidate++ {
		owner := fmt.Sprintf("player-closed-%s-%d", fixtureName, candidate)
		key := slotRecordKey(owner, "earth")
		if strings.TrimPrefix(key, "slots:")[:1] >= "e" {
			continue
		}
		state := preparedWinningSlot(t, owner)
		state.Owed, state.Payment = 0, ""
		state.Session.FreeSpins = 5
		encoded, err := json.Marshal(state)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := decodeSlotState(key, encoded); err != nil {
			t.Fatal("invalid historical fixture", err)
		}
		rows = append(rows, database.BlackjackTableRecord{TableID: key, Version: 3, State: encoded})
		keys = append(keys, key)
	}
	if len(rows) != 128 {
		t.Fatal("could not build bounded historical keys")
	}
	for candidate := 0; len(owners) < 3 && candidate < 4096; candidate++ {
		name := fmt.Sprintf("late-%s-%d", fixtureName, candidate)
		key := slotRecordKey("player-"+name, "earth")
		if strings.TrimPrefix(key, "slots:")[:1] != "f" {
			continue
		}
		if err := db.CreateUser(name, name+"@example.invalid", name+"-fixture-only"); err != nil {
			t.Fatal(err)
		}
		owners = append(owners, name)
		if err := db.SetFirstCharacter(name, &database.Character{Name: name, Class: "Fighter", Level: 1, Gold: 300, EP: 43}); err != nil {
			t.Fatal(err)
		}
		state := preparedWinningSlot(t, "player-"+name)
		encoded, _ := json.Marshal(state)
		rows = append(rows, database.BlackjackTableRecord{TableID: key, Version: 1, State: encoded})
		keys = append(keys, key)
	}
	if len(owners) != 3 {
		t.Fatal("could not build late funded fixtures")
	}
	if _, err := tables.InsertMany(t.Context(), rows); err != nil {
		t.Fatal(err)
	}
	after, count, pages, maxPageBytes := "", 0, 0, 0
	for {
		page, err := db.CasinoSlotRecordsPage(after, 25)
		if err != nil || len(page) > 25 {
			t.Fatal("actual query lost its bound", err, len(page))
		}
		bytes := 0
		for _, record := range page {
			if record.TableID <= after {
				t.Fatal("page repeated or reordered a record")
			}
			for _, name := range owners {
				if record.TableID == slotRecordKey("player-"+name, "earth") && count < 128 {
					t.Fatal("payout fixture was not beyond the historical pages")
				}
			}
			after = record.TableID
			count++
			encoded, _ := bson.Marshal(record)
			bytes += len(encoded)
		}
		if bytes > maxPageBytes {
			maxPageBytes = bytes
		}
		pages++
		if len(page) < 25 {
			break
		}
	}
	if count != 131 || pages != 6 {
		t.Fatal("actual keyset scan lost history/payouts", count, pages)
	}
	checking := &slotStartupCheckingCommitter{repository: db}
	characterSaveCommitter = checking
	started := time.Now()
	if err := initializeSlots(); err != nil {
		t.Fatal(err)
	}
	elapsed := time.Since(started)
	if len(slotsCache) != 0 || len(slotsPending) != 0 || checking.maxCache != 0 || checking.maxPending != 1 {
		t.Fatal("startup accumulated history/settlement queue", len(slotsCache), len(slotsPending), checking.maxCache, checking.maxPending)
	}
	for _, name := range owners {
		saved, err := db.GetDirectTradeCharacter(name, name)
		payout := preparedWinningSlot(t, "player-"+name).Owed
		if err != nil || saved.Gold != 300+payout || saved.EP != 43 || len(saved.CasinoWalletCheckpoints) != 1 || len(saved.GoldCreditReceipts) != 0 {
			t.Fatal("late startup payout lost, repeated or mixed wallets", err)
		}
	}
	if err := initializeSlots(); err != nil {
		t.Fatal("second startup failed", err)
	}
	for _, name := range owners {
		saved, _ := db.GetDirectTradeCharacter(name, name)
		if saved.Gold != 300+preparedWinningSlot(t, "player-"+name).Owed {
			t.Fatal("second scan paid again")
		}
	}
	// Skipped closed records still retain their exact earned free-spin state.
	record, err := db.GetBlackjackTable(keys[0])
	if err != nil {
		t.Fatal(err)
	}
	state, err := decodeSlotState(record.TableID, record.State)
	if err != nil || state.Session.FreeSpins != 5 {
		t.Fatal("historical scan changed saved entitlements", err)
	}
	t.Logf("131 actual records/6 sorted25-capped pages, max page BSON%d bytes;3 funded payouts beyond128 closed records recovered once; peak pending1/cache0; startup%s", maxPageBytes, elapsed)
}
