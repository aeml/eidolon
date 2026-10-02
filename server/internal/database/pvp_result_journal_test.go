package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/arena"

	"go.mongodb.org/mongo-driver/bson"
)

func arenaReceiptFixture(id string, revision int64) PvPResultReceipt {
	at := time.Now().UTC().Truncate(time.Millisecond)
	return PvPResultReceipt{MatchID: fmt.Sprintf("match-%s-%d", id, revision), Profiles: []PvPProfile{{
		PlayerID: id, Revision: revision, LastMatchID: fmt.Sprintf("match-%s-%d", id, revision),
		Season: CurrentArenaSeason(at), Rating: 1000 + int(revision)*25, Wins: int(revision), Honor: int(revision) * 50, SeasonPoints: int(revision) * 3, UpdatedAt: at,
	}}}
}

func TestArenaResultJournalRetainsDetachedChecksummedReceiptAndRejectsConflicts(t *testing.T) {
	dir := t.TempDir()
	j, err := OpenPvPResultJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	receipt := arenaReceiptFixture("../hero", 1)
	if err = j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err = j.Write(receipt); err != nil {
		t.Fatal("identical retry", err)
	}
	name := j.filename(receipt.MatchID)
	if filepath.Dir(name) != dir {
		t.Fatal("receipt escaped journal")
	}
	info, err := os.Stat(name)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("unsafe receipt permissions", err)
	}
	receipt.Profiles[0].Honor = 999
	if err = j.Write(receipt); err == nil {
		t.Fatal("same match accepted conflicting rewards")
	}
	reopened, err := OpenPvPResultJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := reopened.Pending(100)
	if err != nil || len(pending) != 1 || pending[0].Profiles[0].Honor != 50 {
		t.Fatal("durable receipt aliased live state", pending, err)
	}
	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}
	corrupt := strings.Replace(string(data), `"honor":50`, `"honor":51`, 1)
	if corrupt == string(data) {
		t.Fatal("corruption fixture failed")
	}
	if err = os.WriteFile(name, []byte(corrupt), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = reopened.Pending(100); err == nil {
		t.Fatal("valid JSON with corrupted rewards passed checksum")
	}
	if err = os.WriteFile(name, data, 0600); err != nil {
		t.Fatal(err)
	}
	if err = reopened.Acknowledge(receipt.MatchID); err != nil {
		t.Fatal(err)
	}
	if pending, err = reopened.Pending(100); err != nil || len(pending) != 0 {
		t.Fatal("acknowledged receipt survived", err)
	}
}

func TestArenaResultJournalBoundedBatchesDrainEveryReceiptOnce(t *testing.T) {
	dir := t.TempDir()
	j, err := OpenPvPResultJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, limit := range []int{-1, 0, 101} {
		if _, err := j.Pending(limit); err == nil {
			t.Fatal("invalid batch accepted", limit)
		}
	}
	const count = 137
	for i := range count {
		if err := j.Write(arenaReceiptFixture("bounded", int64(i+1))); err != nil {
			t.Fatal(err)
		}
	}
	j, err = OpenPvPResultJournal(dir) // Discovery does not rely on process memory.
	if err != nil {
		t.Fatal(err)
	}
	seen := make(map[string]bool)
	for pass := 0; pass < count; pass++ {
		entries, err := j.Pending(7)
		if err != nil || len(entries) > 7 {
			t.Fatal("read exceeded its batch or failed", len(entries), err)
		}
		if len(entries) == 0 {
			break
		}
		for _, entry := range entries {
			if seen[entry.MatchID] {
				t.Fatal("acknowledged receipt rediscovered")
			}
			seen[entry.MatchID] = true
			if err := j.Acknowledge(entry.MatchID); err != nil {
				t.Fatal(err)
			}
		}
	}
	if len(seen) != count {
		t.Fatal("bounded reads lost receipts", len(seen))
	}
}

