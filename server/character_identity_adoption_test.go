package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func strictCharacterIdentityFixture(t *testing.T) *identityCommitter {
	t.Helper()
	_, base := setupCharacterJournalTest(t)
	old := requireBoundCharacterSaves
	requireBoundCharacterSaves = true
	t.Cleanup(func() { requireBoundCharacterSaves = old })
	c := &identityCommitter{testCharacterCommitter: base}
	characterSaveCommitter = c
	return c
}

func TestCharacterBoundNormalProducerAndDetachedSnapshot(t *testing.T) {
	c := strictCharacterIdentityFixture(t)
	a := primitive.NewObjectID()
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-owner", Name: "owner", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		PersistenceAccountID: a, Gold: 123, EP: 7, Health: 20, MaxHealth: 200}
	world.AddEntity(entity)
	copy := world.GetEntityCopy(entity.ID)
	if copy == nil || copy.PersistenceAccountID != a {
		t.Fatal("detached snapshot lost account identity")
	}
	character := characterSnapshot("owner", copy, time.Now())
	if character.AccountID != a {
		t.Fatal("save projection lost identity")
	}
	encoded, err := bson.Marshal(character)
	if err != nil {
		t.Fatal(err)
	}
	if bson.Raw(encoded).Lookup("account_id").Type != 0 || bson.Raw(encoded).Lookup("AccountID").Type != 0 {
		t.Fatal("transient identity stored in embedded character")
	}
	for _, value := range []any{copy, character} {
		encoded, err := json.Marshal(value)
		if err != nil || strings.Contains(string(encoded), a.Hex()) || strings.Contains(string(encoded), "PersistenceAccountID") || strings.Contains(string(encoded), "AccountID") {
			t.Fatal("private persistence identity exposed", err)
		}
	}
	c.failBound = errors.New("database unavailable")
	if err := saveCharacterDB(&Client{username: "owner", playerID: entity.ID}, copy); err == nil {
		t.Fatal("failure hidden")
	}
	pending, err := characterSaveJournal.Read("owner")
	if err != nil || pending == nil || pending.Version != 2 || pending.AccountID != a {
		t.Fatal("normal producer wrote unbound snapshot", err)
	}
	c.failBound = nil
	if err := retryPendingCharacterSaves(); err != nil || c.saved.AccountID != a || c.saved.Gold != 123 || c.saved.EP != 7 {
		t.Fatal("newer live retry lost identity/outcome", err)
	}
	if err := persistCharacterSnapshot("missing", &database.Character{Name: "hero"}); err == nil {
		t.Fatal("production admitted unbound offline snapshot")
	}
	if pending, err := characterSaveJournal.Read("missing"); err != nil || pending != nil {
		t.Fatal("unbound production write left admitted journal", err)
	}
}

func TestCharacterBoundStartupRefusesLegacyWithoutDatabaseOrFileMutation(t *testing.T) {
	c := strictCharacterIdentityFixture(t)
	legacy, err := characterSaveJournal.Write("owner", &database.Character{Name: "hero", Gold: 999})
	if err != nil {
		t.Fatal(err)
	}
	before, _ := bson.Marshal(legacy)
	if err := retryPendingCharacterSaves(); err == nil || c.boundCalls != 0 || len(c.ids) != 0 {
		t.Fatal("legacy startup rebound/replayed without reviewed transition")
	}
	after, err := characterSaveJournal.Read("owner")
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := bson.Marshal(after)
	if sha256.Sum256(before) != sha256.Sum256(encoded) {
		t.Fatal("legacy refusal changed pending evidence")
	}
}

func TestCharacterBoundShutdownJournalsAllBeforeDatabase(t *testing.T) {
	strictCharacterIdentityFixture(t)
	c := &shutdownJournalOrderCommitter{t: t}
	characterSaveCommitter = c
	world = game.NewWorld(nil)
	for _, user := range []string{"a", "b", "c", "d", "e", "f", "g", "h"} {
		world.AddEntity(&game.Entity{ID: "player-" + user, Type: game.TypePlayer, SubType: "Wizard", Level: 1, PersistenceAccountID: primitive.NewObjectID()})
	}
	if err := saveFinalCharacters(); err != nil || c.calls != 1 {
		t.Fatal("journal-first shutdown changed", err)
	}
	for _, user := range []string{"a", "b", "c", "d", "e", "f", "g", "h"} {
		pending, err := characterSaveJournal.Read(user)
		if err != nil || pending == nil || pending.Version != 2 || pending.AccountID.IsZero() {
			t.Fatal("shutdown emitted legacy record", user, err)
		}
	}
}
