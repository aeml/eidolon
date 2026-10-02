package main

import (
	"log"
	"sync"
)

// Completion identity and kill time live in each character's outbox, not in
// queued closures. One worker reconciles those outboxes and recorded rewards.
// Startup recovery remains synchronous; periodic and combat requests share this
// coordinator. Never acknowledge or discard a completion on admission failure.
type weeklyRaidSyncWork struct {
	mu      sync.Mutex
	running bool
	pending bool
	recover func() error // Immutable after initialization; injectable in isolated tests.
}

var weeklyRaidSync = &weeklyRaidSyncWork{recover: recoverPendingWeeklyRaidRewards}

func (work *weeklyRaidSyncWork) request() bool {
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

func (work *weeklyRaidSyncWork) run() {
	for {
		work.mu.Lock()
		if !work.pending {
			work.running = false
			work.mu.Unlock()
			return
		}
		work.pending = false
		work.mu.Unlock()
		if err := work.recover(); err != nil {
			// Keep ownership through logging, and wait for a later request/tick
			// instead of multiplying workers or retrying tightly during outages.
			log.Printf("Weekly raid reward recovery remains pending: %v", err)
			work.mu.Lock()
			work.pending, work.running = true, false
			work.mu.Unlock()
			return
		}
	}
}
