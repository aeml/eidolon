package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func guildReplayReceipt(id string) database.GuildClearReceipt {
	at := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	return database.GuildClearReceipt{InstanceID: id, Runs: []database.GuildDungeonRun{{GuildID: "guild-recorded",
		GuildName: "Recorded Watch", GuildTag: "TEST", Season: database.CurrentGuildDungeonSeason(at),
		DungeonType: "verdant_bastion_catacombs", Difficulty: "normal", RunLevel: 30,
		DurationMS: 120000, MemberCount: 4, FirstClearAt: at}}}
}

func TestGuildClearReplayBoundedPassAndFailurePreserveReceipts(t *testing.T) {
	j, err := database.OpenGuildClearJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	const count = guildClearReplayBatchSize*2 + 3
	for i := range count {
		if err := j.Write(guildReplayReceipt(fmt.Sprintf("clear-%d", i))); err != nil {
			t.Fatal(err)
		}
	}
	before, err := j.Pending(100)
	if err != nil {
		t.Fatal(err)
	}
	failure := errors.New("isolated consumer unavailable")
	calls := 0
	if err := replayGuildClearBatch(j, func(database.GuildDungeonRun) error { calls++; return failure }); !errors.Is(err, failure) || calls != 1 {
		t.Fatal("failed consumer concealed failure or multiplied writes", err, calls)
	}
	after, err := j.Pending(100)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("failed pass changed owed clears", err)
	}
	for pass := range 3 {
		calls = 0
		err := replayGuildClearBatch(j, func(database.GuildDungeonRun) error { calls++; return nil })
		if calls > guildClearReplayBatchSize || (pass < 2 && !errors.Is(err, errGuildClearReplayPending)) || (pass == 2 && err != nil) {
			t.Fatal("pass budget or pending marker incorrect", calls, err)
		}
	}
	if remaining, err := j.Pending(100); err != nil || len(remaining) != 0 {
		t.Fatal("drain lost or retained clears", err)
	}
}

type guildAckFailureOutbox struct {
	*database.GuildClearJournal
	fail bool
}

func (outbox *guildAckFailureOutbox) Acknowledge(id string) error {
	if outbox.fail {
		return errors.New("isolated acknowledgement unavailable")
	}
	return outbox.GuildClearJournal.Acknowledge(id)
}

func TestGuildClearReplayPartialGroupAndLostAcknowledgementRetry(t *testing.T) {
	j, err := database.OpenGuildClearJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	receipt := guildReplayReceipt("shared-clear")
	other := receipt.Runs[0]
	other.GuildID = "other-recorded"
	receipt.Runs = append(receipt.Runs, other)
	if err := j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	committed := map[string]database.GuildDungeonRun{}
	failing := true
	commit := func(run database.GuildDungeonRun) error {
		if run.GuildID == other.GuildID && failing {
			return errors.New("second group unavailable")
		}
		committed[run.GuildID] = run // Simulated idempotent consumer, not a Mongo claim.
		return nil
	}
	if err := replayGuildClearBatch(j, commit); err == nil || len(committed) != 1 {
		t.Fatal("partial failure concealed or misapplied")
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 1 {
		t.Fatal("partial group clear acknowledged", err)
	}
	failing = false
	wrapped := &guildAckFailureOutbox{GuildClearJournal: j, fail: true}
	if err := replayGuildClearBatch(wrapped, commit); err == nil || len(committed) != 2 {
		t.Fatal("lost acknowledgement concealed")
	}
	wrapped.fail = false
	if err := replayGuildClearBatch(wrapped, commit); err != nil || len(committed) != 2 {
		t.Fatal("retry changed recorded group results", err)
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 0 {
		t.Fatal("confirmed groups not acknowledged", err)
	}
}

func TestGuildClearSyncCoalescesCompletionAndPeriodicRequests(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	barrier := &saveTestBarrier{done: make(chan struct{})}
	t.Cleanup(barrier.release)
	entered := make(chan struct{}, 1)
	var calls atomic.Int32
	work := &guildClearSyncWork{replay: func() error {
		if calls.Add(1) == 1 {
			entered <- struct{}{}
			<-barrier.done
		}
		return nil
	}}
	work.request()
	<-entered
	var producers sync.WaitGroup
	for range 8 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for range 64 {
				if !work.request() {
					t.Error("live request rejected")
				}
			}
		}()
	}
	producers.Wait()
	if calls.Load() != 1 {
		t.Fatal("requests started parallel consumers")
	}
	barrier.release()
	group.SealWhenIdle()
	if calls.Load() != 2 {
		t.Fatal("requests lost or created a consumer per clear")
	}
}

