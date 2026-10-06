package database

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestCharacterJournalReadOnlyPreflight(t *testing.T) {
	for _, kind := range []string{"missing", "bound", "legacy", "corrupt", "symlink", "file", "empty-path"} {
		t.Run(kind, func(t *testing.T) {
			dir, path, wantSuccess := journalPreflightFixture(t, kind)
			var before []byte
			if path != "" {
				before, _ = os.ReadFile(path)
			}
			if err := CheckAccountBoundCharacterSaveJournal(dir); (err == nil) != wantSuccess {
				t.Fatalf("preflight %s success=%v err=%v", kind, wantSuccess, err)
			}
			if path != "" {
				after, err := os.ReadFile(path)
				if err != nil || string(before) != string(after) {
					t.Fatal("read-only preflight changed retained snapshot", err)
				}
			}
			if kind == "missing" {
				if _, err := os.Stat(dir); !os.IsNotExist(err) {
					t.Fatal("preflight created a missing journal directory", err)
				}
			}
		})
	}
}

func journalPreflightFixture(t *testing.T, kind string) (dir, path string, success bool) {
	t.Helper()
	dir = filepath.Join(t.TempDir(), "journal")
	if kind == "missing" {
		return dir, "", true
	}
	if kind == "empty-path" {
		return "", "", false
	}
	if kind == "symlink" {
		if err := os.Symlink(t.TempDir(), dir); err != nil {
			t.Fatal(err)
		}
		return dir, "", false
	}
	if kind == "file" {
		if err := os.WriteFile(dir, []byte("not a directory"), 0600); err != nil {
			t.Fatal(err)
		}
		return dir, dir, false
	}
	journal, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	character := &Character{Name: "synthetic-hero", Gold: 175}
	if kind == "bound" {
		_, err = journal.WriteForAccount(primitive.NewObjectID(), "synthetic-owner", character)
	} else {
		_, err = journal.Write("synthetic-owner", character)
	}
	if err != nil {
		t.Fatal(err)
	}
	path = journal.filename("synthetic-owner")
	if kind == "corrupt" {
		if err := os.WriteFile(path, []byte("corrupt retained evidence"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	return dir, path, kind == "bound"
}

func TestCharacterJournalPreflightActualBinary(t *testing.T) {
	binary := os.Getenv("EIDOLON_SCHEMA_BINARY")
	if binary == "" {
		t.Skip("requires an explicitly prepared server binary")
	}
	if !filepath.IsAbs(binary) {
		t.Fatal("requires an absolute binary path")
	}
	for _, kind := range []string{"missing", "bound", "legacy", "corrupt", "symlink", "file", "empty-path", "both-flags"} {
		t.Run(kind, func(t *testing.T) {
			fixtureKind := kind
			if kind == "both-flags" {
				fixtureKind = "bound"
			}
			dir, path, wantSuccess := journalPreflightFixture(t, fixtureKind)
			var before []byte
			if path != "" {
				before, _ = os.ReadFile(path)
			}
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			args := []string{"--check-save-journal", "--save-journal-dir=" + dir, "--mongo-uri=not-a-valid-uri"}
			if kind == "both-flags" {
				args = append(args, "--check-schema")
				wantSuccess = false
			}
			command := exec.CommandContext(ctx, binary, args...)
			command.Dir = t.TempDir()
			output, err := command.CombinedOutput()
			if (err == nil) != wantSuccess || ctx.Err() != nil {
				t.Fatalf("CLI preflight %s: %v output=%s", kind, err, output)
			}
			if wantSuccess && !strings.HasPrefix(string(output), "Character journal preflight passed: supported=2 commit=") {
				t.Fatal("missing bounded release receipt", string(output))
			}
			files, readErr := os.ReadDir(command.Dir)
			if readErr != nil || len(files) != 0 || strings.Contains(string(output), "Server started") || strings.Contains(string(output), "synthetic-owner") {
				t.Fatal("preflight created logs/admission or disclosed fixture data", readErr, string(output))
			}
			if path != "" {
				after, readErr := os.ReadFile(path)
				if readErr != nil || string(before) != string(after) {
					t.Fatal("CLI changed retained snapshot", readErr)
				}
			}
			if kind == "missing" {
				if _, err := os.Stat(dir); !os.IsNotExist(err) {
					t.Fatal("CLI created missing journal", err)
				}
			}
		})
	}
}
