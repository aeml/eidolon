package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// The parent launcher owns both capped containers, including cleanup if this
// test process is interrupted. An archive can never target a shared database.
func gameplaySnapshotContainer(t *testing.T, name, uri, prefix string) {
	t.Helper()
	if !regexp.MustCompile("^"+prefix+"[a-f0-9]{12}$").MatchString(name) ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("snapshot requires the launcher's paired disposable loopback Mongo containers")
	}
	parsed, err := url.Parse(uri)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	data, err := exec.CommandContext(ctx, "docker", "inspect", "--format", "{{json .}}", name).Output()
	var container struct {
		Name       string
		State      struct{ Running bool }
		HostConfig struct {
			NetworkMode string
			NanoCPUs    int64
			Memory      int64
		}
		Config struct {
			Image string
			Cmd   []string
		}
	}
	if err != nil || json.Unmarshal(data, &container) != nil || container.Name != "/"+name || !container.State.Running ||
		container.Config.Image != "mongo:7.0.14" || container.HostConfig.NetworkMode != "host" ||
		container.HostConfig.NanoCPUs <= 0 || container.HostConfig.NanoCPUs > 1e9 ||
		container.HostConfig.Memory <= 0 || container.HostConfig.Memory > 512<<20 ||
		!reflect.DeepEqual(container.Config.Cmd, []string{"--bind_ip", "127.0.0.1", "--port", parsed.Port()}) {
		t.Fatal("snapshot container ownership, loopback binding or resource limits do not match")
	}
}

