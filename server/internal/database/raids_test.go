package database

import (
	"testing"
	"time"
)

func TestCurrentRaidWeekUsesISOYearBoundary(t *testing.T) {
	if got := CurrentRaidWeek(time.Date(2027, time.January, 1, 12, 0, 0, 0, time.UTC)); got != "2026-W53" {
		t.Fatalf("ISO week = %q, want 2026-W53", got)
	}
}
