package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

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