func gameplayCopyStoppedJournal(t *testing.T, source, destination string) map[string]string {
	t.Helper()
	if err := os.Mkdir(destination, 0700); err != nil {
		t.Fatal(err)
	}
	manifest := map[string]string{}
	var total int64
	err := filepath.WalkDir(source, func(name string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, err := filepath.Rel(source, name)
		if err != nil || relative == "." {
			return err
		}
		target := filepath.Join(destination, relative)
		if entry.IsDir() {
			return os.Mkdir(target, 0700)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() || info.Size() > 16<<20 || total+info.Size() > 32<<20 {
			return fmt.Errorf("unexpected stopped-journal entry %s", relative)
		}
		data, err := os.ReadFile(name)
		if err != nil {
			return err
		}
		total += int64(len(data))
		if err := os.WriteFile(target, data, 0600); err != nil {
			return err
		}
		manifest[relative] = fmt.Sprintf("%x", sha256.Sum256(data))
		return nil
	})
	if err != nil {
		t.Fatal("stopped private journal copy", err)
	}
	return manifest
}

func TestGameplayActualRoofSnapshotRestoresPlayableCustody(t *testing.T) {
	if os.Getenv("EIDOLON_GAMEPLAY_SNAPSHOT_SOURCE_CONTAINER") == "" {
		t.Skip("requires paired explicitly disposable snapshot/restore Mongo containers")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	sourceContainer, restoreContainer := os.Getenv("EIDOLON_GAMEPLAY_SNAPSHOT_SOURCE_CONTAINER"), os.Getenv("EIDOLON_GAMEPLAY_SNAPSHOT_RESTORE_CONTAINER")
	restoreURI := os.Getenv("EIDOLON_GAMEPLAY_SNAPSHOT_RESTORE_URI")
	gameplaySnapshotContainer(t, sourceContainer, uri, "eidolon-gameplay-session-")
	gameplaySnapshotContainer(t, restoreContainer, restoreURI, "eidolon-gameplay-restore-")
	if uri == restoreURI || strings.TrimPrefix(sourceContainer, "eidolon-gameplay-session-") != strings.TrimPrefix(restoreContainer, "eidolon-gameplay-restore-") {
		t.Fatal("snapshot requires one distinct owned pair from the same launcher")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 45*time.Second)
	defer cancel()
	run := func(container string, input io.Reader, args ...string) []byte {
		t.Helper()
		command := exec.CommandContext(ctx, "docker", append([]string{"exec", "-i", container}, args...)...)
		command.Stdin = input
		var diagnostics bytes.Buffer
		command.Stderr = &diagnostics
		data, err := command.Output() // Never mix archive stdout with diagnostics.
		if err != nil {
			t.Fatalf("owned snapshot tool failed: %v %s", err, diagnostics.Bytes())
		}
		return data
	}
	port := func(uri string) string { parsed, _ := url.Parse(uri); return parsed.Port() }
	// No real accounts or previously initialized target may enter this rehearsal.
	run(sourceContainer, nil, "mongosh", "--quiet", "--port", port(uri), "--eval",
		`if(db.getSiblingDB('eidolon').users.countDocuments({username:{$not:/^resource-journal-[0-9]+$/}})!==0) quit(1);`)
	run(restoreContainer, nil, "mongosh", "--quiet", "--port", port(restoreURI), "--eval",
		`if(db.getSiblingDB('eidolon').getCollectionNames().length!==0) quit(1);`)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.Class, fixture.X, fixture.Y, fixture.Z = "Fighter", -74, 8.78, 130
	item := database.Item{ID: "roof-snapshot-" + fixture.Name, Name: "Retained snapshot blade", Type: "WEAPON",
		Level: 30, Rarity: string(game.RarityRare), Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion,
		Stats: map[string]int{"strength": 7}}
	fixture.Inventory = []database.Item{item}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 747, "-save-journal-dir", journal)
	conn, observation := gameplayJoin(t, address, fixture, password)
	roof := observation.self.SupportSurface
	if roof == "" || math.Abs(float64(observation.self.Y)-fixture.Y) > .001 {
		t.Fatal("source snapshot character lacks the actual authored roof floor")
	}
	quantity := 1
	resourceSend(t, conn, MsgInventoryDrop, InventoryDropPayload{Index: 0, ItemID: item.ID, ExpectedStack: &quantity})
	gameplayWait(t, conn, fixture.Name, observation, func() bool { return observation.message == MsgInventory })
	_ = conn.Close()
	stop() // Snapshot only after the owned production writer drains its saves.
	saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil {
		t.Fatal("source saved character", err)
	}
	projection, err := repo.GroundItemProjectionPage("", time.Now(), 50)
	if err != nil {
		t.Fatal(err)
	}
	var sourceRecord *database.GroundItemRecord
	for index := range projection {
		if projection[index].Username == fixture.Name {
			sourceRecord = &projection[index]
		}
	}
	if sourceRecord == nil || sourceRecord.Version != 3 || sourceRecord.Kind != database.GroundItemDrop || sourceRecord.Generation != 0 || sourceRecord.State != database.GroundItemComplete || sourceRecord.SupportSurface != roof {
		t.Fatal("snapshot lacks the saved version3 roof drop")
	}
	// Private account archives stay outside the workspace and uploaded evidence.
	private, err := os.MkdirTemp("", "eidolon-roof-snapshot-")
	if err != nil {
		t.Fatal(err)
	}
	dump := run(sourceContainer, nil, "mongodump", "--uri", uri, "--db", "eidolon", "--archive", "--gzip")
	if len(dump) == 0 || len(dump) > 32<<20 {
		t.Fatal("unexpected private snapshot size")
	}
	if err := os.WriteFile(filepath.Join(private, "mongo.archive.gz"), dump, 0600); err != nil {
		t.Fatal(err)
	}
	journalManifest := gameplayCopyStoppedJournal(t, journal, filepath.Join(private, "saved-journal"))
	if restoredManifest := gameplayCopyStoppedJournal(t, filepath.Join(private, "saved-journal"), filepath.Join(private, "restored-journal")); !reflect.DeepEqual(restoredManifest, journalManifest) {
		t.Fatal("journal restore changed stopped private bytes")
	}
	run(restoreContainer, bytes.NewReader(dump), "mongorestore", "--uri", restoreURI, "--archive", "--gzip", "--nsInclude=eidolon.*", "--stopOnError")
	restored, err := database.New(restoreURI)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { restored.Close(context.Background()) })
	character, err := restored.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || !reflect.DeepEqual(character, saved) {
		t.Fatal("archive changed the saved character, floor, wallet or private checkpoints", err)
	}
	record, err := restored.LatestGroundItemOperation(sourceRecord.LootID)
	if err != nil || !reflect.DeepEqual(record, sourceRecord) {
		t.Fatal("archive changed immutable roof custody or its original lifetime", err)
	}
	address, stop = compatStartServer(t, binary, restoreURI, 748, "-save-journal-dir", filepath.Join(private, "restored-journal"))
	conn, observation = gameplayJoin(t, address, fixture, password)
	loot := observation.entities[sourceRecord.LootID]
	if observation.self.SupportSurface != roof || math.Abs(float64(observation.self.Y)-fixture.Y) > .001 ||
		loot == nil || loot.SupportSurface != roof || math.Abs(float64(loot.Y)-fixture.Y-.5) > .001 {
		t.Fatal("restored normal first scene lost the player or ground item's roof floor")
	}
	resourceSend(t, conn, MsgPickup, PickupPayload{LootID: sourceRecord.LootID})
	gameplayWait(t, conn, fixture.Name, observation, func() bool { return observation.message == MsgInventory })
	_ = conn.Close()
	stop()
	character, err = restored.GetCharacter(fixture.Name, fixture.Name)
	pickup, pickupErr := restored.LatestGroundItemOperation(sourceRecord.LootID)
	if err != nil || pickupErr != nil || character == nil || pickup == nil {
		t.Fatal("restored ordinary pickup missing saved custody", err, pickupErr)
	}
	checks := map[string]bool{
		"completed":      pickup.State == database.GroundItemComplete,
		"generation":     pickup.Generation == sourceRecord.Generation+1,
		"accountOrdinal": pickup.AccountOrdinal == saved.GroundAccountOrdinal+1,
		"groundConsumed": pickup.GroundPayload() == "",
		"receipt":        database.GroundItemCharacterReceiptMatches(character, pickup.GroundItemOperation),
		"availableAt":    pickup.AvailableAt.Equal(sourceRecord.AvailableAt),
		"expiresAt":      pickup.ExpiresAt.Equal(sourceRecord.ExpiresAt),
		"gold":           character.Gold == saved.Gold, "EP": character.EP == saved.EP,
		"class": character.Class == saved.Class, "level": character.Level == saved.Level,
		"XP": character.XP == saved.XP, "progression": character.ProgressionVersion == saved.ProgressionVersion,
		"stats":     reflect.DeepEqual(character.Stats, saved.Stats),
		"equipment": reflect.DeepEqual(character.Equipment, saved.Equipment),
		"roofY":     math.Abs(character.Y-fixture.Y) <= .001,
	}
	for field, equal := range checks {
		if !equal {
			t.Errorf("restored ordinary pickup changed %s", field)
		}
	}
	if t.Failed() {
		t.FailNow()
	}
	count := 0
	for _, owned := range character.Inventory {
		if owned.ID == item.ID {
			count++
			if !reflect.DeepEqual(owned, item) {
				t.Fatal("restored pickup changed exact item metadata")
			}
		}
	}
	unchanged, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if count != 1 || err != nil || !reflect.DeepEqual(unchanged, saved) {
		t.Fatal("restored pickup duplicated/lost the item or modified the source database", err)
	}
	t.Logf("PRIVATE_ROOF_SNAPSHOT=%s archive_bytes=%d archive_sha256=%x journal_files=%d; actual schema%d archive/journal restore and ordinary login/roof pickup preserve exact custody and original expiry; source database unchanged; prepared fixture, not production backup/RPO acceptance", private, len(dump), sha256.Sum256(dump), len(journalManifest), database.CurrentSchemaVersion)
}
