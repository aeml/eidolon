package database

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/event"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// A bounded storage workload, not gameplay, campaign pacing, concurrent-player
// capacity or replica failover evidence. Never permit a non-disposable database.
func TestPersistenceActualMongoHistoryQueriesAndReceiptGrowth(t *testing.T) {
	uri := os.Getenv("EIDOLON_PERSISTENCE_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 45*time.Second)
	defer cancel()
	var commandMu sync.Mutex
	var aggregateCommand bson.Raw
	fixture := fmt.Sprintf("persistence_scale_%d", time.Now().UnixNano())
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).SetMonitor(&event.CommandMonitor{
		Started: func(_ context.Context, command *event.CommandStartedEvent) {
			if command.CommandName == "aggregate" && command.Command.Lookup("aggregate").StringValue() == fixture+"_ground" {
				commandMu.Lock()
				aggregateCommand = append(bson.Raw(nil), command.Command...)
				commandMu.Unlock()
			}
		},
	}))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	raw := client.Database("eidolon")
	repo := &DB{client: client, groundItemOperations: raw.Collection(fixture + "_ground"), users: raw.Collection(fixture + "_users")}
	repo.characters = newMongoCharacterRepository(repo.users)
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		for _, collection := range []*mongo.Collection{repo.groundItemOperations, repo.users} {
			if err := collection.Drop(cleanupCtx); err != nil {
				t.Error(err)
			}
		}
	})
	if err := applyGroundItemOperationIndexes(ctx, repo); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.users.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)}); err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC().Truncate(time.Millisecond)
	const expiredCount, activeCount = 10000, 100
	rows := make([]interface{}, 0, expiredCount+activeCount)
	for index := 0; index < expiredCount+activeCount; index++ {
		record := groundStoreDrop()
		if index < expiredCount {
			record.LootID = fmt.Sprintf("expired-%05d", index)
			record.AvailableAt = now.Add(-2 * time.Hour)
		} else {
			record.LootID = fmt.Sprintf("live-%05d", index-expiredCount)
			record.AvailableAt = now.Add(-time.Second)
		}
		record.ID = GroundItemOperationID(record.LootID)
		record.Username = fmt.Sprintf("synthetic-account-%03d", index%100)
		record.PlayerID = "player-" + record.Username
		record.CreatedAt = record.AvailableAt.Add(-time.Second)
		record.ExpiresAt = record.AvailableAt.Add(time.Minute)
		record.State = GroundItemComplete
		record.Fingerprint, err = GroundItemFingerprint(record.GroundItemOperation)
		if err != nil || record.Validate() != nil {
			t.Fatal("invalid representative history fixture", index, err)
		}
		rows = append(rows, record)
	}
	if _, err := repo.groundItemOperations.InsertMany(ctx, rows); err != nil {
		t.Fatal(err)
	}
	for _, after := range []string{"", "live-00049"} {
		started := time.Now()
		page, err := repo.GroundItemProjectionPage(after, now, 50)
		if err != nil || len(page) != 50 {
			t.Fatal("active projection page lost data", after, len(page), err)
		}
		for _, record := range page {
			if record.LootID <= after || !strings.HasPrefix(record.LootID, "live-") {
				t.Fatal("projection returned historical or repeated loot", record.LootID)
			}
		}
		elapsed := time.Since(started)
		// Explain the pipeline ACTUALLY issued by the production repository,
		// including its hint when present; never measure a test-only query.
		commandMu.Lock()
		captured := append(bson.Raw(nil), aggregateCommand...)
		commandMu.Unlock()
		var issued struct {
			Pipeline mongo.Pipeline `bson:"pipeline"`
			Hint     interface{}    `bson:"hint"`
		}
		if err := bson.Unmarshal(captured, &issued); err != nil {
			t.Fatal(err)
		}
		command := bson.D{{Key: "aggregate", Value: repo.groundItemOperations.Name()}, {Key: "pipeline", Value: issued.Pipeline}, {Key: "cursor", Value: bson.D{}}}
		if issued.Hint != nil {
			command = append(command, bson.E{Key: "hint", Value: issued.Hint})
		}
		var explained struct {
			ExecutionStats persistenceExecutionStats `bson:"executionStats"`
			Stages         []struct {
				Cursor struct {
					ExecutionStats persistenceExecutionStats `bson:"executionStats"`
				} `bson:"$cursor"`
			} `bson:"stages"`
		}
		if err := raw.RunCommand(ctx, bson.D{{Key: "explain", Value: command}, {Key: "verbosity", Value: "executionStats"}}).Decode(&explained); err != nil {
			t.Fatal(err)
		}
		stats := explained.ExecutionStats
		if len(explained.Stages) > 0 {
			stats = explained.Stages[0].Cursor.ExecutionStats
		}
		t.Logf("ground_projection after=%q expired=%d active=%d returned=%d elapsed=%s examined_documents=%d examined_keys=%d", after, expiredCount, activeCount, len(page), elapsed, stats.TotalDocsExamined, stats.TotalKeysExamined)
		if stats.TotalDocsExamined < 50 || stats.TotalDocsExamined > 2*activeCount {
			t.Fatal("active projection scanned retained historical custody instead of the active window", stats)
		}
	}

	characters := make([]*Character, 100)
	users := make([]interface{}, len(characters))
	for index := range characters {
		character := &Character{Name: fmt.Sprintf("save-fixture-%03d", index), Class: []string{"Fighter", "Rogue", "Cleric", "Wizard"}[index%4], Level: 100, Gold: 12345, EP: 43,
			ItemDeliveryReceipts: persistenceReceiptMap(1000)}
		characters[index], users[index] = character, User{Username: character.Name, Characters: []*Character{character}}
	}
	if _, err := repo.users.InsertMany(ctx, users); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	for _, character := range characters {
		character.Gold++
		if err := repo.SaveCharacter(character.Name, character); err != nil {
			t.Fatal(err)
		}
	}
	t.Logf("serial_character_saves accounts=100 receipts_per_character=1000 elapsed=%s", time.Since(started))
	for _, size := range []int{0, 1000, 10000} {
		character := characters[0]
		character.ItemDeliveryReceipts = persistenceReceiptMap(size)
		encoded, err := bson.Marshal(character)
		if err != nil {
			t.Fatal(err)
		}
		started := time.Now()
		if err := repo.SaveCharacter(character.Name, character); err != nil {
			t.Fatal(err)
		}
		loaded, err := repo.GetCharacter(character.Name, character.Name)
		if err != nil || loaded == nil || loaded.Gold != 12346 || loaded.EP != 43 || loaded.Class != character.Class || loaded.Level != character.Level || !reflect.DeepEqual(loaded.ItemDeliveryReceipts, character.ItemDeliveryReceipts) {
			t.Fatal("growth/save changed exact currency, class or receipt contents", size, err)
		}
		t.Logf("character_roundtrip receipts=%d bson_bytes=%d elapsed=%s", size, len(encoded), time.Since(started))
	}
}

type persistenceExecutionStats struct {
	TotalDocsExamined int64 `bson:"totalDocsExamined"`
	TotalKeysExamined int64 `bson:"totalKeysExamined"`
}

func persistenceReceiptMap(count int) map[string]string {
	result := make(map[string]string, count)
	for index := 0; index < count; index++ {
		result[GroundItemOperationID(fmt.Sprintf("retained-operation-%05d", index))] = strings.Repeat("a", 64)
	}
	return result
}
