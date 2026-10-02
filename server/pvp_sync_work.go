package main

import (
	"log"
	"sync"
)

// Ranked results are journaled before the world releases participants. Request
// one pass over that durable outbox, not a new waiting worker per result. The
// periodic request uses the same coordinator; startup recovery stays synchronous.
type arenaResultSyncWork struct {
	mu          sync.Mutex
	running     bool
	pending     bool
	syncResults func() error // Immutable after initialization; injectable in isolated tests.
}

var arenaResultSync = &arenaResultSyncWork{syncResults: retryPendingPvPResults}

func (work *arenaResultSyncWork) request() bool {
	work.mu.Lock()
	defer work.mu.Unlock()
	work.pending = true
	if work.running {
		return true
	}
	work.running = true
	if !scheduleCharacterWork(work.run) {
		work.running = false
		return false // Durable receipts remain; never acknowledge rejected work.
	}
	return true
}

func (work *arenaResultSyncWork) run() {
	for {
		work.mu.Lock()
		if !work.pending {
			work.running = false
			work.mu.Unlock()
			return
		}
		work.pending = false
		work.mu.Unlock()
		if err := work.syncResults(); err != nil {
			// A failed pass retains its disk receipts. Wait for the next request
			// or periodic tick instead of a tight retry loop during an outage.
			// Keep ownership through logging too: slow diagnostics must not let
			// new requests accumulate workers waiting on the logger.
			log.Printf("Arena result sync remains pending: %v", err)
			work.mu.Lock()
			work.pending, work.running = true, false
			work.mu.Unlock()
			return
		}
	}
}
