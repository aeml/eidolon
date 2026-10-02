package main

import (
	"errors"
	"log"
	"sync"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type guildClearOutbox interface {
	Write(database.GuildClearReceipt) error
	Pending(int) ([]database.GuildClearReceipt, error)
	Acknowledge(string) error
}

var guildClearJournal guildClearOutbox

const guildClearReplayBatchSize = 8

var errGuildClearReplayPending = errors.New("guild clear backlog remains pending")

func recordGuildDungeonCompletion(event game.DungeonCompletionEvent) error {
	if len(event.GuildRuns) == 0 {
		return nil
	}
	if guildClearJournal == nil {
		return errors.New("guild clear journal unavailable")
	}
	// Filesystem only, not world/account/session locks or Mongo. Never claim
	// durable recording if this write fails. Existing gameplay rewards remain
	// independently handled by character persistence, not this leaderboard.
	if err := guildClearJournal.Write(database.GuildClearReceipt{InstanceID: event.InstanceID, Runs: event.GuildRuns}); err != nil {
		return err
	}
	guildClearSync.request() // Rejection leaves the durable receipt for startup/retry.
	return nil
}

func replayGuildClearBatch(outbox guildClearOutbox, commit func(database.GuildDungeonRun) error) error {
	receipts, err := outbox.Pending(guildClearReplayBatchSize + 1)
	if err != nil {
		return err
	}
	more := len(receipts) > guildClearReplayBatchSize
	if more {
		receipts = receipts[:guildClearReplayBatchSize]
	}
	for _, receipt := range receipts {
		for _, run := range receipt.Runs {
			if err := commit(run); err != nil {
				return err // Partial multi-guild min/max updates safely replay.
			}
		}
		if err := outbox.Acknowledge(receipt.InstanceID); err != nil {
			return err
		}
	}
	if more {
		return errGuildClearReplayPending
	}
	return nil
}

func retryPendingGuildClears() error {
	if guildClearJournal == nil || db == nil {
		return errors.New("guild clear recovery unavailable")
	}
	return replayGuildClearBatch(guildClearJournal, db.RecordGuildDungeonRun)
}

type guildClearSyncWork struct {
	mu      sync.Mutex
	running bool
	pending bool
	replay  func() error // Immutable after initialization; injectable in isolated tests.
}

var guildClearSync = &guildClearSyncWork{replay: retryPendingGuildClears}

func (work *guildClearSyncWork) request() bool {
	work.mu.Lock()
	defer work.mu.Unlock()
	work.pending = true
	if work.running {
		return true
	}
	work.running = true
	if !scheduleCharacterWork(work.run) {
		work.running = false
		return false
	}
	return true
}

func (work *guildClearSyncWork) run() {
	for {
		work.mu.Lock()
		if !work.pending {
			work.running = false
			work.mu.Unlock()
			return
		}
		work.pending = false
		work.mu.Unlock()
		if err := work.replay(); err != nil {
			log.Printf("Guild leaderboard recovery remains pending: %v", err)
			work.mu.Lock()
			work.pending, work.running = true, false
			work.mu.Unlock()
			return // Retain disk receipts; retry on a later request/tick, never spin.
		}
	}
}
