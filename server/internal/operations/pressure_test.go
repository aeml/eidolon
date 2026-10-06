package operations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func measuredPressureSample() Sample {
	known := OutcomeCounts{InFlightKnown: true}
	return Sample{Ready: true, Cause: "ready", Runtime: &RuntimeMetrics{
		HeapAllocBytes: 100, Goroutines: 10,
		BroadcastQueues: QueueMetrics{Queued: 7, Capacity: 10, EncounterQueued: 1, EncounterCapacity: 10},
	}, Operational: &OperationalMetrics{CharacterJournal: known, CharacterCommit: known,
		CharacterCleanup: known, CharacterRecovery: known, CasinoGold: known, CasinoEP: known}}
}

func TestPressureBudgetBoundariesAndMissingMetrics(t *testing.T) {
	for _, test := range []struct {
		name    string
		limits  PressureLimits
		elapsed time.Duration
		change  func(*Sample)
		want    string
	}{
		{name: "disabled", change: func(s *Sample) { s.Runtime, s.Operational = nil, nil }},
		{name: "latency-equal", limits: PressureLimits{MaxProbeLatency: time.Millisecond}, elapsed: time.Millisecond},
		{name: "latency-over", limits: PressureLimits{MaxProbeLatency: time.Millisecond}, elapsed: time.Millisecond + 1, want: "latency_budget"},
		{name: "heap-equal", limits: PressureLimits{MaxHeapAllocBytes: 100}},
		{name: "heap-over", limits: PressureLimits{MaxHeapAllocBytes: 99}, want: "heap_budget"},
		{name: "goroutines-equal", limits: PressureLimits{MaxGoroutines: 10}},
		{name: "goroutines-over", limits: PressureLimits{MaxGoroutines: 9}, want: "goroutine_budget"},
		{name: "queue-below", limits: PressureLimits{QueueUtilizationPercent: 80}},
		{name: "queue-equal", limits: PressureLimits{QueueUtilizationPercent: 70}, want: "queue_budget"},
		{name: "encounter-queue", limits: PressureLimits{QueueUtilizationPercent: 80}, change: func(s *Sample) { s.Runtime.BroadcastQueues.EncounterQueued = 8 }, want: "queue_budget"},
		{name: "zero-capacity", limits: PressureLimits{QueueUtilizationPercent: 80}, change: func(s *Sample) { s.Runtime.BroadcastQueues.EncounterCapacity = 0 }, want: "metrics_unavailable"},
		{name: "heap-missing", limits: PressureLimits{MaxHeapAllocBytes: 100}, change: func(s *Sample) { s.Runtime = nil }, want: "metrics_unavailable"},
		{name: "goroutines-missing", limits: PressureLimits{MaxGoroutines: 10}, change: func(s *Sample) { s.Runtime = nil }, want: "metrics_unavailable"},
		{name: "queue-missing", limits: PressureLimits{QueueUtilizationPercent: 80}, change: func(s *Sample) { s.Runtime = nil }, want: "metrics_unavailable"},
		{name: "inflight-equal", limits: PressureLimits{MaxInFlightCalls: 3}, change: func(s *Sample) { s.Operational.CharacterCommit.InFlight, s.Operational.CasinoEP.InFlight = 1, 2 }},
		{name: "inflight-over", limits: PressureLimits{MaxInFlightCalls: 2}, change: func(s *Sample) { s.Operational.CharacterCommit.InFlight, s.Operational.CasinoEP.InFlight = 1, 2 }, want: "inflight_budget"},
		{name: "inflight-missing", limits: PressureLimits{MaxInFlightCalls: 2}, change: func(s *Sample) { s.Operational = nil }, want: "metrics_unavailable"},
		{name: "inflight-partial", limits: PressureLimits{MaxInFlightCalls: 2}, change: func(s *Sample) { s.Operational.CasinoEP.InFlightKnown = false }, want: "metrics_unavailable"},
		{name: "inflight-overflow", limits: PressureLimits{MaxInFlightCalls: ^uint64(0)}, change: func(s *Sample) {
			s.Operational.CharacterCommit.InFlight, s.Operational.CasinoEP.InFlight = ^uint64(0), 1
		}, want: "inflight_budget"},
		{name: "inflight-max-equal", limits: PressureLimits{MaxInFlightCalls: ^uint64(0)}, change: func(s *Sample) { s.Operational.CasinoEP.InFlight = ^uint64(0) }},
	} {
		t.Run(test.name, func(t *testing.T) {
			sample := measuredPressureSample()
			if test.change != nil {
				test.change(&sample)
			}
			if cause := test.limits.cause(sample, test.elapsed); cause != test.want {
				t.Fatalf("cause=%s, want=%s", cause, test.want)
			}
		})
	}
}

