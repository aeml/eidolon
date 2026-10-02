package database

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func guildClearJournalFixture(id string) GuildClearReceipt {
	at := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	return GuildClearReceipt{InstanceID: id, Runs: []GuildDungeonRun{{
		GuildID: "guild-fixture", GuildName: "Fixture Watch", GuildTag: "TEST", Season: CurrentGuildDungeonSeason(at),
		DungeonType: "verdant_bastion_catacombs", Difficulty: "normal", RunLevel: 30,
		DurationMS: 120000, MemberCount: 4, FirstClearAt: at,
	}}}
}

func TestGuildClearJournalRestartImmutableIdentityAndPrivateFiles(t *testing.T) {
	dir := t.TempDir()
	j, err := OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	receipt := guildClearJournalFixture("../completed-instance")
	if err := j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err := j.Write(receipt); err != nil {
		t.Fatal("identical retry failed", err)
	}
	info, err := os.Stat(j.filename(receipt.InstanceID))
	if err != nil || info.Mode().Perm() != 0600 || filepath.Dir(j.filename(receipt.InstanceID)) != dir {
		t.Fatal("unsafe guild clear file", err)
	}
	reopened, err := OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := reopened.Pending(1)
	if err != nil || len(entries) != 1 || !reflect.DeepEqual(entries[0], receipt) {
		t.Fatal("restart lost detached clear", entries, err)
	}
	receipt.Runs[0].DurationMS++
	if err := reopened.Write(receipt); err == nil {
		t.Fatal("same instance overwrote its original result")
	}
	if err := reopened.Acknowledge(receipt.InstanceID); err != nil {
		t.Fatal(err)
	}
	if err := reopened.Acknowledge(receipt.InstanceID); err != nil {
		t.Fatal("repeat acknowledgement failed", err)
	}
	if entries, err := reopened.Pending(1); err != nil || len(entries) != 0 {
		t.Fatal("acknowledged clear remains", err)
	}
}

func TestGuildClearJournalBoundedDrainAndInputValidation(t *testing.T) {
	j, err := OpenGuildClearJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, limit := range []int{-1, 0, 101} {
		if _, err := j.Pending(limit); err == nil {
			t.Fatal("invalid batch accepted")
		}
	}
	for _, kind := range []string{"empty", "season", "duplicate", "solo", "difficulty", "too-many", "oversized-identity", "too-many-members", "different-run"} {
		receipt := guildClearJournalFixture(kind)
		switch kind {
		case "empty":
			receipt.Runs = nil
		case "season":
			receipt.Runs[0].Season = "2026-Q4"
		case "duplicate":
			receipt.Runs = append(receipt.Runs, receipt.Runs[0])
		case "solo":
			receipt.Runs[0].MemberCount = 1
		case "difficulty":
			receipt.Runs[0].Difficulty = "forged"
		case "too-many":
			for len(receipt.Runs) < 6 {
				receipt.Runs = append(receipt.Runs, receipt.Runs[0])
			}
		case "oversized-identity":
			receipt.InstanceID = strings.Repeat("x", 161)
		case "too-many-members", "different-run":
			other := receipt.Runs[0]
			other.GuildID = "other-guild"
			if kind == "too-many-members" {
				other.MemberCount = 8
			} else {
				other.DurationMS++
			}
			receipt.Runs = append(receipt.Runs, other)
		}
		if err := j.Write(receipt); err == nil {
			t.Fatal("invalid receipt accepted", kind)
		}
	}
	const count = 43
	for i := range count {
		if err := j.Write(guildClearJournalFixture(fmt.Sprintf("clear-%d", i))); err != nil {
			t.Fatal(err)
		}
	}
	seen := make(map[string]bool)
	for range count {
		entries, err := j.Pending(3)
		if err != nil || len(entries) > 3 {
			t.Fatal("batch failed or exceeded its limit", err)
		}
		if len(entries) == 0 {
			break
		}
		for _, receipt := range entries {
			if seen[receipt.InstanceID] {
				t.Fatal("acknowledged clear returned again")
			}
			seen[receipt.InstanceID] = true
			if err := j.Acknowledge(receipt.InstanceID); err != nil {
				t.Fatal(err)
			}
		}
	}
	if len(seen) != count {
		t.Fatal("bounded drain lost results", len(seen))
	}
}

func TestGuildClearJournalCorruptionAndUnsafeEntriesRetainEvidence(t *testing.T) {
	for _, kind := range []string{"checksum", "identity", "oversized", "symlink", "directory", "unknown"} {
		t.Run(kind, func(t *testing.T) {
			j, err := OpenGuildClearJournal(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			receipt := guildClearJournalFixture("corrupt-clear")
			name := j.filename(receipt.InstanceID)
			switch kind {
			case "directory":
				if err := os.Mkdir(name, 0700); err != nil {
					t.Fatal(err)
				}
			case "unknown":
				name = filepath.Join(j.dir, "unknown.data")
				if err := os.WriteFile(name, []byte("unknown"), 0600); err != nil {
					t.Fatal(err)
				}
			case "symlink":
				external := filepath.Join(t.TempDir(), "external")
				if err := os.WriteFile(external, []byte("untouched"), 0600); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(external, name); err != nil {
					t.Fatal(err)
				}
			case "oversized":
				if err := os.WriteFile(name, []byte(strings.Repeat("x", maxGuildClearBytes+1)), 0600); err != nil {
					t.Fatal(err)
				}
			default:
				if err := j.Write(receipt); err != nil {
					t.Fatal(err)
				}
				data, err := os.ReadFile(name)
				if err != nil {
					t.Fatal(err)
				}
				if kind == "checksum" {
					data = []byte(strings.Replace(string(data), `"durationMs":120000`, `"durationMs":120001`, 1))
				} else {
					var envelope guildClearEnvelope
					if err := json.Unmarshal(data, &envelope); err != nil {
						t.Fatal(err)
					}
					// A valid receipt moved to another hashed filename is not its identity.
					name = j.filename("other-clear")
				}
				if err := os.WriteFile(name, data, 0600); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := j.Pending(100); err == nil {
				t.Fatal("corrupt/unsafe entry accepted", kind)
			}
			if _, err := os.Lstat(name); err != nil {
				t.Fatal("read failure deleted evidence", err)
			}
		})
	}
}
