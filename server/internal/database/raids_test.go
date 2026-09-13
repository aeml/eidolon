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

func TestNextRaidWeekResetMatchesISOWeekBoundary(t *testing.T) {
	for _, date := range []string{"2026-09-13T23:59:59Z", "2026-09-14T00:00:00Z", "2027-01-01T12:00:00Z", "2026-09-13T22:00:00-04:00"} {
		at, err := time.Parse(time.RFC3339, date)
		if err != nil {
			t.Fatal(err)
		}
		reset := NextRaidWeekReset(at)
		if !reset.After(at) || reset.Sub(at) > 7*24*time.Hour || reset.Weekday() != time.Monday || reset.Hour() != 0 || reset.Location() != time.UTC {
			t.Fatalf("invalid reset for %s: %s", date, reset)
		}
		if CurrentRaidWeek(reset) == CurrentRaidWeek(at) || CurrentRaidWeek(reset.Add(-time.Nanosecond)) != CurrentRaidWeek(at) {
			t.Fatalf("displayed reset does not match reward lockout week: %s", reset)
		}
	}
}

func TestWeeklyRaidRewardLookupUnavailableDoesNotPretendAvailable(t *testing.T) {
	for _, store := range []*DB{nil, {}} {
		if claimed, err := store.HasWeeklyRaidReward("hero", time.Now()); claimed || err == nil {
			t.Fatal("unavailable reward store must return an error, not an available cache")
		}
	}
}