func TestGuildClearSyncFailureWaitsForLaterRequestWithRealReceipt(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	j, err := database.OpenGuildClearJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := j.Write(guildReplayReceipt("retry-clear")); err != nil {
		t.Fatal(err)
	}
	var failing atomic.Bool
	failing.Store(true)
	var calls atomic.Int32
	work := &guildClearSyncWork{replay: func() error {
		calls.Add(1)
		return replayGuildClearBatch(j, func(database.GuildDungeonRun) error {
			if failing.Load() {
				return errors.New("isolated consumer unavailable")
			}
			return nil
		})
	}}
	work.request()
	deadline := time.Now().Add(time.Second)
	for {
		work.mu.Lock()
		running, pending := work.running, work.pending
		work.mu.Unlock()
		if !running {
			if !pending {
				t.Fatal("failed recovery lost pending state")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("failed recovery spun instead of stopping")
		}
		time.Sleep(time.Millisecond)
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 1 || calls.Load() != 1 {
		t.Fatal("failed worker consumed/spun on receipt", err)
	}
	failing.Store(false)
	work.request()
	group.SealWhenIdle()
	if entries, err := j.Pending(1); err != nil || len(entries) != 0 || calls.Load() != 2 {
		t.Fatal("later request did not recover retained receipt", err)
	}
}

func TestGuildClearRecordingSealedAdmissionStillJournalsAndDoesNotUseGameplayLocks(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	group.CloseAndWait()
	j, err := database.OpenGuildClearJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	previousJournal, previousWork := guildClearJournal, guildClearSync
	guildClearJournal = j
	guildClearSync = &guildClearSyncWork{replay: func() error { t.Error("sealed replay ran"); return nil }}
	t.Cleanup(func() { guildClearJournal, guildClearSync = previousJournal, previousWork })
	receipt := guildReplayReceipt("sealed-clear")
	var lockedWorld game.World
	var lockedPlayer game.Entity
	previousWorld := world
	world = &lockedWorld
	t.Cleanup(func() { world = previousWorld })
	lockedWorld.Mu.Lock()
	lockedPlayer.Mu.Lock()
	unlock := lockCharacterWork("guild-recorded")
	err = recordGuildDungeonCompletion(game.DungeonCompletionEvent{InstanceID: receipt.InstanceID, GuildRuns: receipt.Runs})
	unlock()
	lockedPlayer.Mu.Unlock()
	lockedWorld.Mu.Unlock()
	if err != nil {
		t.Fatal("sealed consumer discarded recording", err)
	}
	entries, err := j.Pending(1)
	if err != nil || len(entries) != 1 || !reflect.DeepEqual(entries[0], receipt) {
		t.Fatal("sealed replay lost the durable receipt", err)
	}
	guildClearSync.mu.Lock()
	defer guildClearSync.mu.Unlock()
	if guildClearSync.running || !guildClearSync.pending {
		t.Fatal("rejected replay falsely ran or discarded pending state")
	}
}

type guildWriteFailureOutbox struct{ guildClearOutbox }

func (guildWriteFailureOutbox) Write(database.GuildClearReceipt) error {
	return errors.New("isolated filesystem unavailable")
}

func TestGuildClearRecordingFailedWriteDoesNotRequestOrAcknowledge(t *testing.T) {
	previousJournal, previousWork := guildClearJournal, guildClearSync
	guildClearJournal = guildWriteFailureOutbox{}
	guildClearSync = &guildClearSyncWork{replay: func() error { t.Error("unrecorded clear replayed"); return nil }}
	t.Cleanup(func() { guildClearJournal, guildClearSync = previousJournal, previousWork })
	receipt := guildReplayReceipt("failed-clear")
	if err := recordGuildDungeonCompletion(game.DungeonCompletionEvent{InstanceID: receipt.InstanceID, GuildRuns: receipt.Runs}); err == nil {
		t.Fatal("failed write concealed")
	}
	if guildClearSync.pending || guildClearSync.running {
		t.Fatal("failed write pretended to secure/queue the clear")
	}
	if err := recordGuildDungeonCompletion(game.DungeonCompletionEvent{}); err != nil {
		t.Fatal("nonqualifying clear attempted storage", err)
	}
}

func TestGuildClearActualMongoReopenPartialCommitAndAckRetry(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" || !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Close(context.Background()) })
	dir := t.TempDir()
	j, err := database.OpenGuildClearJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	receipt := guildReplayReceipt(fmt.Sprintf("mongo-clear-%d", time.Now().UnixNano()))
	receipt.Runs[0].GuildID = receipt.InstanceID + "-first"
	other := receipt.Runs[0]
	other.GuildID = receipt.InstanceID + "-second"
	receipt.Runs = append(receipt.Runs, other)
	if err := j.Write(receipt); err != nil {
		t.Fatal(err)
	}
	if err := replayGuildClearBatch(j, func(run database.GuildDungeonRun) error {
		if run.GuildID == other.GuildID {
			return errors.New("injected second-guild write failure")
		}
		return repo.RecordGuildDungeonRun(run)
	}); err == nil {
		t.Fatal("partial group write failure hidden")
	}
	j, err = database.OpenGuildClearJournal(dir) // Discard original journal object's memory.
	if err != nil {
		t.Fatal(err)
	}
	entries, err := j.Pending(1)
	if err != nil || len(entries) != 1 || !reflect.DeepEqual(entries[0], receipt) {
		t.Fatal("reopen lost exact partially committed receipt", err)
	}
	wrapped := &guildAckFailureOutbox{GuildClearJournal: j, fail: true}
	previousDB, previousJournal := db, guildClearJournal
	db, guildClearJournal = repo, wrapped
	t.Cleanup(func() { db, guildClearJournal = previousDB, previousJournal })
	if err := retryPendingGuildClears(); err == nil {
		t.Fatal("lost acknowledgement hidden")
	}
	wrapped.fail = false
	if err := retryPendingGuildClears(); err != nil {
		t.Fatal(err)
	}
	runs, err := repo.GuildDungeonLeaderboard(receipt.Runs[0].DungeonType, "normal", 30, 20, receipt.Runs[0].FirstClearAt)
	if err != nil {
		t.Fatal(err)
	}
	found := 0
	for _, run := range runs {
		if run.GuildID != receipt.Runs[0].GuildID && run.GuildID != other.GuildID {
			continue
		}
		found++
		if run.Season != "2026-Q3" || run.DurationMS != 120000 || run.MemberCount != 4 || !run.FirstClearAt.Equal(receipt.Runs[0].FirstClearAt) {
			t.Fatal("retry changed original season/time or duplicated participant counts", run)
		}
	}
	if found != 2 {
		t.Fatal("partial/replayed clear lost a guild", found)
	}
	if entries, err := j.Pending(1); err != nil || len(entries) != 0 {
		t.Fatal("confirmed clears not acknowledged", err)
	}
}
