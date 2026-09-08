package database

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestSchemaCompatibilityRejectsUnknownFutureWriters(t *testing.T) {
	for _, version := range []int{0, 1, CurrentSchemaVersion} {
		if err := validateSupportedSchema(version); err != nil {
			t.Fatal("supported schema refused", version, err)
		}
	}
	for _, version := range []int{-1, CurrentSchemaVersion + 1, 1000000} {
		if err := validateSupportedSchema(version); err == nil {
			t.Fatal("unsupported schema admitted", version)
		}
	}
}

func TestSchemaCompatibilityFutureDatabaseIsNotModified(t *testing.T) {
	if os.Getenv("EIDOLON_SCHEMA_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	uri := os.Getenv("EIDOLON_SCHEMA_MONGO_URI")
	binary := os.Getenv("EIDOLON_SCHEMA_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires isolated loopback Mongo URI")
	}
	if !filepath.IsAbs(binary) {
		t.Fatal("requires an absolute owned server binary path")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Disconnect(context.Background()) })
	raw := client.Database("eidolon")
	collections, err := raw.ListCollectionNames(ctx, bson.M{})
	if err != nil || len(collections) != 0 {
		t.Fatal("requires a fresh empty owned database", collections, err)
	}
	checkPreflight := func(wantVersion int, wantSuccess bool) {
		t.Helper()
		version, checkErr := CheckSchemaCompatibility(ctx, uri)
		if version != wantVersion || (checkErr == nil) != wantSuccess {
			t.Fatalf("read-only check: version=%d err=%v", version, checkErr)
		}
		processCtx, stop := context.WithTimeout(ctx, 5*time.Second)
		defer stop()
		command := exec.CommandContext(processCtx, binary, "--check-schema", "--mongo-uri", uri)
		command.Dir = t.TempDir()
		output, runErr := command.CombinedOutput()
		if wantSuccess {
			if runErr != nil || !strings.Contains(string(output), fmt.Sprintf("Schema preflight passed: database=%d supported=%d", wantVersion, CurrentSchemaVersion)) {
				t.Fatalf("compatible CLI preflight failed: %v\n%s", runErr, output)
			}
		} else if exitErr, ok := runErr.(*exec.ExitError); !ok || exitErr.ExitCode() != 1 || !strings.Contains(string(output), "refusing startup before writes") {
			t.Fatalf("incompatible CLI preflight did not refuse: %v\n%s", runErr, output)
		}
		files, err := os.ReadDir(command.Dir)
		if err != nil || len(files) != 0 || strings.Contains(string(output), "Server started") {
			t.Fatal("preflight opened logging/journal files or admitted players", files, err, string(output))
		}
		t.Logf("owned read-only schema preflight: %s", output)
	}
	checkPreflight(0, true)
	collections, err = raw.ListCollectionNames(ctx, bson.M{})
	if err != nil || len(collections) != 0 {
		t.Fatal("fresh preflight performed migrations", collections, err)
	}
	future := bson.M{"version": CurrentSchemaVersion + 1, "name": "future_save_format", "applied_at": time.Now().UTC().Truncate(time.Millisecond)}
	inserted, err := raw.Collection("schema_migrations").InsertOne(ctx, future)
	if err != nil {
		t.Fatal(err)
	}
	protected := bson.M{"username": "future-owner", "characters": bson.A{bson.M{
		"name": "future-character", "gold": 1209, "resources": bson.M{"version": 1, "mana": 0, "health": 17},
		"gold_credit_receipts": bson.M{"listing:operation": -25}, "unknown_future_field": bson.M{"preserve": true}}}}
	if _, err := raw.Collection("users").InsertOne(ctx, protected); err != nil {
		t.Fatal(err)
	}
	var before bson.Raw
	if err := raw.Collection("users").FindOne(ctx, bson.M{"username": "future-owner"}).Decode(&before); err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		checkPreflight(CurrentSchemaVersion+1, false)
		db, err := New(uri)
		if db != nil || err == nil || !strings.Contains(err.Error(), "refusing startup before writes") {
			t.Fatal("future schema opened by older writer", db, err)
		}
		processCtx, stopProcess := context.WithTimeout(ctx, 5*time.Second)
		command := exec.CommandContext(processCtx, binary, "-addr", "127.0.0.1:0", "-mongo-uri", uri,
			"-log-file", "", "-suspicious-log-file", "", "-economy-metrics-file", "")
		output, processErr := command.CombinedOutput()
		stopProcess()
		exitErr, exited := processErr.(*exec.ExitError)
		if !exited || exitErr.ExitCode() != 1 || !strings.Contains(string(output), "refusing startup before writes") || strings.Contains(string(output), "Server started") {
			t.Fatalf("owned old-writer binary failed to refuse before admission: %v\n%s", processErr, output)
		}
		t.Logf("owned old-writer startup refusal %d: %s", attempt+1, output)
		collections, err := raw.ListCollectionNames(ctx, bson.M{})
		if err != nil || len(collections) != 2 {
			t.Fatal("incompatible startup created collections", collections, err)
		}
		indexes, err := raw.Collection("schema_migrations").Indexes().ListSpecifications(ctx)
		if err != nil || len(indexes) != 1 || indexes[0].Name != "_id_" {
			t.Fatal("incompatible startup created migration indexes", indexes, err)
		}
		var after bson.Raw
		if err := raw.Collection("users").FindOne(ctx, bson.M{"username": "future-owner"}).Decode(&after); err != nil || !reflect.DeepEqual(before, after) {
			t.Fatal("incompatible startup rewrote a future character", err)
		}
	}
	// Remove ONLY our prepared future marker to exercise normal fresh migration.
	// This is test-fixture cleanup, not a supported production downgrade process.
	if _, err := raw.Collection("schema_migrations").DeleteOne(ctx, bson.M{"_id": inserted.InsertedID}); err != nil {
		t.Fatal(err)
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal("compatible fresh database failed normal migrations", err)
	}
	defer db.Close(context.Background())
	version, err := db.SchemaVersion(ctx)
	if err != nil || version != CurrentSchemaVersion {
		t.Fatal("normal migration did not reach supported version", version, err)
	}
	if err := db.RunMigrations(ctx); err != nil {
		t.Fatal("compatible repeated startup refused", err)
	}
	checkPreflight(CurrentSchemaVersion, true)
}
