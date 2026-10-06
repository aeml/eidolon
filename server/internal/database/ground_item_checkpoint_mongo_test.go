package database

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"os"
	"regexp"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func TestGroundItemCheckpointActualMongoContiguousSaveRaceAndReopen(t *testing.T) {
	uri := os.Getenv("EIDOLON_PERSISTENCE_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" || !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	repo, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	if err := repo.RunMigrations(t.Context()); err != nil {
		t.Fatal("current schema repeat migration", err)
	}
	if version, err := repo.SchemaVersion(t.Context()); err != nil || version != CurrentSchemaVersion {
		t.Fatal("writer fence not installed", version, err)
	}
	owner := fmt.Sprintf("checkpoint-fixture-%d", time.Now().UnixNano())
	legacy := groundOperationFixture(GroundItemDrop)
	legacy.Username, legacy.PlayerID, legacy.LootID = owner, "player-"+owner, owner+"-legacy-loot"
	legacy.ID = GroundItemOperationID(owner + "-legacy-op")
	legacy.CreatedAt = time.Now().UTC().Add(-time.Second).Truncate(time.Millisecond)
	legacy.Fingerprint, _ = GroundItemFingerprint(legacy)
	character := &Character{Name: owner, Class: "Fighter", Gold: 777, EP: 43, ItemDeliveryReceipts: map[string]string{legacy.ID: legacy.Fingerprint}}
	if _, err := repo.users.InsertOne(t.Context(), User{Username: owner, PasswordHash: "synthetic-only", Characters: []*Character{character}}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = repo.users.DeleteOne(ctx, bson.M{"username": owner})
		_, _ = repo.groundItemOperations.DeleteMany(ctx, bson.M{"username": owner})
	})
	plan := func(ordinal int64, suffix string) GroundItemOperation {
		op := legacy
		op.Version = 2
		op.AccountOrdinal = ordinal
		op.ID = GroundItemOperationID(owner + suffix)
		op.LootID = owner + suffix
		op.Fingerprint, _ = GroundItemFingerprint(op)
		return op
	}
	if _, err := repo.PrepareGroundItemOperation(plan(2, "-gap")); !errors.Is(err, ErrGroundItemConflict) {
		t.Fatal("skipped saved ordinal admitted", err)
	}
	var mu sync.Mutex
	var winner *GroundItemRecord
	var losers []GroundItemOperation
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			op := plan(1, fmt.Sprintf("-contender-%d", i))
			got, err := repo.PrepareGroundItemOperation(op)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				if winner != nil {
					t.Error("two immutable first decisions admitted")
				}
				winner = got
			} else {
				if !errors.Is(err, ErrGroundItemBusy) {
					t.Error("unexpected contention outcome", err)
				}
				losers = append(losers, op)
			}
		}(i)
	}
	wg.Wait()
	if winner == nil || len(losers) != 7 {
		t.Fatal("first-decision race did not select exactly one winner")
	}
	if _, err := repo.CompleteGroundItemOperation(winner.ID, winner.Fingerprint); !errors.Is(err, ErrGroundItemConflict) {
		t.Fatal("unsaved checkpoint published custody", err)
	}
	saveComplete := func(record *GroundItemRecord) {
		t.Helper()
		character.GroundAccountOrdinal, character.GroundAccountOperationID, character.GroundAccountFingerprint = record.AccountOrdinal, record.ID, record.Fingerprint
		if err := repo.SaveCharacter(owner, character); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.CompleteGroundItemOperation(record.ID, record.Fingerprint); err != nil {
			t.Fatal(err)
		}
	}
	saveComplete(winner)
	if _, err := repo.PrepareGroundItemOperation(losers[0]); !errors.Is(err, ErrGroundItemConflict) {
		t.Fatal("completed ordinal reused through repository", err)
	}
	// Bypass the admission helper solely to prove that the actual unique index
	// protects completed history as well as the one-pending-operation boundary.
	completedLoser := GroundItemRecord{GroundItemOperation: losers[0], State: GroundItemComplete, AvailableAt: time.Now().UTC().Truncate(time.Millisecond)}
	completedLoser.ExpiresAt = completedLoser.AvailableAt.Add(time.Minute)
	if _, err := repo.groundItemOperations.InsertOne(t.Context(), completedLoser); !mongo.IsDuplicateKeyError(err) {
		t.Fatal("completed ordinal uniqueness missing", err)
	}
	initial, _ := bson.Marshal(character)
	started := time.Now()
	for ordinal := int64(2); ordinal <= 100; ordinal++ {
		record, err := repo.PrepareGroundItemOperation(plan(ordinal, fmt.Sprintf("-history-%03d", ordinal)))
		if err != nil {
			t.Fatal(ordinal, err)
		}
		saveComplete(record)
	}
	elapsed := time.Since(started)
	final, _ := bson.Marshal(character)
	if len(initial) != len(final) {
		t.Fatal("new ground history grew saved character", len(initial), len(final))
	}
	// Older persisted V1 plans still have their original map proof and never
	// acquire an account ordinal or need a backfill.
	if _, err := repo.PrepareGroundItemOperation(legacy); err != nil {
		t.Fatal("legacy intent rejected", err)
	}
	if _, err := repo.CompleteGroundItemOperation(legacy.ID, legacy.Fingerprint); err != nil {
		t.Fatal("legacy saved receipt rejected", err)
	}
	if err := repo.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	repo, err = New(uri)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := repo.GetDirectTradeCharacter(owner, owner)
	if err != nil || saved == nil || saved.GroundAccountOrdinal != 100 || saved.Gold != 777 || saved.EP != 43 || !maps.Equal(saved.ItemDeliveryReceipts, character.ItemDeliveryReceipts) {
		t.Fatal("reopen lost head, currency or legacy proof", err)
	}
	oldest, err := repo.GetGroundItemOperation(winner.ID)
	if err != nil || oldest == nil || !GroundItemCharacterReceiptMatches(saved, oldest.GroundItemOperation) {
		t.Fatal("later saved head lost canonical older proof", err)
	}
	if replay, err := repo.PrepareGroundItemOperation(winner.GroundItemOperation); err != nil || replay.State != GroundItemComplete || replay.Fingerprint != winner.Fingerprint {
		t.Fatal("first frozen outcome changed on replay", err)
	}
	if !GroundItemCharacterReceiptMatches(saved, legacy) {
		t.Fatal("legacy recovery proof lost after new checkpoints")
	}
	t.Logf("schema%d; 8 contenders/1 winner; 100 retained ordered operations; saved character constant %d bytes; 99 serial prepare-save-completes %s; V1/reopen proofs retained", CurrentSchemaVersion, len(final), elapsed)
}