func TestPressureQueueRoundingWithoutOverflow(t *testing.T) {
	for _, test := range []struct{ capacity, percent, threshold uint64 }{
		{1, 1, 1}, {3, 50, 2}, {10, 80, 8}, {100, 1, 1}, {101, 1, 2},
		{^uint64(0), 100, ^uint64(0)}, {^uint64(0), 50, uint64(1) << 63},
	} {
		if queueAtBudget(test.threshold-1, test.capacity, test.percent) || !queueAtBudget(test.threshold, test.capacity, test.percent) {
			t.Fatalf("incorrect queue threshold: %+v", test)
		}
	}
}

func TestPressureProbeActualReadyResponseAndFailurePrecedence(t *testing.T) {
	for _, test := range []struct {
		name, status, commit string
		limits               PressureLimits
		missing              bool
		want                 string
	}{
		{"disabled", "ok", "abcdef1", PressureLimits{}, true, "ready"},
		{"heap", "ok", "abcdef1", PressureLimits{MaxHeapAllocBytes: 99}, false, "heap_budget"},
		{"queue", "ok", "abcdef1", PressureLimits{QueueUtilizationPercent: 70}, false, "queue_budget"},
		{"inflight", "ok", "abcdef1", PressureLimits{MaxInFlightCalls: 1}, false, "inflight_budget"},
		{"missing", "ok", "abcdef1", PressureLimits{MaxHeapAllocBytes: 100}, true, "metrics_unavailable"},
		{"not-ready-first", "unavailable", "abcdef1", PressureLimits{MaxHeapAllocBytes: 99}, false, "not_ready"},
		{"identity-first", "ok", "abcdef2", PressureLimits{MaxHeapAllocBytes: 99}, false, "release_mismatch"},
	} {
		t.Run(test.name, func(t *testing.T) {
			sample := measuredPressureSample()
			sample.Operational.CasinoGold.InFlight = 2
			body := map[string]any{"status": test.status, "database": "ready", "commit": test.commit, "version": "Alpha 1.78.0", "private": "private-do-not-copy"}
			if !test.missing {
				body["goroutines"], body["heapAllocBytes"], body["heapObjects"] = sample.Runtime.Goroutines, sample.Runtime.HeapAllocBytes, 1
				body["broadcastQueues"], body["operational"] = sample.Runtime.BroadcastQueues, sample.Operational
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _ = json.NewEncoder(w).Encode(body) }))
			defer server.Close()
			probe, err := NewProbeWithLimits(server.URL+"/healthz", "abcdef1", time.Second, test.limits)
			if err != nil {
				t.Fatal(err)
			}
			got := probe.Check(context.Background())
			encoded, _ := json.Marshal(got)
			if got.Cause != test.want || got.Ready != (test.want == "ready") || strings.Contains(string(encoded), "private") {
				t.Fatalf("unexpected sanitized pressure sample: %+v", got)
			}
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			if got := probe.Check(ctx); got.Cause != "cancelled" || got.Ready {
				t.Fatal("pressure budget replaced cancellation")
			}
		})
	}
}

func TestPressureBudgetConfigurationAndNoticeCompatibility(t *testing.T) {
	for _, limits := range []PressureLimits{{MaxProbeLatency: -1}, {MaxProbeLatency: 2 * time.Second}, {QueueUtilizationPercent: 101}} {
		if _, err := NewProbeWithLimits("http://127.0.0.1/healthz", "", time.Second, limits); err == nil {
			t.Fatal("invalid budget accepted")
		}
	}
	for _, cause := range []string{"latency_budget", "heap_budget", "goroutine_budget", "queue_budget", "inflight_budget", "metrics_unavailable"} {
		detector, _ := NewDetector(1, 1, time.Minute)
		sample := Sample{Cause: cause}
		notice := detector.Observe(sample, time.Now())
		if notice == nil || notice.Cause != cause {
			t.Fatal("pressure cause lost by detector")
		}
		if _, err := alertBody(Event{Sample: sample, Notice: *notice}); err != nil {
			t.Fatal("valid pressure notice rejected by optional alert adapter", err)
		}
	}
}

func TestPressureProbeLatencyIncludesActualResponseBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		select {
		case <-time.After(20 * time.Millisecond):
			_, _ = w.Write([]byte(`{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.78.0"}`))
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	probe, err := NewProbeWithLimits(server.URL+"/healthz", "", time.Second, PressureLimits{MaxProbeLatency: time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	if sample := probe.Check(context.Background()); sample.Ready || sample.Cause != "latency_budget" || sample.LatencyMS < 20 {
		t.Fatalf("whole body latency was not observed: %+v", sample)
	}
}
