package operations

import (
	"errors"
	"time"
)

// PressureLimits are explicitly chosen monitor budgets, not server limits or
// capacity promises. Zero disables each check. The game health response and
// financial behavior are never changed by these external observations.
type PressureLimits struct {
	MaxProbeLatency         time.Duration
	MaxHeapAllocBytes       uint64
	MaxGoroutines           uint64
	QueueUtilizationPercent uint64
	MaxInFlightCalls        uint64
}

func (limits PressureLimits) validate(timeout time.Duration) error {
	if limits.MaxProbeLatency < 0 || limits.MaxProbeLatency > timeout || limits.QueueUtilizationPercent > 100 {
		return errors.New("invalid monitor pressure budgets")
	}
	return nil
}

// Check only a successfully decoded, ready, matching release. Missing required
// measurements are unavailable, not measured zero. Lifetime failures/maxima
// are deliberately not pressure triggers: they cannot demonstrate recovery.
func (limits PressureLimits) cause(sample Sample, elapsed time.Duration) string {
	if limits.MaxProbeLatency > 0 && elapsed > limits.MaxProbeLatency {
		return "latency_budget"
	}
	if limits.MaxHeapAllocBytes > 0 || limits.MaxGoroutines > 0 || limits.QueueUtilizationPercent > 0 {
		if sample.Runtime == nil {
			return "metrics_unavailable"
		}
		if limits.MaxHeapAllocBytes > 0 && sample.Runtime.HeapAllocBytes > limits.MaxHeapAllocBytes {
			return "heap_budget"
		}
		if limits.MaxGoroutines > 0 && sample.Runtime.Goroutines > limits.MaxGoroutines {
			return "goroutine_budget"
		}
		if percent := limits.QueueUtilizationPercent; percent > 0 {
			queues := sample.Runtime.BroadcastQueues
			if queues.Capacity == 0 || queues.EncounterCapacity == 0 {
				return "metrics_unavailable"
			}
			if queueAtBudget(queues.Queued, queues.Capacity, percent) || queueAtBudget(queues.EncounterQueued, queues.EncounterCapacity, percent) {
				return "queue_budget"
			}
		}
	}
	if limits.MaxInFlightCalls > 0 {
		// Existing custody/persistence budget covers its original six boundaries.
		// Frame phases are diagnostic timings, not additional financial calls.
		if sample.Operational == nil {
			return "metrics_unavailable"
		}
		metrics := sample.Operational
		counts := []OutcomeCounts{metrics.CharacterJournal, metrics.CharacterCommit, metrics.CharacterCleanup,
			metrics.CharacterRecovery, metrics.CasinoGold, metrics.CasinoEP}
		for _, count := range counts {
			if !count.InFlightKnown {
				return "metrics_unavailable"
			}
		}
		var total uint64
		for _, count := range counts {
			if count.InFlight > limits.MaxInFlightCalls-total {
				return "inflight_budget" // Compare before addition, including uint64 extremes.
			}
			total += count.InFlight
		}
	}
	return ""
}

func queueAtBudget(queued, capacity, percent uint64) bool {
	// ceil(capacity * percent / 100), without overflowing the product.
	threshold := capacity/100*percent + (capacity%100*percent+99)/100
	return queued >= threshold
}
