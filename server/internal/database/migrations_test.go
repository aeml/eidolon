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

func TestSchemaMigrationCatalogFencesGroundItemGenerations(t *testing.T) {
	if CurrentSchemaVersion < 19 || len(schemaMigrations) < 19 || schemaMigrations[18].Name != "durable_ground_item_generations" {
		t.Fatal("older ground-item-unaware writers must be fenced before new intents are admitted")
	}
}

func TestEPWalletRequiresNewWriterSchema(t *testing.T) {
	// Schema11 predates EP wallets, grants and wager receipts. Its full-character
	// writers must not be admitted after any of those values have been saved.
	if CurrentSchemaVersion < 12 || len(schemaMigrations) < 12 ||
		schemaMigrations[11].Name != "ep_wallet_and_casino_receipts" {
		t.Fatal("EP state is writable by pre-EP schema11 servers")
	}
}

func TestAdminOperationReceiptsRequireNewWriterSchema(t *testing.T) {
	if CurrentSchemaVersion < 14 || len(schemaMigrations) < 14 || schemaMigrations[13].Name != "administration_operation_receipts" {
		t.Fatal("administration receipts could be erased by an older full-character writer")
	}
}

func TestWeeklyRaidReceiptsRequireNewWriterSchema(t *testing.T) {
	if CurrentSchemaVersion < 15 || len(schemaMigrations) < 15 || schemaMigrations[14].Name != "weekly_raid_delivery_receipts" {
		t.Fatal("weekly delivery receipts could be erased by an older writer")
	}
}

func TestGuildBankReceiptsRequireNewWriterSchema(t *testing.T) {
	if CurrentSchemaVersion < 16 || len(schemaMigrations) < 16 || schemaMigrations[15].Name != "durable_guild_bank_transfers" {
		t.Fatal("guild bank receipts could be erased by an older character/guild writer")
	}
}

func TestPublicNameReservationsRequireNewRegistrationWriter(t *testing.T) {
	if CurrentSchemaVersion < 17 || len(schemaMigrations) < 17 || schemaMigrations[16].Name != "account_public_names" {
		t.Fatal("older registration writers could duplicate corrected public names")
	}
}

func TestDirectTradeDecisionsRequireRecoveryAwareWriter(t *testing.T) {
	if CurrentSchemaVersion < 18 || len(schemaMigrations) < 18 || schemaMigrations[17].Name != "durable_direct_trade_decisions" {
		t.Fatal("older readers cannot coordinate pending two-account trade decisions")
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
			"public_name_key_unique":   true,
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
			"guild_bank_reserved": true,
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
		"guild_bank_operations": {
			"one_pending_bank_transfer_per_account": true,
			"one_pending_bank_transfer_per_guild":   true,
			"guild_bank_recovery":                   true,
			"guild_bank_pending_guild":              true,
		},
		"direct_trade_operations": {
			"one_pending_direct_trade_per_account": true,
			"direct_trade_recovery":                true,
		},
		"ground_item_operations": {
			"one_pending_ground_item_per_account": true,
			"one_pending_ground_item_per_loot":    true,
			"ground_item_generations":             true,
			"ground_item_recovery":                true,
			"ground_item_active_projection":       true,
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
			if collectionName == "ground_item_operations" {
				if _, ttl := document["expireAfterSeconds"]; ttl {
					t.Error("ground custody/replay identities must not have a TTL", document)
				}
				if name == "one_pending_ground_item_per_account" || name == "one_pending_ground_item_per_loot" {
					partial, ok := document["partialFilterExpression"].(bson.M)
					if document["unique"] != true || !ok || partial["state"] != GroundItemPending {
						t.Error("ground reservations must serialize only pending actors/loot", document)
					}
				}
				if name == "ground_item_generations" && document["unique"] != true {
					t.Error("completed generations must retain a unique fork fence", document)
				}
			}
			if collectionName == "guild_bank_operations" &&
				(name == "one_pending_bank_transfer_per_account" || name == "one_pending_bank_transfer_per_guild") {
				partial, ok := document["partialFilterExpression"].(bson.M)
				if document["unique"] != true || !ok || partial["state"] != GuildBankPending {
					t.Errorf("%s must serialize only pending intents: %v", name, document)
				}
			}
			if collectionName == "direct_trade_operations" && name == "one_pending_direct_trade_per_account" {
				partial, ok := document["partialFilterExpression"].(bson.M)
				key, keyOK := document["key"].(bson.M)
				if document["unique"] != true || !ok || partial["state"] != DirectTradePending || !keyOK || key["participants.username"] != int32(1) {
					t.Errorf("trade index must reserve both pending participants: %v", document)
				}
			}
		}
		if len(names) != 0 {
			t.Errorf("%s missing indexes: %v", collectionName, names)
		}
	}
}
