package database

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestSchemaMigrationCatalogIsContiguous(t *testing.T) {
	if len(schemaMigrations) == 0 {
		t.Fatal("schema migration catalog is empty")
	}
	for i, migration := range schemaMigrations {
		wantVersion := i + 1
		if migration.Version != wantVersion {
			t.Fatalf("migration %d has version %d, want contiguous version %d", i, migration.Version, wantVersion)
		}
		if migration.Name == "" || migration.Apply == nil {
			t.Fatalf("migration %d is incomplete: %#v", migration.Version, migration)
		}
	}
	if got := schemaMigrations[len(schemaMigrations)-1].Version; got != CurrentSchemaVersion {
		t.Fatalf("CurrentSchemaVersion = %d, migration catalog ends at %d", CurrentSchemaVersion, got)
	}
}

func TestRunMigrationsIsIdempotentAndBuildsQueryIndexes(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI is required for migration integration coverage")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db, err := New(uri)
	if err != nil {
		t.Fatalf("connect and migrate: %v", err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	if err := db.RunMigrations(ctx); err != nil {
		t.Fatalf("second migration run was not idempotent: %v", err)
	}
	version, err := db.SchemaVersion(ctx)
	if err != nil {
		t.Fatalf("read schema version: %v", err)
	}
	if version != CurrentSchemaVersion {
		t.Fatalf("schema version = %d, want %d", version, CurrentSchemaVersion)
	}

	wantIndexes := map[string]map[string]bool{
		"users": {
			"username_1":               true,
			"characters.name_1":        true,
			"characters.instance_id_1": true,
		},
		"auctions": {
			"id_1":                 true,
			"status_1_end_time_1":  true,
			"seller_id_1_status_1": true,
		},
		"friendships": {
			"requester_id_1_addressee_id_1": true,
			"addressee_id_1_status_1":       true,
			"requester_id_1_status_1":       true,
		},
		"reports": {
			"status_1_created_at_1":    true,
			"username_1_created_at_-1": true,
		},
		"guilds": {
			"id_1":                true,
			"name_key_1":          true,
			"tag_1":               true,
			"members.player_id_1": true,
		},
		"guild_invites": {
			"guild_id_1_target_id_1":   true,
			"target_id_1_expires_at_1": true,
			"expires_at_1_ttl":         true,
		},
		"pvp_profiles": {
			"player_id_1":        true,
			"season_1_rating_-1": true,
		},
		"raid_lockouts": {
			"player_id_1_week_1":     true,
			"week_1_completed_at_-1": true,
		},
		"guild_dungeon_runs": {
			"season_1_dungeon_1_difficulty_1_level_1_guild_1":     true,
			"season_1_dungeon_1_difficulty_1_level_-1_duration_1": true,
		},
	}
	for collectionName, names := range wantIndexes {
		cursor, err := db.client.Database("eidolon").Collection(collectionName).Indexes().List(ctx)
		if err != nil {
			t.Fatalf("list %s indexes: %v", collectionName, err)
		}
		var documents []bson.M
		if err := cursor.All(ctx, &documents); err != nil {
			t.Fatalf("decode %s indexes: %v", collectionName, err)
		}
		for _, document := range documents {
			name, _ := document["name"].(string)
			delete(names, name)
		}
		if len(names) != 0 {
			t.Errorf("%s missing indexes: %v", collectionName, names)
		}
	}
}
