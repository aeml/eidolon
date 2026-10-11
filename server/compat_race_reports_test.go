package main

import (
	"strings"
	"testing"
)

func TestCompatRaceReportsKeepStacksWithoutSurroundingApplicationLog(t *testing.T) {
	stack := "WARNING: DATA RACE\nWrite at 0x123 by goroutine 4:\n  game.(*World).Update()\n      /owned/world.go:10 +0x1\n\nPrevious read at 0x123 by goroutine 8:\n  game.(*World).Ability()\n      /owned/ability.go:20 +0x2"
	log := "private account context before\n==================\n" + stack + "\n==================\nprivate session context after"
	if got := compatRaceReports(log); got != "\n"+stack {
		t.Fatalf("race stack lost or application context exposed: %q", got)
	}
	if got := compatRaceReports("application context only"); got != "" {
		t.Fatal("ordinary log was exposed")
	}
}

func TestCompatRaceReportsBoundLargeAndRepeatedDiagnostics(t *testing.T) {
	block := "WARNING: DATA RACE\nWrite at 0x123\n==================\n"
	if got := compatRaceReports(strings.Repeat(block, 10)); strings.Count(got, "WARNING: DATA RACE") != 3 {
		t.Fatal("diagnostic report count is not bounded")
	}
	large := "WARNING: DATA RACE\n" + strings.Repeat("  /owned/stack.go:1\n", 10000) + "\n=================="
	if got := compatRaceReports(large); len(got) > 32*1024 || !strings.HasPrefix(got, "\nWARNING: DATA RACE") {
		t.Fatal("diagnostic byte bound or race header was lost")
	}
	incomplete := "WARNING: DATA RACE\nunfinished stack with private context"
	if got := compatRaceReports(incomplete); !strings.Contains(got, "incomplete race report") || strings.Contains(got, "private context") {
		t.Fatal("incomplete log was exposed instead of a bounded evidence pointer")
	}
	nearLimit := "WARNING: DATA RACE\n" + strings.Repeat("x", 32*1024-40) + "\n==================\n" + incomplete
	if got := compatRaceReports(nearLimit); len(got) > 32*1024 {
		t.Fatal("incomplete evidence pointer exceeded the total diagnostic bound")
	}
}
