package database

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestCharacterJournalDurableDetachedLatestAndAcknowledgement(t *testing.T) {
	dir := t.TempDir()
	journal, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	character := &Character{Name: "hero", Level: 30, Gold: 1234,
		Resources: &CharacterResources{Version: 1, Health: 17, Mana: 0},
		Equipment: map[string]Item{"chest": {ID: "chest", Stats: map[string]int{"vitality": 20}}}}
	first, err := journal.Write("../hero", character)
	if err != nil {
		t.Fatal(err)
	}
	character.Resources.Mana = 99
	character.Equipment["chest"].Stats["vitality"] = 99
	reopened, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := reopened.Read("../hero")
	if err != nil {
		t.Fatal(err)
	}
	restored, err := pending.Character()
	if err != nil || restored.Resources.Mana != 0 || restored.Equipment["chest"].Stats["vitality"] != 20 {
		t.Fatal("journal did not retain detached complete save")
	}
	info, err := os.Stat(journal.filename("../hero"))
	if err != nil || info.Mode().Perm() != 0600 || filepath.Dir(journal.filename("../hero")) != dir {
		t.Fatal("journal file permissions/path are unsafe")
	}
	second, err := journal.Write("../hero", character)
	if err != nil {
		t.Fatal(err)
	}
	if second.SaveID == first.SaveID {
		t.Fatal("new save reused an identity")
	}
	if err := journal.Acknowledge("../hero", first.SaveID); err != nil {
		t.Fatal(err)
	}
	pending, err = journal.Read("../hero")
	if err != nil || pending == nil || pending.SaveID != second.SaveID {
		t.Fatal("old acknowledgement discarded newer pending state")
	}
	if err := journal.Acknowledge("../hero", second.SaveID); err != nil {
		t.Fatal(err)
	}
	if users, err := journal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("committed journal record was not removed")
	}
}

func TestCharacterJournalCorruptionFailsClosedWithoutRemovingEvidence(t *testing.T) {
	for _, kind := range []string{"truncated", "checksum", "future", "identity"} {
		t.Run(kind, func(t *testing.T) {
			journal, err := OpenCharacterSaveJournal(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			record, err := journal.Write("hero", &Character{Name: "hero"})
			if err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "checksum":
				record.Payload[0] ^= 1
			case "future":
				record.Version++
			case "identity":
				record.Username = "other"
			}
			encoded, err := bson.Marshal(record)
			if err != nil {
				t.Fatal(err)
			}
			if kind == "truncated" {
				encoded = encoded[:len(encoded)/2]
			}
			if err := os.WriteFile(journal.filename("hero"), encoded, 0600); err != nil {
				t.Fatal(err)
			}
			if _, err := journal.PendingUsers(); err == nil {
				t.Fatal("corrupt journal accepted")
			}
			if err := journal.Acknowledge("hero", record.SaveID); err == nil {
				t.Fatal("corrupt journal silently acknowledged")
			}
			actual, err := os.ReadFile(journal.filename("hero"))
			if err != nil || !reflect.DeepEqual(actual, encoded) {
				t.Fatal("corrupt evidence changed")
			}
		})
	}
}

func TestCharacterJournalWriteFailurePreservesPreviousSave(t *testing.T) {
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := journal.Write("hero", &Character{Name: "hero", Gold: 7})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := journal.Write("hero", nil); err == nil {
		t.Fatal("invalid save accepted")
	}
	actual, err := journal.Read("hero")
	if err != nil || actual.SaveID != saved.SaveID {
		t.Fatal("failed write lost previous durable save")
	}
}
