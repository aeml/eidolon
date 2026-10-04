package database

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// This is an upgrade/rollback fence test, not a reward replay or load test.
// It refuses non-empty targets and requires an explicitly disposable loopback
// namespace plus the exact previously deployed executable, without its .env.
func TestSchema17UpgradePreservesAccountsAndFencesPreviousWriter(t *testing.T) {
	if os.Getenv("EIDOLON_SCHEMA_UPGRADE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and previous schema17 binary")
	}
	uri := os.Getenv("EIDOLON_SCHEMA_MONGO_URI")
	previous := os.Getenv("EIDOLON_SCHEMA_UPGRADE_PREVIOUS_BINARY")
	commit := os.Getenv("EIDOLON_SCHEMA_UPGRADE_PREVIOUS_COMMIT")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) ||
		!filepath.IsAbs(previous) || !regexp.MustCompile(`^[a-f0-9]{40}$`).MatchString(commit) {
		t.Fatal("requires isolated loopback URI, absolute previous binary and exact release commit")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	raw := client.Database("eidolon")
	names, err := raw.ListCollectionNames(ctx, bson.M{})
	if err != nil || len(names) != 0 {
		t.Fatal("requires fresh empty owned eidolon database", names, err)
	}
	// Attest the copied public executable before relying on its refusal later.
	// The read-only command must neither create collections nor write files.
	runPrevious := func(preflight, compatible bool) {
		t.Helper()
		args := []string{"--mongo-uri", uri, "--addr", "127.0.0.1:0", "--log-file", "",
			"--suspicious-log-file", "", "--economy-metrics-file", ""}
		if preflight {
			args = append(args, "--check-schema")
		}
		processCtx, stop := context.WithTimeout(ctx, 5*time.Second)
		defer stop()
		command := exec.CommandContext(processCtx, previous, args...)
		command.Dir = t.TempDir()
		command.Env = []string{"GOMAXPROCS=2"} // no mail, role, journal or operator environment
		output, runErr := command.CombinedOutput()
		if compatible {
			want := fmt.Sprintf("Schema preflight passed: database=0 supported=17 commit=%s", commit)
			if runErr != nil || strings.TrimSpace(string(output)) != want {
				t.Fatalf("previous executable identity mismatch: %v\n%s", runErr, output)
			}
		} else {
			exitErr, ok := runErr.(*exec.ExitError)
			if !ok || exitErr.ExitCode() != 1 || !strings.Contains(string(output), "supports (17)") ||
				!strings.Contains(string(output), "refusing startup before writes") || strings.Contains(string(output), "Server started") {
				t.Fatalf("schema17 writer not fenced (preflight=%t): %v\n%s", preflight, runErr, output)
			}
		}
		files, err := os.ReadDir(command.Dir)
		if err != nil || len(files) != 0 {
			t.Fatal("previous executable wrote logs or journals", files, err)
		}
	}
	runPrevious(true, true)
	names, err = raw.ListCollectionNames(ctx, bson.M{})
	if err != nil || len(names) != 0 {
		t.Fatal("previous read-only preflight mutated fresh database", names, err)
	}

	// Catalog1..17 and its index builders are unchanged from accepted1.71.
	// Apply that prefix only: never run the current constructor to manufacture
	// an old fixture, delete newer markers, or downgrade a populated database.
	legacy := &DB{client: client, migrations: raw.Collection("schema_migrations"),
		users: raw.Collection("users"), auctions: raw.Collection("auctions"),
		auctionBids: raw.Collection("auction_bid_operations"), friendships: raw.Collection("friendships"),
		reports: raw.Collection("reports"), guilds: raw.Collection("guilds"),
		guildInvites: raw.Collection("guild_invites"), pvpProfiles: raw.Collection("pvp_profiles"),
		raidLockouts: raw.Collection("raid_lockouts"), guildRuns: raw.Collection("guild_dungeon_runs"),
		adminActivity: raw.Collection("admin_activity"), adminOperations: raw.Collection("admin_operations"),
		guildBankOperations: raw.Collection("guild_bank_operations")}
	if _, err := legacy.migrations.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "version", Value: 1}}, Options: options.Index().SetName("version_1").SetUnique(true),
	}); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	for _, migration := range schemaMigrations[:17] {
		if err := migration.Apply(ctx, legacy); err != nil {
			t.Fatal("prepare legacy migration", migration.Version, err)
		}
		if _, err := legacy.migrations.InsertOne(ctx, appliedMigration{migration.Version, migration.Name, now}); err != nil {
			t.Fatal(err)
		}
	}
	challenge := recoveryChallenge{Digest: strings.Repeat("a", 64), Address: "fixture@example.invalid",
		PasswordHash: "synthetic-credential-hash", IssuedAt: now, ExpiresAt: now.Add(time.Minute)}
	account := bson.M{"username": "upgrade-fixture", "public_name": "Upgrade Fixture", "public_name_key": "upgrade fixture",
		"password_hash": challenge.PasswordHash, "email": "unverified@example.invalid",
		"roles":                  bson.M{"admin": AccountRoleAssignment{GrantedAt: now, GrantedBy: "fixture", Source: "fixture"}},
		"recovery_email":         recoveryEmail{Address: challenge.Address, VerifiedAt: now},
		"recovery_email_pending": challenge, "password_recovery": challenge,
		"unknown_account_field": bson.M{"preserve": true},
		"characters": bson.A{bson.M{"name": "Upgrade Fixture", "gold": 1209, "ep": 83,
			"inventory":   bson.A{bson.M{"id": "fixture-sword", "type": "sword", "potency": 7}},
			"equipment":   bson.M{"mainHand": bson.M{"id": "fixture-equipped"}},
			"well_rested": CharacterWellRested{RemainingSeconds: 123}, "gold_credit_receipts": bson.M{"fixture-listing": -25},
			"appearance_collection":  bson.M{"fixture-cosmetic": bson.M{"cosmetic_id": "fixture-cosmetic"}},
			"vip_allowance_receipts": bson.M{"fixture-month": 100}, "ep_exchange_receipts": bson.M{"fixture-exchange": 1},
			"ep_casino_receipts": bson.M{"fixture-bet": -18}, "admin_operation_receipts": bson.M{"fixture-grant": "receipt"},
			"weekly_raid_reward_receipts": bson.M{"fixture-week": true}, "unknown_character_field": bson.M{"preserve": true}}}}
	if _, err := legacy.users.InsertOne(ctx, account); err != nil {
		t.Fatal(err)
	}
	if _, err := legacy.auctions.InsertOne(ctx, bson.M{"id": "fixture-auction", "seller_id": "upgrade-fixture",
		"status": "active", "bid": 41, "unknown_field": "preserve"}); err != nil {
		t.Fatal(err)
	}
	if version, err := CheckSchemaCompatibility(ctx, uri); err != nil || version != 17 {
		t.Fatal("legacy fixture is not schema17", version, err)
	}
	before := schemaUpgradeSnapshot(t, ctx, raw)
	db, err := New(uri)
	if err != nil {
		t.Fatal("schema17 upgrade failed", err)
	}
	if err := db.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if version, err := CheckSchemaCompatibility(ctx, uri); err != nil || version != CurrentSchemaVersion {
		t.Fatal("upgrade did not reach current schema", version, err)
	}
	after := schemaUpgradeSnapshot(t, ctx, raw)
	for name, saved := range before {
		current, ok := after[name]
		if name == "schema_migrations" {
			if !ok || len(current.documents) != CurrentSchemaVersion || !reflect.DeepEqual(saved.indexes, current.indexes) {
				t.Fatal("incorrect migration markers/indexes")
			}
			for _, marker := range saved.documents {
				found := false
				for _, candidate := range current.documents {
					found = found || reflect.DeepEqual(marker, candidate)
				}
				if !found {
					t.Fatal("upgrade changed a legacy migration marker")
				}
			}
		} else if !ok || !reflect.DeepEqual(saved, current) {
			t.Fatal("upgrade changed legacy documents/indexes", name)
		}
	}
	wantNew := map[string]int{"direct_trade_operations": 3, "ground_item_operations": 6,
		"dungeon_room_rewards": 4, "boss_victories": 5} // includes each _id_ index
	wantUnique := map[string]bson.M{
		"one_pending_direct_trade_per_account": {"participants.username": int32(1)},
		"one_pending_ground_item_per_account":  {"username": int32(1)},
		"one_pending_ground_item_per_loot":     {"loot_id": int32(1)},
		"ground_item_generations":              {"loot_id": int32(1), "generation": int32(-1)},
		"unique_room_reward":                   {"instance_id": int32(1), "room_index": int32(1)},
		"unique_boss_victory":                  {"instance_id": int32(1), "boss_id": int32(1)},
	}
	if len(after) != len(before)+len(wantNew) {
		t.Fatal("upgrade created unexpected collections")
	}
	for name, wantIndexes := range wantNew {
		saved, ok := after[name]
		if !ok || len(saved.documents) != 0 || len(saved.indexes) != wantIndexes {
			t.Fatal("new operation collection has missing indexes or backfilled value", name)
		}
		for _, index := range saved.indexes {
			if _, err := index.LookupErr("expireAfterSeconds"); err == nil {
				t.Fatal("durable operation identity has an unsafe TTL", name)
			}
			indexName := index.Lookup("name").StringValue()
			if key, critical := wantUnique[indexName]; critical {
				var fields bson.M
				if err := bson.Unmarshal(index, &fields); err != nil || fields["unique"] != true || !reflect.DeepEqual(fields["key"], key) {
					t.Fatal("incorrect unique operation fence", name, indexName, err)
				}
				partial, isPartial := fields["partialFilterExpression"]
				if strings.HasPrefix(indexName, "one_pending_") {
					if !reflect.DeepEqual(partial, bson.M{"state": "pending"}) {
						t.Fatal("pending reservations have incorrect partial predicate", name, indexName)
					}
				} else if isPartial {
					t.Fatal("completed identity fence must not be partial", name, indexName)
				}
				delete(wantUnique, indexName)
			}
		}
	}
	if len(wantUnique) != 0 {
		t.Fatal("missing unique operation fences", wantUnique)
	}
	// A new constructor (not only an in-process repeat) must be idempotent.
	db, err = New(uri)
	if err != nil {
		t.Fatal("repeated startup failed", err)
	}
	if err := db.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(after, schemaUpgradeSnapshot(t, ctx, raw)) {
		t.Fatal("repeated startup changed documents or indexes")
	}
	for _, preflight := range []bool{true, false} {
		runPrevious(preflight, false)
		if !reflect.DeepEqual(after, schemaUpgradeSnapshot(t, ctx, raw)) {
			t.Fatal("refused schema17 writer changed documents or indexes", preflight)
		}
	}
	t.Logf("schema17 -> %d: all legacy BSON/indexes retained; four empty indexed operation collections; repeat startup stable; exact %s schema17 executable refused preflight and startup", CurrentSchemaVersion, commit)
}

type schemaUpgradeCollection struct {
	documents []bson.Raw
	indexes   []bson.Raw
}

func schemaUpgradeSnapshot(t *testing.T, ctx context.Context, db *mongo.Database) map[string]schemaUpgradeCollection {
	t.Helper()
	names, err := db.ListCollectionNames(ctx, bson.M{})
	if err != nil {
		t.Fatal(err)
	}
	result := make(map[string]schemaUpgradeCollection, len(names))
	for _, name := range names {
		collection := db.Collection(name)
		cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
		if err != nil {
			t.Fatal(err)
		}
		var saved schemaUpgradeCollection
		if err := cursor.All(ctx, &saved.documents); err != nil {
			t.Fatal(err)
		}
		indexes, err := collection.Indexes().List(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if err := indexes.All(ctx, &saved.indexes); err != nil {
			t.Fatal(err)
		}
		sort.Slice(saved.indexes, func(i, j int) bool {
			return saved.indexes[i].Lookup("name").StringValue() < saved.indexes[j].Lookup("name").StringValue()
		})
		result[name] = saved
	}
	return result
}
