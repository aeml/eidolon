package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// Actual isolated storage/index/repository reopening, not gameplay-handler,
// journal, network-disconnect or replica-set failover acceptance.
func TestGroundItemStoreActualMongoCustodyAndRepositoryReopen(t *testing.T) {
	uri := os.Getenv("EIDOLON_GROUND_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	// Each test owns these exact fixture collections, never live character data.
	suffix := fmt.Sprintf("ground_fixture_%d", time.Now().UnixNano())
	open := func() *DB {
		db, err := New(uri)
		if err != nil {
			t.Fatal(err)
		}
		db.groundItemOperations = db.client.Database("eidolon").Collection(suffix + "_operations")
		db.users = db.client.Database("eidolon").Collection(suffix + "_users")
		db.characters = newMongoCharacterRepository(db.users)
		t.Cleanup(func() { _ = db.Close(context.Background()) })
		return db
	}
	db := open()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// Registration order keeps this first client open for fixture cleanup.
		if err := db.groundItemOperations.Drop(ctx); err != nil {
			t.Error(err)
		}
		if err := db.users.Drop(ctx); err != nil {
			t.Error(err)
		}
	})
	if err := applyGroundItemOperationIndexes(t.Context(), db); err != nil {
		t.Fatal(err)
	}
	assertRecord := func(got *GroundItemRecord, err error, want GroundItemRecord) {
		t.Helper()
		if err != nil || got == nil || *got != want {
			t.Fatal("frozen custody or availability changed", got, err, want)
		}
	}
	assertBlocked := func(err error) {
		t.Helper()
		if !errors.Is(err, ErrGroundItemBusy) && !errors.Is(err, ErrGroundItemConflict) {
			t.Fatal("contending operation was not fenced", err)
		}
	}
	saveReceipt := func(store *DB, op GroundItemOperation) {
		t.Helper()
		character, err := store.GetDirectTradeCharacter(op.Username, op.Username)
		if err != nil {
			t.Fatal(err)
		}
		if character == nil {
			character = &Character{Name: op.Username, Gold: 12345}
			if _, err := store.users.InsertOne(t.Context(), User{Username: op.Username, Characters: []*Character{character}}); err != nil {
				t.Fatal(err)
			}
		}
		if character.ItemDeliveryReceipts == nil {
			character.ItemDeliveryReceipts = map[string]string{}
		}
		character.ItemDeliveryReceipts[op.ID] = op.Fingerprint
		if err := store.SaveCharacter(op.Username, character); err != nil {
			t.Fatal(err)
		}
	}

	pending := groundStoreDrop()
	stored, err := db.PrepareGroundItemOperation(pending.GroundItemOperation)
	assertRecord(stored, err, pending)
	if _, err := db.CompleteGroundItemOperation(pending.ID, pending.Fingerprint); !errors.Is(err, ErrGroundItemConflict) {
		t.Fatal("completion accepted missing saved receipt", err)
	}
	other := pending.GroundItemOperation
	other.ID, other.LootID = GroundItemOperationID("contending-drop"), "contending-ground"
	other.Fingerprint, _ = GroundItemFingerprint(other)
	_, err = db.PrepareGroundItemOperation(other)
	assertBlocked(err)

	saveReceipt(db, pending.GroundItemOperation)
	completed, err := db.CompleteGroundItemOperation(pending.ID, pending.Fingerprint)
	if err != nil || completed == nil || completed.State != GroundItemComplete || completed.GroundPayload() != pending.MovedPayload {
		t.Fatal("saved drop was not completed", completed, err)
	}
	firstCompletion := *completed
	partial := groundStorePickup(firstCompletion)
	partial.CreatedAt = time.Now().UTC().Truncate(time.Millisecond)
	partial.Fingerprint, _ = GroundItemFingerprint(partial)
	pickup, err := db.PrepareGroundItemOperation(partial)
	if err != nil || pickup == nil || !pickup.AvailableAt.Equal(firstCompletion.AvailableAt) || !pickup.ExpiresAt.Equal(firstCompletion.ExpiresAt) {
		t.Fatal("pickup renewed original lifetime", pickup, err)
	}
	projections, err := db.GroundItemProjectionPage("", time.Now(), 10)
	if err != nil || len(projections) != 1 || projections[0].ID != partial.ID || projections[0].GroundPayload() != "" {
		t.Fatal("pending latest generation exposed the original free drop", projections, err)
	}

	// A new repository/client must find the exact pending plan, not recreate it.
	reopened := open()
	retained, err := reopened.GetGroundItemOperation(partial.ID)
	assertRecord(retained, err, *pickup)
	pendingPage, err := reopened.PendingGroundItemOperations(partial.Username, "", 1)
	if err != nil || len(pendingPage) != 1 || pendingPage[0] != *pickup {
		t.Fatal("reopen lost the reserved generation", pendingPage, err)
	}
	saveReceipt(reopened, partial)
	completedPickup, err := reopened.CompleteGroundItemOperation(partial.ID, partial.Fingerprint)
	if err != nil || completedPickup == nil || completedPickup.State != GroundItemComplete || completedPickup.GroundPayload() != partial.RemainingPayload {
		t.Fatal("partial pickup did not retain the exact remainder", completedPickup, err)
	}
	projections, err = db.GroundItemProjectionPage("", time.Now(), 10)
	if err != nil || len(projections) != 1 || projections[0] != *completedPickup {
		t.Fatal("projection refilled the older quantity", projections, err)
	}
	stored, err = db.PrepareGroundItemOperation(pending.GroundItemOperation)
	assertRecord(stored, err, firstCompletion)
	stored, err = db.CompleteGroundItemOperation(pending.ID, pending.Fingerprint)
	assertRecord(stored, err, firstCompletion)
	stale := partial
	stale.ID = GroundItemOperationID("stale-generation")
	stale.Fingerprint, _ = GroundItemFingerprint(stale)
	_, err = db.PrepareGroundItemOperation(stale)
	assertBlocked(err)

	full := partial
	full.ID, full.Generation = GroundItemOperationID("final-pickup"), 2
	full.BeforePayload, full.MovedPayload, full.RemainingPayload = partial.RemainingPayload, partial.RemainingPayload, ""
	full.CreatedAt = time.Now().UTC().Truncate(time.Millisecond)
	full.Fingerprint, _ = GroundItemFingerprint(full)
	if _, err := db.PrepareGroundItemOperation(full); err != nil {
		t.Fatal(err)
	}
	saveReceipt(db, full)
	consumed, err := db.CompleteGroundItemOperation(full.ID, full.Fingerprint)
	if err != nil || consumed == nil || consumed.GroundPayload() != "" || !consumed.ExpiresAt.Equal(firstCompletion.ExpiresAt) {
		t.Fatal("full pickup resurrected quantity or renewed expiry", consumed, err)
	}
	projections, err = reopened.GroundItemProjectionPage("", firstCompletion.ExpiresAt, 10)
	if err != nil || len(projections) != 0 {
		t.Fatal("expired projection was restored", projections, err)
	}
	stored, err = reopened.PrepareGroundItemOperation(partial)
	assertRecord(stored, err, *completedPickup)
	character, err := reopened.GetDirectTradeCharacter(full.Username, full.Username)
	if err != nil || character == nil || character.Gold != 12345 || len(character.ItemDeliveryReceipts) != 3 {
		t.Fatal("unrelated character state or retained replay receipts changed", character, err)
	}

	// Real Mongo partial and generation indexes, not driver mock responses.
	for _, fence := range []string{"account", "loot"} {
		t.Run(fence, func(t *testing.T) {
			var wg sync.WaitGroup
			errorsFound := make(chan error, 12)
			for index := range 12 {
				wg.Add(1)
				go func() {
					defer wg.Done()
					op := groundStoreDrop().GroundItemOperation
					op.ID = GroundItemOperationID(fmt.Sprintf("%s-%d", fence, index))
					op.Username, op.LootID = fmt.Sprintf("%s-owner-%d", fence, index), fmt.Sprintf("%s-loot-%d", fence, index)
					if fence == "account" {
						op.Username = "one-racing-account"
					} else {
						op.LootID = "one-racing-loot"
					}
					op.PlayerID = "player-" + op.Username
					op.Fingerprint, _ = GroundItemFingerprint(op)
					_, err := db.PrepareGroundItemOperation(op)
					errorsFound <- err
				}()
			}
			wg.Wait()
			close(errorsFound)
			accepted := 0
			for err := range errorsFound {
				if err == nil {
					accepted++
				} else {
					assertBlocked(err)
				}
			}
			if accepted != 1 {
				t.Fatal("concurrent custody forked", accepted)
			}
		})
	}
	indexes, err := db.groundItemOperations.Indexes().List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer indexes.Close(t.Context())
	var definitions []bson.M
	if err := indexes.All(t.Context(), &definitions); err != nil {
		t.Fatal("missing custody/recovery indexes", definitions, err)
	}
	requiredIndexes := map[string]bool{
		"unique_ground_account_ordinal":       true,
		"one_pending_ground_item_per_account": true,
		"one_pending_ground_item_per_loot":    true,
		"ground_item_generations":             true,
		"ground_item_recovery":                false,
		"ground_item_active_projection":       false,
	}
	for _, definition := range definitions {
		if _, expires := definition["expireAfterSeconds"]; expires {
			t.Fatal("TTL would erase retained completed identities", definition)
		}
		name, _ := definition["name"].(string)
		if unique, required := requiredIndexes[name]; required {
			if unique && definition["unique"] != true {
				t.Fatal("custody index lost uniqueness", definition)
			}
			delete(requiredIndexes, name)
		}
	}
	if len(requiredIndexes) != 0 {
		t.Fatal("missing custody/recovery indexes", requiredIndexes)
	}
}
