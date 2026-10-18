package database

import (
	"context"
	"os"
	"regexp"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// This fixture enables failCommand only on an explicitly owned disposable
// server started with enableTestCommands. Never use an ordinary/live URI.
func startupBudgetMongo(t *testing.T) (*mongo.Client, string) {
	t.Helper()
	uri := os.Getenv("EIDOLON_DB_STARTUP_TEST_MONGO_URI")
	if os.Getenv("EIDOLON_DB_STARTUP_DISPOSABLE") != "1" {
		t.Skip("explicit disposable startup-budget Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+$`).MatchString(uri) {
		t.Fatal("startup-budget fixture requires an explicit loopback Mongo URI")
	}
	client, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Database("admin").RunCommand(ctx, bson.M{"configureFailPoint": "failCommand", "mode": "off"}).Err()
		_ = client.Disconnect(ctx)
	})
	if err := client.Ping(t.Context(), nil); err != nil {
		t.Fatal(err)
	}
	return client, uri
}

func TestDBStartupSeparatesConnectionAndMigrationBudgets(t *testing.T) {
	control, uri := startupBudgetMongo(t)
	// Two real six-second commands are each valid work. Their sum exceeds
	// the ten-second connection budget before any browser/account preparation.
	if err := control.Database("admin").RunCommand(t.Context(), bson.M{
		"configureFailPoint": "failCommand", "mode": bson.M{"times": 2},
		"data": bson.M{"failCommands": bson.A{"ping", "createIndexes"}, "blockConnection": true, "blockTimeMS": 6000},
	}).Err(); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	db, err := New(uri)
	if err != nil {
		t.Fatalf("connection and migration must have independent bounded budgets: %v", err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	if elapsed := time.Since(started); elapsed < 11*time.Second {
		t.Fatalf("real delayed startup did not exceed the connection budget: %s", elapsed)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	version, err := db.SchemaVersion(ctx)
	if err != nil || version != CurrentSchemaVersion {
		t.Fatalf("startup did not finish the exact schema: version=%d error=%v", version, err)
	}
}

func TestDBStartupRetainsConnectionDeadline(t *testing.T) {
	control, uri := startupBudgetMongo(t)
	if err := control.Database("admin").RunCommand(t.Context(), bson.M{
		"configureFailPoint": "failCommand", "mode": bson.M{"times": 1},
		"data": bson.M{"failCommands": bson.A{"ping"}, "blockConnection": true, "blockTimeMS": 12000},
	}).Err(); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	db, err := New(uri)
	if db != nil || err == nil {
		if db != nil {
			_ = db.Close(context.Background())
		}
		t.Fatalf("a connection exceeding its own deadline must fail: db=%v error=%v", db != nil, err)
	}
	if elapsed := time.Since(started); elapsed < 9*time.Second || elapsed > 11*time.Second {
		t.Fatalf("connection deadline changed: %s", elapsed)
	}
}
