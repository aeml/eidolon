package database

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"
)

func TestGuildClearActualMongoRetainsOriginalSeasonAndEarliestClear(t *testing.T) {
	uri := os.Getenv("EIDOLON_ARENA_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable Mongo required")
	}
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicitly disposable loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close(context.Background()) })
	at := time.Date(2026, 9, 30, 23, 59, 59, 0, time.UTC)
	run := GuildDungeonRun{GuildID: fmt.Sprintf("guild-clear-%d", time.Now().UnixNano()), GuildName: "Recorded Watch", GuildTag: "TEST",
		DungeonType: fmt.Sprintf("fixture-%d", time.Now().UnixNano()), Difficulty: "normal", RunLevel: 30, DurationMS: 120000, MemberCount: 4,
		FirstClearAt: at} // Omitted season must derive from completion, not replay.
	for range 2 {
		if err := db.RecordGuildDungeonRun(run); err != nil {
			t.Fatal(err)
		}
	}
	older := run
	older.FirstClearAt, older.DurationMS, older.MemberCount = at.Add(-time.Hour), 180000, 2
	if err := db.RecordGuildDungeonRun(older); err != nil {
		t.Fatal(err)
	}
	next := run
	next.FirstClearAt, next.DurationMS = at.Add(2*time.Second), 150000
	if err := db.RecordGuildDungeonRun(next); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		at       time.Time
		season   string
		duration int64
		first    time.Time
	}{{at, "2026-Q3", 120000, older.FirstClearAt}, {next.FirstClearAt, "2026-Q4", 150000, next.FirstClearAt}} {
		runs, err := db.GuildDungeonLeaderboard(run.DungeonType, run.Difficulty, run.RunLevel, 20, tc.at)
		if err != nil || len(runs) != 1 || runs[0].Season != tc.season || runs[0].DurationMS != tc.duration ||
			!runs[0].FirstClearAt.Equal(tc.first) || runs[0].MemberCount != 4 {
			t.Fatal("replay changed season, earliest clear, fastest time or member count", runs, err)
		}
	}
	conflict := run
	conflict.Season = "2026-Q4"
	if err := db.RecordGuildDungeonRun(conflict); err == nil {
		t.Fatal("completion accepted a mismatched explicit season")
	}
}
