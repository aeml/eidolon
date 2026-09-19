package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAdminActivityJournalDurableReplayAndPrivateExpiration(t *testing.T) {
	dir := t.TempDir()
	journal, err := OpenAdminActivityJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	event, _ := NewAdminActivity("operator", "", "login", "session-request", "success", "Account authenticated by login.", time.Now(), 90)
	if err := journal.Write(event); err != nil {
		t.Fatal(err)
	}
	if err := journal.Write(event); err != nil {
		t.Fatal("identical retry", err)
	}
	conflict := event
	conflict.Summary = "Conflicting outcome"
	if journal.Write(conflict) == nil {
		t.Fatal("immutable event replaced")
	}
	reopened, _ := OpenAdminActivityJournal(dir)
	pending, err := reopened.Pending(50)
	if err != nil || len(pending) != 1 || pending[0].ID != event.ID || !pending[0].ExpiresAt.Equal(event.ExpiresAt) {
		t.Fatal(pending, err)
	}
	info, err := os.Stat(filepath.Join(dir, event.ID.Hex()+".json"))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal(info, err)
	}
	if err := reopened.Acknowledge(event.ID); err != nil {
		t.Fatal(err)
	}
	if err := reopened.Acknowledge(event.ID); err != nil {
		t.Fatal("idempotent acknowledgement", err)
	}
	if events, err := reopened.Pending(50); err != nil || len(events) != 0 {
		t.Fatal(events, err)
	}
}

func TestAdminActivityJournalCorruptionAndBatchBounds(t *testing.T) {
	dir := t.TempDir()
	journal, _ := OpenAdminActivityJournal(dir)
	for index := 0; index < 3; index++ {
		event, _ := NewAdminActivity("operator", "", "disconnect", "session-request", "success", "Authenticated connection ended.", time.Now(), 90)
		if err := journal.Write(event); err != nil {
			t.Fatal(err)
		}
	}
	if batch, err := journal.Pending(2); err != nil || len(batch) != 2 {
		t.Fatal(batch, err)
	}
	if _, err := journal.Pending(101); err == nil {
		t.Fatal("unbounded batch")
	}
	entries, _ := os.ReadDir(dir)
	name := filepath.Join(dir, entries[0].Name())
	data, _ := os.ReadFile(name)
	// Keep valid JSON but change the checksum, which must never be replayed.
	text := strings.Replace(string(data), `"checksum":"`, `"checksum":"0`, 1)
	if err := os.WriteFile(name, []byte(text), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := journal.Pending(50); err == nil {
		t.Fatal("corrupt event accepted")
	}
	if _, err := os.Stat(name); err != nil {
		t.Fatal("corrupt evidence removed", err)
	}
}

func TestAdminActivityAndCharacterJournalsShareVolume(t *testing.T) {
	dir := t.TempDir()
	characters, _ := OpenCharacterSaveJournal(dir)
	activity, _ := OpenAdminActivityJournal(filepath.Join(dir, "admin-activity"))
	if _, err := characters.Write("hero", &Character{Name: "hero", Class: "Fighter"}); err != nil {
		t.Fatal(err)
	}
	event, _ := NewAdminActivity("hero", "", "login", "session-request", "success", "Account authenticated.", time.Now(), 90)
	if err := activity.Write(event); err != nil {
		t.Fatal(err)
	}
	if users, err := characters.PendingUsers(); err != nil || len(users) != 1 || users[0] != "hero" {
		t.Fatal(users, err)
	}
	for _, mode := range []string{"file", "symlink"} {
		t.Run(mode, func(t *testing.T) {
			other := t.TempDir()
			j, _ := OpenCharacterSaveJournal(other)
			path := filepath.Join(other, "admin-activity")
			var err error
			if mode == "file" {
				err = os.WriteFile(path, []byte("impostor"), 0600)
			} else {
				err = os.Symlink(filepath.Join(dir, "admin-activity"), path)
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err := j.PendingUsers(); err == nil {
				t.Fatal("impostor activity journal was delegated")
			}
		})
	}
}
