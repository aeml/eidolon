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
func recordOperationalResult(boundary operationalBoundary, err error, elapsed time.Duration) {
	operationalResults.Lock()
	defer operationalResults.Unlock()
	var counts *operations.OutcomeCounts
	switch boundary {
	case boundaryCharacterJournal:
		counts = &operationalResults.metrics.CharacterJournal
	case boundaryCharacterCommit:
		counts = &operationalResults.metrics.CharacterCommit
	case boundaryCharacterCleanup:
		counts = &operationalResults.metrics.CharacterCleanup
	case boundaryCharacterRecovery:
		counts = &operationalResults.metrics.CharacterRecovery
	case boundaryCasinoGold:
		counts = &operationalResults.metrics.CasinoGold
	case boundaryCasinoEP:
		counts = &operationalResults.metrics.CasinoEP
	default:
		return
	}
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
	return operationalResults.metrics
}
