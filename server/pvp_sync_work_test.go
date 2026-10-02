package main

import (
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/arena"
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

func arenaSyncWorkFixture(t *testing.T) *lifecycle.Group {
	t.Helper()
	previous := backgroundCharacterWork
	group := &lifecycle.Group{}
	backgroundCharacterWork = group
	t.Cleanup(func() { group.SealWhenIdle(); backgroundCharacterWork = previous })
	return group
}

func waitArenaSyncStopped(t *testing.T, work *arenaResultSyncWork) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		work.mu.Lock()
		running := work.running
		work.mu.Unlock()
		if !running {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("arena sync worker did not stop")
}

func TestArenaSyncWorkCoalescesConcurrentCompletionAndPeriodicRequests(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	barrier := &saveTestBarrier{done: make(chan struct{})}
	t.Cleanup(barrier.release)
	entered := make(chan struct{}, 1)
	var passes atomic.Int32
	work := &arenaResultSyncWork{syncResults: func() error {
		if passes.Add(1) == 1 {
			entered <- struct{}{}
			<-barrier.done
		}
		return nil
	}}
	if !work.request() {
		t.Fatal("initial sync was not admitted")
	}
	<-entered
	var producers sync.WaitGroup
	for range 8 {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for range 64 {
				if !work.request() {
					t.Error("live completion/periodic request was rejected")
				}
			}
		}()
	}
	producers.Wait()
	if passes.Load() != 1 {
		t.Fatal("requests started parallel outbox passes")
	}
	barrier.release()
	group.SealWhenIdle()
	if passes.Load() != 2 {
		t.Fatal("requests were lost or created one pass per completion")
	}
	work.mu.Lock()
	defer work.mu.Unlock()
	if work.pending || work.running {
		t.Fatal("drained synchronization retained work")
	}
}

func TestArenaSyncWorkFailureRetainsActualJournalUntilLaterRequest(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	journal, err := database.OpenPvPResultJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	receipt := database.PvPResultReceipt{MatchID: "prepared-result", Profiles: []database.PvPProfile{{
		PlayerID: "player-prepared", LastMatchID: "prepared-result", Revision: 1, UpdatedAt: time.Now(), Rating: 1032,
	}}}
	if err := journal.Write(receipt); err != nil {
		t.Fatal(err)
	}
	var failing atomic.Bool
	failing.Store(true)
	var passes atomic.Int32
	work := &arenaResultSyncWork{syncResults: func() error {
		passes.Add(1)
		if failing.Load() {
			return errors.New("disposable consumer unavailable")
		}
		// Simulated successful consumer, not a claimed Mongo commit.
		return journal.Acknowledge(receipt.MatchID)
	}}
	work.request()
	waitArenaSyncStopped(t, work)
	entries, err := journal.Pending()
	if err != nil || len(entries) != 1 || entries[0].Profiles[0].Rating != 1032 || passes.Load() != 1 {
		t.Fatal("failed pass lost or changed the decided durable result")
	}
	failing.Store(false)
	if !work.request() {
		t.Fatal("later periodic request did not restart synchronization")
	}
	group.SealWhenIdle()
	entries, err = journal.Pending()
	if err != nil || len(entries) != 0 || passes.Load() != 2 {
		t.Fatal("later request did not consume the retained receipt exactly once")
	}
}

func TestArenaSyncWorkSealedAdmissionRetainsPendingRequest(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	group.CloseAndWait()
	work := &arenaResultSyncWork{syncResults: func() error { t.Error("rejected sync ran"); return nil }}
	if work.request() {
		t.Fatal("sealed shutdown admitted an outbox worker")
	}
	work.mu.Lock()
	defer work.mu.Unlock()
	if work.running || !work.pending {
		t.Fatal("rejected sync pretended to run or lost pending state")
	}
}

func TestArenaResultPresentationDoesNotWaitForDatabaseSynchronization(t *testing.T) {
	group := arenaSyncWorkFixture(t)
	barrier := &saveTestBarrier{done: make(chan struct{})}
	t.Cleanup(barrier.release)
	entered := make(chan struct{}, 1)
	work := &arenaResultSyncWork{syncResults: func() error { entered <- struct{}{}; <-barrier.done; return nil }}
	work.request()
	<-entered
	previousWorld, previousDB, previousSessions := world, db, activeSessions
	t.Cleanup(func() { world, db, activeSessions = previousWorld, previousDB, previousSessions })
	world, db = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50), PvP: game.NewPvPSystem()}, nil
	first, second, other := newAutoStatusClient("arena-first"), newAutoStatusClient("arena-second"), newAutoStatusClient("arena-other")
	activeSessions = map[string]*Client{first.username: first, second.username: second, other.username: other}
	for _, client := range []*Client{first, second, other} {
		world.AddEntity(newAutoStatusPlayer(client.playerID, client.username, "available"))
	}
	result := game.PvPMatchResult{Mode: game.PvPModeArena1v1, WinnerIDs: []string{first.playerID}, LoserIDs: []string{second.playerID}, Profiles: []game.PvPProfile{{
		PlayerID: first.playerID, Rating: 1032,
		LastResult: arena.ResultSummary{RatingChange: 32, HonorAwarded: 15, SeasonAwarded: 5, Reason: "prepared win"},
	}, {PlayerID: second.playerID, Rating: 968}}}
	notifyPvPMatchResult(result, true)
	for _, client := range []*Client{first, second} {
		var returned, updated, outcome, syncing bool
		for _, message := range drainSentMessages(client.send) {
			returned = returned || message.Type == MsgEnterInstance
			updated = updated || message.Type == MsgPvPUpdate
			outcome = outcome || strings.Contains(string(message.Payload), "Arena result: rating")
			syncing = syncing || strings.Contains(string(message.Payload), "syncing")
		}
		if !returned || !updated || !outcome || !syncing {
			t.Fatal("participant missed return, outcome, state or honest pending sync copy")
		}
	}
	if len(other.send) != 0 {
		t.Fatal("result leaked to a nonparticipant")
	}
	barrier.release()
	group.SealWhenIdle()
}
