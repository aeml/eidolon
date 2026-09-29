package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestEconomyMetricsStopFlushesPartialHourOnce(t *testing.T) {
	path := filepath.Join(t.TempDir(), "economy.jsonl")
	w := &game.World{Economy: game.NewEconomyTelemetry(time.Now())}
	stop := startEconomyMetrics(w, path)
	t.Cleanup(stop)
	w.Economy.RecordSource("quest_rewards", 150)
	w.Economy.RecordSink("buyback", 40)
	var callers sync.WaitGroup
	for range 8 {
		callers.Add(1)
		go func() { defer callers.Done(); stop() }()
	}
	callers.Wait()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(raw), "\n") != 1 {
		t.Fatal("shutdown wrote duplicate summaries")
	}
	var got game.EconomySummary
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if got.Sources["quest_rewards"] != 150 || got.Sinks["buyback"] != 40 || got.Net != 110 {
		t.Fatalf("partial-hour activity lost: %+v", got)
	}
}

func TestDisabledEconomyMetricsStopIsSafe(t *testing.T) {
	startEconomyMetrics(nil, "unused")()
	startEconomyMetrics(&game.World{}, "unused")()
	startEconomyMetrics(&game.World{Economy: game.NewEconomyTelemetry(time.Now())}, "")()
}

func TestAppendEconomySummaryWritesJSONLine(t *testing.T) {
	path := filepath.Join(t.TempDir(), "metrics", "economy.jsonl")
	want := game.EconomySummary{PeriodEnd: time.Unix(123, 0).UTC(), SourceTotal: 10, SinkTotal: 3, Net: 7}
	if err := appendEconomySummary(path, want); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var got game.EconomySummary
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if got.SourceTotal != 10 || got.SinkTotal != 3 || got.Net != 7 {
		t.Fatalf("written summary mismatch: %+v", got)
	}
}
