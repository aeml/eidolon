package main

import (
	"sync"

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
func recordOperationalResult(boundary operationalBoundary, err error) {
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
}

func operationalMetricsSnapshot() operations.OperationalMetrics {
	operationalResults.Lock()
	defer operationalResults.Unlock()
	return operationalResults.metrics
}
