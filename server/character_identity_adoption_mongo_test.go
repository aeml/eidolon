package main

import (
	"context"
	"os"
	"regexp"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestCharacterBoundProductionMongoLiveOfflineAndRestartReplay(t *testing.T) {
	uri := os.Getenv("EIDOLON_OWNER_EXPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable producer Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("explicit disposable loopback Mongo required")
	}
	strictCharacterIdentityFixture(t)
	journalDir := t.TempDir()
	var err error
	characterSaveJournal, err = database.OpenCharacterSaveJournal(journalDir)
	if err != nil {
		t.Fatal(err)
	}
	store, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close(context.Background()) })
	characterSaveCommitter = store
	owner := "codex-binding-" + primitive.NewObjectID().Hex()
	if err := store.CreateUser(owner, "synthetic@example.invalid", "synthetic disposable proof"); err != nil {
		t.Fatal(err)
	}
	user, err := store.GetUser(owner)
	if err != nil || user.ID.IsZero() {
		t.Fatal("missing real account identity", err)
	}
	initial := newPlayerCharacter(owner, "Wizard")
	initial.AccountID = user.ID
	if err := store.CreateCharacter(owner, initial); err != nil {
		t.Fatal(err)
	}
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-" + owner, Name: owner, Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		PersistenceAccountID: user.ID, Gold: 123, EP: 7, Health: 20, MaxHealth: 200}
	world.AddEntity(entity)
	if err := saveCharacterDB(&Client{username: owner, playerID: entity.ID}, world.GetEntityCopy(entity.ID)); err != nil {
		t.Fatal("normal live save failed", err)
	}
	world = nil // Offline recipient now has no competing authoritative live copy.
	loaded, err := store.GetCharacter(owner, owner)
	if err != nil || loaded.AccountID != user.ID || loaded.Gold != 123 || loaded.EP != 7 {
		t.Fatal("live save/reload lost identity/value", err)
	}
	loaded.Gold += 17
	if err := persistCharacterSnapshot(owner, loaded); err != nil {
		t.Fatal("offline producer failed", err)
	}
	loaded, err = store.GetCharacter(owner, owner)
	if err != nil || loaded.Gold != 140 {
		t.Fatal("offline outcome not durable", err)
	}
	loaded.Gold += 20
	pending, err := journalCharacterSnapshot(owner, loaded)
	if err != nil || pending.Version != 2 || pending.AccountID != user.ID {
		t.Fatal("offline outage snapshot unbound", err)
	}
	// Simulated process-memory loss with a real reopened file and real Mongo
	// commit/receipt, not a synthetic success response or a long game replay.
	characterSaveJournal, err = database.OpenCharacterSaveJournal(journalDir)
	if err != nil {
		t.Fatal(err)
	}
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal("bound startup replay failed", err)
	}
	loaded, err = store.GetCharacter(owner, owner)
	if err != nil || loaded.AccountID != user.ID || loaded.Gold != 160 || loaded.EP != 7 || loaded.LastSaveID != pending.SaveID {
		t.Fatal("restart lost exact bound outcome", err)
	}
	if users, err := characterSaveJournal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("confirmed bound file retained", err)
	}
}
