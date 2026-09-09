package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func resourceJournalIntegration(t *testing.T) (*database.DB, string, string) {
	t.Helper()
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires isolated loopback Mongo URI and absolute binary path")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Close(context.Background()) })
	return repo, uri, binary
}

func resourceJournalFixture(t *testing.T, repo *database.DB) (*database.Character, string) {
	t.Helper()
	name := fmt.Sprintf("resource-journal-%d", time.Now().UnixNano())
	password := name + "-prepared-only"
	character := &database.Character{Name: name, Class: "Wizard", Level: 30,
		ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200, Gold: 1234,
		LastDailyQuest: time.Now().Truncate(time.Millisecond),
		Stats:          database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
		Resources:      &database.CharacterResources{Version: 1, Health: 17, Mana: 100},
		Equipment: map[string]database.Item{"chest": {ID: "journal-chest", Name: "Journal Chest", Type: "ARMOR",
			Slot: "chest", Rarity: "RARE", Level: 1, Stack: 1, MaxStack: 1,
			StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{"intelligence": 20}}}}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFirstCharacter(name, character); err != nil {
		t.Fatal(err)
	}
	return character, password
}

// A real Mongo validator rejects production character writes while reads still
// work. Never enable this on a shared database: the opt-in URI must identify the
// owned disposable test Mongo. No test-only command is added to the game server.
func TestResourceActualRejectedSaveRecoversAfterRestart(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Disconnect(context.Background()) })
	setValidator := func(validator bson.M) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{
			{Key: "collMod", Value: "users"}, {Key: "validator", Value: validator},
			{Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"},
		}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	address, stop := compatStartServer(t, binary, uri, 30, "-save-journal-dir", dir)
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	beforeCast := townFixtureRead(t, connection, fixture, 0)
	resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
	var cast game.AbilityResult
	resourceReadMessage(t, connection, MsgAbilityResult, &cast)
	if !cast.Accepted {
		t.Fatalf("ordinary cast failed: %+v", cast)
	}
	afterCast := townFixtureRead(t, connection, fixture, 30)
	if cast.Mana < int(beforeCast.Mana)-30 || cast.Mana > int(afterCast.Mana) || cast.Mana+30 >= int(afterCast.MaxMana) {
		t.Fatalf("cast cost outside exact town recovery interval, or pre-cast cap invalidates oracle: %+v", cast)
	}
	setValidator(bson.M{"journal_fault_probe": bson.M{"$exists": true}})
	t.Cleanup(func() { setValidator(bson.M{}) })
	connection.Close()
	var pending *database.PendingCharacterSave
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		pending, err = journal.Read(fixture.Name)
		if err != nil {
			t.Fatal(err)
		}
		if pending != nil {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if pending == nil {
		t.Fatal("rejected disconnect save produced no durable journal")
	}
	stop() // Save retry also fails; normal process exit must retain the journal.
	before, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || before.Resources.Mana != 100 {
		t.Fatal("failure injection did not preserve the older database state")
	}
	pending, err = journal.Read(fixture.Name)
	if err != nil || pending == nil {
		t.Fatal("failed save lost on process exit")
	}
	expected, err := pending.Character()
	if err != nil || !reflect.DeepEqual(expected.Equipment, fixture.Equipment) {
		t.Fatal("pending snapshot did not capture cast/resources/equipment together")
	}
	assertTownFixtureSave(t, fixture, expected, 30)
	setValidator(bson.M{})
	address, stopRecovered := compatStartServer(t, binary, uri, 31, "-save-journal-dir", dir)
	defer stopRecovered()
	recovered, err := repo.GetCharacter(fixture.Name, fixture.Name)
	expected.LastSaveID = pending.SaveID
	if err != nil || !reflect.DeepEqual(recovered, expected) {
		t.Fatal("startup did not recover the exact complete durable snapshot before readiness")
	}
	if users, err := journal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("recovered snapshot not acknowledged")
	}
	connection = resourceOpenCharacter(t, address, fixture.Name, password)
	townFixtureProbe(t, connection, expected)
	final := resourceCloseAndWait(t, repo, connection, fixture.Name)
	assertTownFixtureSave(t, expected, final, 0)
	if final.Gold != 1234 || !reflect.DeepEqual(final.Equipment, fixture.Equipment) {
		t.Fatal("ordinary post-restart session changed recovered state")
	}
	t.Log("real Fireball/disconnect, rejected Mongo save, durable shutdown, new-process replay, ordinary login and exact resource/gear persistence passed")
}

// Simulates a crash after the database commit but before local acknowledgement.
// The unchanged receipt must prevent replay from overwriting later gold credits.
func TestResourceActualCommittedJournalReplayPreservesLaterCredit(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.Resources = &database.CharacterResources{Version: 1, Health: 0, Mana: 0, Dead: true}
	fixture.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 123.456789}
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := journal.Write(fixture.Name, fixture)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CommitCharacterSave(fixture.Name, fixture, pending.SaveID); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreditCharacterGold(fixture.Name, fixture.Name, 43); err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 32, "-save-journal-dir", dir)
	defer stop()
	expected, err := pending.Character()
	if err != nil {
		t.Fatal(err)
	}
	expected.LastSaveID, expected.Gold = pending.SaveID, 1277
	recovered, err := repo.GetCharacter(fixture.Name, fixture.Name)
	if err != nil || !reflect.DeepEqual(recovered, expected) {
		t.Fatal("committed journal replay overwrote later credit or unrelated state")
	}
	if users, err := journal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("duplicate committed journal not acknowledged")
	}
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	resourceProbe(t, connection, 0, true)
	final := resourceCloseAndWait(t, repo, connection, fixture.Name)
	if !reflect.DeepEqual(final.Resources, fixture.Resources) || !reflect.DeepEqual(final.WellRested, fixture.WellRested) || final.Gold != 1277 {
		t.Fatal("post-replay dead login lost resources/credit")
	}
	t.Log("already-committed receipt survives restart without losing later gold; ordinary dead/zero-mana login remains dead and empty")
}
