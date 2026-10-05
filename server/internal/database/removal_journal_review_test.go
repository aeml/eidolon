package database

import (
	"crypto/sha256"
	"os"
	"path/filepath"
	"testing"
)

func TestRemovalJournalObservationDoesNotReadReplayAcknowledgeOrDelete(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if present, err := journal.HasPendingAccountSave("../owner"); err != nil || present {
		t.Fatal("invented pending save", err)
	}
	save, err := journal.Write("../owner", &Character{Name: "owner", Gold: 123, EP: 7})
	if err != nil {
		t.Fatal(err)
	}
	path := journal.filename("../owner")
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if present, err := journal.HasPendingAccountSave("../owner"); err != nil || !present {
		t.Fatal("own pending save not observed", err)
	}
	after, err := os.ReadFile(path)
	if err != nil || sha256.Sum256(after) != sha256.Sum256(before) {
		t.Fatal("observation changed character snapshot")
	}
	pending, err := journal.Read("../owner")
	if err != nil || pending == nil || pending.SaveID != save.SaveID {
		t.Fatal("pending replay identity discarded")
	}
	// A link cannot certify presence or inspect another account's character.
	if err := os.Symlink(path, journal.filename("linked")); err != nil {
		t.Fatal(err)
	}
	if _, err := journal.HasPendingAccountSave("linked"); err == nil {
		t.Fatal("linked pending state accepted")
	}
	if err := os.Mkdir(journal.filename("directory"), 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := journal.HasPendingAccountSave("directory"); err == nil {
		t.Fatal("directory accepted as save")
	}
	if _, err := (&CharacterSaveJournal{dir: filepath.Join(t.TempDir(), "missing")}).HasPendingAccountSave("owner"); err == nil {
		t.Fatal("missing journal mount certified as no pending save")
	}
}
