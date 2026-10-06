package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

// Real archive tools and the production helper in an explicitly owned Compose
// project. No ports, game process, production data or networking changes.
func TestRestoreActualArchiveRejectsMixedStateAndReplacesOnlyEidolon(t *testing.T) {
	if os.Getenv("EIDOLON_DEPLOY_BACKUP_DISPOSABLE") != "1" {
		t.Skip("requires explicitly disposable Docker restore verification")
	}
	script, err := os.ReadFile("deploy/restore_mongo_archive.sh")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	project := fmt.Sprintf("eidolon-restore-proof-%d", time.Now().UnixNano())
	t.Logf("owned_restore_project=%s", project)
	if err := os.Mkdir(filepath.Join(root, "deploy"), 0700); err != nil {
		t.Fatal(err)
	}
	compose := fmt.Sprintf(`name: %s
x-mongo: &mongo
  image: mongo:7.0.14
  network_mode: none
  cpus: 1
  mem_limit: 512m
  environment:
    MONGO_INITDB_ROOT_USERNAME: restore_fixture
    MONGO_INITDB_ROOT_PASSWORD: disposable_restore_fixture
  healthcheck:
    test: [CMD-SHELL, "test \"$$(cat /proc/1/comm)\" = mongod && mongosh --quiet --eval 'db.runCommand({ping: 1}).ok'"]
    interval: 1s
    timeout: 5s
    retries: 40
services:
  mongo:
    <<: *mongo
    volumes: [target_data:/data/db]
  source:
    <<: *mongo
    volumes: [source_data:/data/db]
  api:
    image: mongo:7.0.14
    network_mode: none
    command: [sh, -c, "exit 0"]
volumes:
  target_data:
  source_data:
`, project)
	for name, data := range map[string][]byte{"compose.yml": []byte(compose), ".env": []byte("# Docker-only owned fixture\n"), "deploy/restore_mongo_archive.sh": script} {
		if err := os.WriteFile(filepath.Join(root, name), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	ctx, stop := context.WithTimeout(t.Context(), 2*time.Minute)
	defer stop()
	env := append(os.Environ(), "COMPOSE_PROJECT_NAME="+project, "COMPOSE_FILE="+filepath.Join(root, "compose.yml"))
	run := func(input io.Reader, args ...string) []byte {
		t.Helper()
		cmd := exec.CommandContext(ctx, "docker", args...)
		cmd.Dir, cmd.Env, cmd.Stdin = root, env, input
		output, err := cmd.Output() // Archive stdout must not mix with diagnostic stderr.
		if err != nil {
			t.Fatal("owned Docker operation failed", err)
		}
		return bytes.TrimSpace(output)
	}
	if ids := run(nil, "ps", "-a", "-q", "--filter", "label=com.docker.compose.project="+project); len(ids) != 0 {
		t.Fatal("refusing to reuse an existing project")
	}
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 30*time.Second)
		defer stop()
		cmd := exec.CommandContext(cleanupCtx, "docker", "compose", "down", "--volumes", "--remove-orphans")
		cmd.Dir, cmd.Env = root, env
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Errorf("owned restore cleanup failed: %v %s", err, output)
		}
	})
	run(nil, "compose", "up", "-d", "--wait", "mongo", "source")
	const shell = `exec mongosh --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet --eval `
	js := func(service, code string) []byte {
		t.Helper()
		return run(nil, "compose", "exec", "-T", service, "sh", "-c", shell+"'"+code+"'")
	}
	resume := roomPreparedResume("dungeon_retained")
	resume.PartyID, resume.CurrentRoomIndexValue = "retained-party", 2
	resume.Rooms[0] = database.DungeonRoomProgress{Explored: true, Cleared: true}
	resume.Rooms[1] = database.DungeonRoomProgress{Explored: true, Cleared: true, Rewarded: true}
	if err := game.ValidateDungeonLayout(dungeonResumeFromDatabase(resume).Layout); err != nil {
		t.Fatal("prepared archive must contain valid canonical dungeon geometry", err)
	}
	resumeJSON, err := bson.MarshalExtJSON(resume, false, false)
	if err != nil {
		t.Fatal(err)
	}
	js("source", fmt.Sprintf(`
const d=db.getSiblingDB("eidolon");
d.users.insertOne({_id:"owner",username:"owner",characters:[{name:"owner",gold:1184,ep:83,
  resources:{version:1,health:17,mana:0},ground_account_ordinal:NumberLong(2),
  ground_account_operation_id:"ground-original",ground_account_fingerprint:"retained-ground-fingerprint",
  casino_wallet_checkpoints:{"vip-blackjack":{version:NumberLong(3),id:"casino-original",fingerprint:"retained-casino-fingerprint"}},
  item_delivery_receipts:{legacy:"retained"},gold_credit_receipts:{"listing:legacy":-25},
  vip_allowance_receipts:{"month-one":100},ep_exchange_receipts:{exchange:1},ep_casino_receipts:{"casino:legacy":-18},
  appearance_collection:{"earth-armor":{base_name:"Earth Armor",slot:"chest"}},
  well_rested:{version:1,remaining_seconds:7200},instance_id:"dungeon_retained",party_id:"retained-party",
  last_logout:new Date("2026-10-06T02:00:00Z"),
  dungeon_progress:EJSON.parse(%s),
  unknown_future_metadata:{retain:true}}]});
d.schema_migrations.insertOne({_id:"schema",version:%d,name:"versioned_casino_wallet_checkpoints"});
d.guilds.insertOne({_id:"retained-guild",id:"retained-guild",name:"Retained Guild",name_key:"retained guild",tag:"KEEP",
  leader_id:"player-owner",members:[{player_id:"player-owner",username:"owner",rank:"leader",joined_at:new Date("2026-09-01")}],
  bank:{gold:456,items:[{id:"retained-guild-item",name:"Guild Shield",type:"ARMOR",slot:"offHand",stack:1,max_stack:1}]},
  version:7,pending_bank_operation_id:"retained-bank-transfer",pending_bank_operation_fingerprint:"bank-fingerprint",
  audit:[{operation_id:"retained-bank-receipt",action:"deposit",amount:456,actor_id:"player-owner"}]});
d.guild_bank_operations.insertOne({_id:"retained-bank-transfer",state:"pending",fingerprint:"bank-fingerprint"});
d.ground_item_operations.insertOne({_id:"ground-original",account_ordinal:NumberLong(2),state:"pending",fingerprint:"retained-ground-fingerprint"});
d.casino_blackjack_tables.insertOne({_id:"vip-blackjack",version:NumberLong(3),state:BinData(0,"e30="),
  pending:{id:"casino-original",currency:"ep",amount:18,next_state:BinData(0,"e30=")}});
d.users.createIndex({username:1},{name:"username_1",unique:true});`, strconv.Quote(string(resumeJSON)), database.CurrentSchemaVersion))
	js("mongo", `db.getSiblingDB("unrelated_fixture").sentinel.insertOne({_id:"keep",value:43});`)
	const snapshot = `const d=db.getSiblingDB("eidolon"); print(EJSON.stringify(d.getCollectionNames().sort().map(name=>({name,docs:d.getCollection(name).find().sort({_id:1}).toArray(),indexes:d.getCollection(name).getIndexes()})),{relaxed:false}));`
	want := js("source", snapshot)
	// Unlike textual command results, preserve the binary archive byte-for-byte.
	dumpCmd := exec.CommandContext(ctx, "docker", "compose", "exec", "-T", "source", "sh", "-c", `exec mongodump --archive --gzip --db=eidolon --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin`)
	dumpCmd.Dir, dumpCmd.Env = root, env
	dump, err := dumpCmd.Output()
	if err != nil {
		t.Fatal("owned dump failed", err)
	}
	archive := filepath.Join(root, "selected archive.gz")
	if err := os.WriteFile(archive, dump, 0600); err != nil {
		t.Fatal(err)
	}
	restore := func(selected string, replacement bool) ([]byte, error) {
		args := []string{filepath.Join(root, "deploy/restore_mongo_archive.sh"), selected, "--confirm-data-loss", "--confirm-privacy-and-journal-plan"}
		if replacement {
			args = append(args, "--replace-eidolon-database")
		}
		cmd := exec.CommandContext(ctx, "bash", args...)
		cmd.Dir, cmd.Env = root, env
		return cmd.CombinedOutput()
	}
	if output, err := restore(archive, false); err != nil {
		t.Fatalf("fresh target restore failed: %v %s", err, output)
	}
	if got := js("mongo", snapshot); !bytes.Equal(got, want) {
		t.Fatal("fresh restore changed private fields, namespace set or indexes")
	}
	var restoredCharacter database.Character
	if err := bson.UnmarshalExtJSON(js("mongo", `print(EJSON.stringify(db.getSiblingDB("eidolon").users.findOne({_id:"owner"}).characters[0],{relaxed:false}));`), false, &restoredCharacter); err != nil ||
		!reflect.DeepEqual(restoredCharacter.DungeonProgress, resume) || restoredCharacter.WellRested == nil || restoredCharacter.WellRested.RemainingSeconds != 7200 {
		t.Fatal("restored dungeon/rested metadata is not consumable by current BSON models", err)
	}
	if err := game.ValidateDungeonLayout(dungeonResumeFromDatabase(restoredCharacter.DungeonProgress).Layout); err != nil {
		t.Fatal("restored canonical dungeon geometry is invalid", err)
	}
	js("mongo", `const d=db.getSiblingDB("eidolon"); d.users.updateOne({_id:"owner"},{$set:{"characters.0.gold":999}}); d.later_operation_ledger.insertOne({_id:"newer-pending",state:"pending"});`)
	before := js("mongo", snapshot)
	if output, err := restore(archive, false); err == nil || !bytes.Contains(output, []byte("target is not empty")) {
		t.Fatal("non-empty target was not refused before mutation", err)
	}
	if got := js("mongo", snapshot); !bytes.Equal(got, before) {
		t.Fatal("refused restore changed destination data")
	}
	var invalid bytes.Buffer
	zip := gzip.NewWriter(&invalid)
	if _, err := zip.Write([]byte("valid gzip but not a Mongo archive")); err != nil {
		t.Fatal(err)
	}
	if err := zip.Close(); err != nil {
		t.Fatal(err)
	}
	badArchive := filepath.Join(root, "invalid archive.gz")
	if err := os.WriteFile(badArchive, invalid.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := restore(badArchive, true); err == nil {
		t.Fatal("invalid archive reached database replacement")
	}
	if got := js("mongo", snapshot); !bytes.Equal(got, before) {
		t.Fatal("failed archive dry-run removed destination state")
	}
	if output, err := restore(archive, true); err != nil {
		t.Fatalf("explicit Eidolon replacement failed: %v %s", err, output)
	}
	if got := js("mongo", snapshot); !bytes.Equal(got, want) {
		t.Fatal("explicit replacement retained later ledger or changed original private state/indexes")
	}
	js("mongo", `if(db.getSiblingDB("unrelated_fixture").sentinel.countDocuments({_id:"keep",value:43})!==1) quit(1);`)
	t.Log("fresh restore and scoped replacement preserve current schema marker, exact wallet/guild/rested/saved-instance metadata and indexes; refusal/preflight leave destination unchanged; unrelated database retained. Archive fidelity only, not actual game hydration or dungeon expiry/checkpoint acceptance")
}
