package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func replayBatchJournalFixture(t *testing.T, count int) *database.PvPResultJournal {
	t.Helper()
	j, err := database.OpenPvPResultJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	playerID := fmt.Sprintf("player-batch-%d", time.Now().UnixNano())
	for i := range count {
		id := fmt.Sprintf("batch-result-%d", i)
		if err := j.Write(database.PvPResultReceipt{MatchID: id, Profiles: []database.PvPProfile{{
			PlayerID: playerID, Revision: int64(i + 1), LastMatchID: id, UpdatedAt: time.Now(), Honor: (i + 1) * 50,
		}}}); err != nil {
			t.Fatal(err)
		}
	}
	return j
}

func TestArenaReplayBatchActualMongoAndStartupKeepNewestReceipt(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable arena Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Close(context.Background()) })
	const count = arenaReplayBatchSize*2 + 5
	j := replayBatchJournalFixture(t, count)
	entries, err := j.Pending(100)
	if err != nil {
		t.Fatal(err)
	}
	var newest database.PvPResultReceipt
	for _, entry := range entries {
		if entry.Profiles[0].Revision == count {
			newest = entry
		}
	}
	if newest.MatchID == "" {
		t.Fatal("newest fixture receipt missing")
	}
	// Force newer-before-older replay, as after a lost acknowledgement.
	if err := repo.CommitPvPReceipt(newest); err != nil {
		t.Fatal(err)
	}
	if err := replayPvPResultBatch(j, repo.CommitPvPReceipt); !errors.Is(err, errArenaReplayPending) {
		t.Fatal("ordinary pass concealed the remaining backlog", err)
	}
	previousDB, previousJournal := db, arenaResultJournal
	db, arenaResultJournal = repo, j
	t.Cleanup(func() { db, arenaResultJournal = previousDB, previousJournal })
	if err := recoverPvPResultsAtStartup(); err != nil {
		t.Fatal("healthy larger backlog prevented startup recovery", err)
	}
	profile, err := repo.GetPvPProfile(newest.Profiles[0].PlayerID)
	if err != nil || profile.Revision != count || profile.Honor != count*50 || profile.LastMatchID != newest.MatchID {
		t.Fatal("older batch lowered or duplicated the newest decided reward", profile, err)
	}
	if entries, err := j.Pending(100); err != nil || len(entries) != 0 {
		t.Fatal("startup left confirmed results pending", err)
	}
}

func TestArenaReplayBatchRetainsBacklogAndDrainsWithoutDoubleCommit(t *testing.T) {
	const count = arenaReplayBatchSize*2 + 5
	j := replayBatchJournalFixture(t, count)
	committed := make(map[string]bool)
	commit := func(receipt database.PvPResultReceipt) error {
		if committed[receipt.MatchID] {
			t.Error("acknowledged receipt committed twice")
		}
		committed[receipt.MatchID] = true
		return nil // Simulated consumer, not a claimed Mongo write.
	}
	for pass := 0; pass < 3; pass++ {
		before := len(committed)
		err := replayPvPResultBatch(j, commit)
		if len(committed)-before > arenaReplayBatchSize {
			t.Fatal("pass exceeded the commit budget")
		}
		if pass < 2 && !errors.Is(err, errArenaReplayPending) {
			t.Fatal("partial success concealed remaining decided results", err)
		}
		if pass == 2 && err != nil {
			t.Fatal("last batch failed", err)
		}
	}
	entries, err := j.Pending(100)
	if err != nil || len(entries) != 0 || len(committed) != count {
		t.Fatal("bounded consumer lost recorded results", len(committed), err)
	}
}

func TestArenaReplayBatchConsumerFailureLeavesExactReceipts(t *testing.T) {
	j := replayBatchJournalFixture(t, 5)
	before, err := j.Pending(100)
	if err != nil {
		t.Fatal(err)
	}
	failure := errors.New("isolated consumer unavailable")
	calls := 0
	if err := replayPvPResultBatch(j, func(database.PvPResultReceipt) error { calls++; return failure }); !errors.Is(err, failure) || calls != 1 {
		t.Fatal("consumer failure hidden or repeated writes attempted", err, calls)
	}
	after, err := j.Pending(100)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("failed consumer discarded or changed frozen results", err)
	}
	if err := replayPvPResultBatch(j, func(database.PvPResultReceipt) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if after, err := j.Pending(100); err != nil || len(after) != 0 {
		t.Fatal("later recovery failed to acknowledge confirmed results", err)
	}
}
