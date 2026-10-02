package database

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestGuildClearJournalSharesCharacterVolumeAcrossRestart(t *testing.T) {
	dir := t.TempDir()
	characters, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := characters.Write("hero", &Character{Name: "hero", Gold: 99}); err != nil {
		t.Fatal(err)
	}
	guilds, err := OpenGuildClearJournal(filepath.Join(dir, "guild-clears"))
	if err != nil {
		t.Fatal(err)
	}
	if err := guilds.Write(guildClearJournalFixture("volume-clear")); err != nil {
		t.Fatal(err)
	}
	characters, err = OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	if users, err := characters.PendingUsers(); err != nil || !reflect.DeepEqual(users, []string{"hero"}) {
		t.Fatal("sibling guild journal blocked character recovery", users, err)
	}
	guilds, err = OpenGuildClearJournal(filepath.Join(dir, "guild-clears"))
	if err != nil {
		t.Fatal(err)
	}
	if entries, err := guilds.Pending(1); err != nil || len(entries) != 1 {
		t.Fatal("restart lost independent guild receipts", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "guild-clears", "corrupt.json"), []byte("corrupt"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := guilds.Pending(100); err == nil {
		t.Fatal("delegated reader ignored corruption")
	}
}
