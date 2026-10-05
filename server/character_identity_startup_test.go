package main

import (
	"context"
	"crypto/sha256"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestCharacterBoundActualStartupLegacyRefusal(t *testing.T) {
	binary := os.Getenv("EIDOLON_RESOURCE_BINARY")
	if binary == "" {
		t.Skip("explicit current server binary required")
	}
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := journal.Write("synthetic-legacy", &database.Character{Name: "hero", Gold: 123, EP: 7}); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 {
		t.Fatal("fixture not isolated", err)
	}
	path := filepath.Join(dir, entries[0].Name())
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	// Invalid URI makes the error precedence independent of a reachable Mongo:
	// contacting/initializing it first would yield a different fatal message.
	command := exec.CommandContext(ctx, binary, "--save-journal-dir="+dir,
		"--mongo-uri=invalid://must-not-contact", "--log-file=", "--suspicious-log-file=", "--economy-metrics-file=")
	output, err := command.CombinedOutput()
	if err == nil || ctx.Err() != nil || !strings.Contains(string(output), "Character journal transition required; files preserved") {
		t.Fatal("actual startup did not refuse legacy before database initialization", err, string(output))
	}
	after, err := os.ReadFile(path)
	if err != nil || sha256.Sum256(before) != sha256.Sum256(after) {
		t.Fatal("startup destroyed or rebound legacy evidence", err)
	}
}