func TestArenaResultJournalRejectsUnreadableWriteWithoutPoisoningOutbox(t *testing.T) {
	j, err := OpenPvPResultJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	oversized := arenaReceiptFixture("oversized", 1)
	oversized.Profiles[0].LastResult.Reason = strings.Repeat("x", maxArenaReceiptBytes)
	if err := j.Write(oversized); err == nil {
		t.Fatal("write accepted an envelope the bounded reader cannot recover")
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 0 {
		t.Fatal("rejected write left a poisoned outbox entry", err)
	}
	valid := arenaReceiptFixture("healthy", 1)
	if err := j.Write(valid); err != nil {
		t.Fatal(err)
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 1 || entries[0].MatchID != valid.MatchID {
		t.Fatal("rejected large write blocked a healthy result", err)
	}
}

func TestArenaResultJournalRejectsSymlinkAndOversizedRetryFile(t *testing.T) {
	for _, kind := range []string{"symlink", "oversized"} {
		t.Run(kind, func(t *testing.T) {
			j, err := OpenPvPResultJournal(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			receipt := arenaReceiptFixture("invalid-file", 1)
			if kind == "symlink" {
				external := filepath.Join(t.TempDir(), "external.json")
				if err := os.WriteFile(external, []byte(`{"untouched":true}`), 0600); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink(external, j.filename(receipt.MatchID)); err != nil {
					t.Fatal(err)
				}
			} else if err := os.WriteFile(j.filename(receipt.MatchID), []byte(strings.Repeat("x", maxArenaReceiptBytes+1)), 0600); err != nil {
				t.Fatal(err)
			}
			if _, err := j.Pending(1); err == nil {
				t.Fatal("unsafe file accepted for replay")
			}
			if err := j.Write(receipt); err == nil {
				t.Fatal("unsafe existing file accepted on retry")
			}
			if _, err := os.Lstat(j.filename(receipt.MatchID)); err != nil {
				t.Fatal("error silently removed the pending evidence", err)
			}
		})
	}
}

func TestArenaResultJournalCapacityPreservesReceiptsRetriesAndRestartCount(t *testing.T) {
	dir := t.TempDir()
	for _, limit := range []int{0, -1, DefaultMaxPendingPvPResults + 1} {
		if _, err := OpenPvPResultJournalWithLimit(dir, limit); err == nil {
			t.Fatal("invalid journal capacity accepted", limit)
		}
	}
	j, err := OpenPvPResultJournalWithLimit(dir, 2)
	if err != nil {
		t.Fatal(err)
	}
	first, second, third := arenaReceiptFixture("capacity", 1), arenaReceiptFixture("capacity", 2), arenaReceiptFixture("capacity", 3)
	for _, receipt := range []PvPResultReceipt{first, second} {
		if err := j.Write(receipt); err != nil {
			t.Fatal(err)
		}
	}
	if err := j.Write(third); !errors.Is(err, ErrPvPResultJournalFull) {
		t.Fatal("full outbox accepted new result", err)
	}
	if err := j.Write(first); err != nil {
		t.Fatal("full outbox rejected identical durable retry", err)
	}
	first.Profiles[0].Honor++
	if err := j.Write(first); err == nil || errors.Is(err, ErrPvPResultJournalFull) {
		t.Fatal("full outbox hid a conflicting result as capacity failure", err)
	}
	j, err = OpenPvPResultJournalWithLimit(dir, 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := j.Write(third); !errors.Is(err, ErrPvPResultJournalFull) {
		t.Fatal("restart lost backlog reservations", err)
	}
	if entries, err := j.Pending(100); err != nil || len(entries) != 2 {
		t.Fatal("capacity failure removed owed results", err)
	}
	if err := j.Acknowledge(second.MatchID); err != nil {
		t.Fatal(err)
	}
	if err := j.Acknowledge(second.MatchID); err != nil {
		t.Fatal("duplicate acknowledgement failed", err)
	}
	if err := j.Write(third); err != nil {
		t.Fatal("confirmed acknowledgement did not release capacity", err)
	}
	fourth := arenaReceiptFixture("capacity", 4)
	if err := j.Write(fourth); !errors.Is(err, ErrPvPResultJournalFull) {
		t.Fatal("duplicate acknowledgement released another slot", err)
	}
	// Lowering an operator limit preserves an already larger backlog.
	j, err = OpenPvPResultJournalWithLimit(dir, 1)
	if err != nil {
		t.Fatal(err)
	}
	if entries, err := j.Pending(100); err != nil || len(entries) != 2 {
		t.Fatal("lower capacity trimmed previous decided results", err)
	}
	if err := j.Write(fourth); !errors.Is(err, ErrPvPResultJournalFull) {
		t.Fatal("over-limit legacy backlog admitted new receipt", err)
	}
}

func TestArenaResultJournalConcurrentWritersCannotOverrunCapacity(t *testing.T) {
	j, err := OpenPvPResultJournalWithLimit(t.TempDir(), 8)
	if err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 64)
	var producers sync.WaitGroup
	for revision := range 64 {
		producers.Add(1)
		go func(revision int) {
			defer producers.Done()
			results <- j.Write(arenaReceiptFixture("burst", int64(revision+1)))
		}(revision)
	}
	producers.Wait()
	close(results)
	accepted, rejected := 0, 0
	for err := range results {
		if err == nil {
			accepted++
		} else if errors.Is(err, ErrPvPResultJournalFull) {
			rejected++
		} else {
			t.Fatal(err)
		}
	}
	if accepted != 8 || rejected != 56 {
		t.Fatal("concurrent admission exceeded/lost bounded slots", accepted, rejected)
	}
	if entries, err := j.Pending(100); err != nil || len(entries) != 8 {
		t.Fatal("durable count differs from admission", err)
	}
}

func TestArenaReceiptMongoReplayAndOutOfOrderWrites(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable arena Mongo required")
	}
	if !strings.HasPrefix(uri, "mongodb://127.0.0.1:") {
		t.Fatal("arena fixture requires explicit loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.client.Disconnect(context.Background()) })
	id := fmt.Sprintf("arena-replay-test-%d", time.Now().UnixNano())
	t.Cleanup(func() { db.pvpProfiles.DeleteOne(context.Background(), bson.M{"player_id": id}) })
	first := arenaReceiptFixture(id, 1)
	second := arenaReceiptFixture(id, 2)
	second.Profiles[0].RewardState = arena.RewardState{Day: time.Now().UTC().Format("2006-01-02"), Opponents: map[string]int{"opponent": 3}, DeserterUntil: time.Now().Add(5 * time.Minute).Unix()}
	second.Profiles[0].LastResult = arena.ResultSummary{MatchID: second.MatchID, Won: true, RatingChange: 16, Reason: "verified result"}
	if err = db.SavePvPProfile(second.Profiles[0]); err != nil {
		t.Fatal(err)
	}
	if err = db.SavePvPProfile(first.Profiles[0]); err != nil {
		t.Fatal("stale retry", err)
	}
	if err = db.SavePvPProfile(second.Profiles[0]); err != nil {
		t.Fatal("same result replay", err)
	}
	stored, err := db.GetPvPProfile(id)
	if err != nil || stored.RewardState.Opponents["opponent"] != 3 || stored.RewardState.DeserterUntil != second.Profiles[0].RewardState.DeserterUntil || stored.LastResult != second.Profiles[0].LastResult {
		t.Fatal("durable reward counters, penalty or result lost", stored, err)
	}
	conflict := second.Profiles[0]
	conflict.Honor++
	if err = db.SavePvPProfile(conflict); err == nil {
		t.Fatal("conflicting same-revision update succeeded")
	}
	var group sync.WaitGroup
	errors := make(chan error, 8)
	for revision := int64(3); revision <= 10; revision++ {
		group.Add(1)
		go func(revision int64) {
			defer group.Done()
			errors <- db.SavePvPProfile(arenaReceiptFixture(id, revision).Profiles[0])
		}(revision)
	}
	group.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	profile, err := db.GetPvPProfile(id)
	if err != nil || profile.Revision != 10 || profile.Wins != 10 || profile.Honor != 500 {
		t.Fatal("newest outcome lost", profile, err)
	}

	// Crash boundary: first participant committed, second not yet written.
	j, err := OpenPvPResultJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	receipt := arenaReceiptFixture(id, 11)
	other := arenaReceiptFixture(id+"-partner", 1).Profiles[0]
	other.LastMatchID = receipt.MatchID
	receipt.Profiles = append(receipt.Profiles, other)
	t.Cleanup(func() { db.pvpProfiles.DeleteOne(context.Background(), bson.M{"player_id": other.PlayerID}) })
	if err = j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err = db.SavePvPProfile(receipt.Profiles[0]); err != nil {
		t.Fatal(err)
	}
	pending, err := j.Pending(100)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err = db.CommitPvPReceipt(pending[0]); err != nil {
			t.Fatal(err)
		}
	}
	profile, err = db.GetPvPProfile(id)
	if err != nil || profile.Revision != 11 || profile.Honor != 550 {
		t.Fatal("partial replay doubled/lost first reward", profile, err)
	}
	partner, err := db.GetPvPProfile(other.PlayerID)
	if err != nil || partner.Revision != 1 || partner.Honor != 50 {
		t.Fatal("partial replay lost partner", partner, err)
	}
}
