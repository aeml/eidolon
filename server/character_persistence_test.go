package main

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type testCharacterCommitter struct {
	fail  error
	saved *database.Character
	ids   []string
}

func (committer *testCharacterCommitter) CommitCharacterSave(_ string, character *database.Character, id string) error {
	committer.ids = append(committer.ids, id)
	if committer.fail != nil {
		return committer.fail
	}
	committer.saved = character
	return nil
}

func setupCharacterJournalTest(t *testing.T) (string, *testCharacterCommitter) {
	t.Helper()
	oldJournal, oldCommitter, oldWorld := characterSaveJournal, characterSaveCommitter, world
	oldFailures := failedCharacterSaves.users
	t.Cleanup(func() {
		characterSaveJournal, characterSaveCommitter, world = oldJournal, oldCommitter, oldWorld
		failedCharacterSaves.users = oldFailures
	})
	dir := filepath.Join(t.TempDir(), "journal")
	var err error
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	committer := &testCharacterCommitter{}
	characterSaveCommitter = committer
	failedCharacterSaves.users = make(map[string]bool)
	world = nil
	return dir, committer
}

func TestCharacterPersistenceDatabaseFailureSurvivesJournalReopen(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	character := &database.Character{Name: "hero", Gold: 1234, Level: 30,
		Resources: &database.CharacterResources{Version: 1, Health: 0, Mana: 0, Dead: true},
		Equipment: map[string]database.Item{"chest": {ID: "earned-chest", Stats: map[string]int{"vitality": 20}}}}
	committer.fail = errors.New("database unavailable")
	if err := persistCharacterSnapshot("hero", character); err == nil {
		t.Fatal("database failure hidden")
	}
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil {
		t.Fatal("failed commit lost durable snapshot")
	}
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	failedCharacterSaves.users = make(map[string]bool) // Simulate loss of process memory.
	committer.fail = nil
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(committer.saved, character) || committer.ids[1] != pending.SaveID {
		t.Fatal("recovery did not commit the exact complete pending snapshot and receipt")
	}
	if users, err := characterSaveJournal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("successful recovery not acknowledged")
	}
}

func TestCharacterPersistenceRetryPrefersNewerLiveSnapshot(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	committer.fail = errors.New("database unavailable")
	if err := persistCharacterSnapshot("hero", &database.Character{Name: "hero", Gold: 7,
		Resources: &database.CharacterResources{Version: 1, Health: 17, Mana: 70}}); err == nil {
		t.Fatal("expected failure")
	}
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 30,
		State: "DEAD", Health: 0, Mana: 0, Gold: 43,
		Equipment: map[string]game.Item{"chest": {ID: "upgraded-chest", Stats: map[string]int{"vitality": 25}}}}
	world.AddEntity(entity)
	committer.fail = nil
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Gold != 43 || committer.saved.Resources.Mana != 0 || !committer.saved.Resources.Dead ||
		committer.saved.Equipment["chest"].Stats["vitality"] != 25 || committer.ids[0] == committer.ids[1] {
		t.Fatal("retry replayed stale resources, gold or equipment over the live snapshot")
	}
}

func TestCharacterPersistenceUnwritableJournalPinsUntilDurable(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	entity := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Wizard", Level: 1,
		State: "IDLE", Health: 17, Mana: 0, Gold: 43}
	world.AddEntity(entity)
	world.SetEntityDisconnected(entity.ID, time.Now().Add(-10*time.Minute))
	// Rename the owned directory away. This is a real filesystem failure even
	// when tests run as root; permissions-only failure injection is unreliable.
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	if err := persistCharacterSnapshot("hero", characterSnapshot("hero", entity, time.Now())); err == nil {
		t.Fatal("unwritable journal accepted")
	}
	if len(committer.ids) != 0 {
		t.Fatal("database write attempted before durable journal")
	}
	if expired := world.CollectExpiredDisconnectedPlayers(5 * time.Minute); len(expired) != 0 {
		t.Fatal("last live copy expired after filesystem failure")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	committer.fail = errors.New("database still unavailable")
	if err := retryPendingCharacterSaves(); err == nil {
		t.Fatal("expected database failure")
	}
	if expired := world.CollectExpiredDisconnectedPlayers(5 * time.Minute); len(expired) != 1 {
		t.Fatal("durably journaled disconnected entity remained pinned")
	}
	committer.fail = nil
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Resources.Health != 17 || committer.saved.Resources.Mana != 0 || committer.saved.Gold != 43 {
		t.Fatal("expired entity's pending state lost")
	}
}

func TestCharacterPersistenceMissingLatestSaveRefusesStaleHydration(t *testing.T) {
	setupCharacterJournalTest(t)
	noteCharacterSaveFailure("hero", true)
	unlock := lockCharacterWork("hero")
	defer unlock()
	if err := retryPendingCharacterSaveLocked("hero"); err == nil {
		t.Fatal("missing latest save allowed stale hydration")
	}
}
