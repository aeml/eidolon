package main

import (
	"sync"
	"time"

	"eidolon-server/internal/operations"
)

type operationalBoundary uint8

const (
	boundaryCharacterJournal operationalBoundary = iota
	boundaryCharacterCommit
	boundaryCharacterCleanup
	boundaryCharacterRecovery
	boundaryCasinoGold
	boundaryCasinoEP
)

var operationalResults = struct {
	sync.Mutex
	metrics operations.OperationalMetrics
}{}

// A tiny fixed-size lock protects a coherent snapshot. No IO, player identities,
// dynamic labels or callbacks run while held; instrumentation cannot alter an
// operation's saved outcome or turn a lost acknowledgement into compensation.
// Caller holds operationalResults. Only these six fixed labels are observed.
func operationalBoundaryCounts(boundary operationalBoundary) *operations.OutcomeCounts {
	switch boundary {
	case boundaryCharacterJournal:
		return &operationalResults.metrics.CharacterJournal
	case boundaryCharacterCommit:
		return &operationalResults.metrics.CharacterCommit
	case boundaryCharacterCleanup:
		return &operationalResults.metrics.CharacterCleanup
	case boundaryCharacterRecovery:
		return &operationalResults.metrics.CharacterRecovery
	case boundaryCasinoGold:
		return &operationalResults.metrics.CasinoGold
	case boundaryCasinoEP:
		return &operationalResults.metrics.CasinoEP
	default:
		return nil
	}
}

// Completion is tied to one start and is idempotent. Unknown labels are ignored;
// no IO or application callback runs while the aggregate lock is held.
func beginOperationalCall(boundary operationalBoundary) func(error) {
	started := time.Now()
	operationalResults.Lock()
	counts := operationalBoundaryCounts(boundary)
	if counts == nil {
		operationalResults.Unlock()
		return func(error) {}
	}
	counts.InFlight++
	operationalResults.Unlock()
	var once sync.Once
	return func(err error) {
		once.Do(func() {
			elapsed := time.Since(started)
			operationalResults.Lock()
			defer operationalResults.Unlock()
			counts.InFlight--
			recordOperationalOutcome(counts, err, elapsed)
		})
	}
}

func recordOperationalResult(boundary operationalBoundary, err error, elapsed time.Duration) {
	operationalResults.Lock()
	defer operationalResults.Unlock()
	counts := operationalBoundaryCounts(boundary)
	if counts == nil {
		return
	}
	recordOperationalOutcome(counts, err, elapsed)
}

func recordOperationalOutcome(counts *operations.OutcomeCounts, err error, elapsed time.Duration) {
	counts.Completed++
	if err != nil {
		counts.Failed++
	}
	if elapsed >= 0 {
		micros := uint64(elapsed.Microseconds())
		counts.TimedSamples++
		counts.MaxMicros = max(counts.MaxMicros, micros)
		// Saturate rather than wrapping a process-lifetime sum. At saturation
		// consumers must not present a derived mean as an exact measurement.
		if ^uint64(0)-counts.TotalMicros < micros {
			counts.TotalMicros = ^uint64(0)
		} else {
			counts.TotalMicros += micros
		}
	}
}

func operationalMetricsSnapshot() operations.OperationalMetrics {
	operationalResults.Lock()
	defer operationalResults.Unlock()
	snapshot := operationalResults.metrics
	for _, counts := range []*operations.OutcomeCounts{&snapshot.CharacterJournal, &snapshot.CharacterCommit,
		&snapshot.CharacterCleanup, &snapshot.CharacterRecovery, &snapshot.CasinoGold, &snapshot.CasinoEP} {
		counts.InFlightKnown = true
	}
	return snapshot
}
