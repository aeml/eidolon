package database

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestAdminPopulationMongoDailyAndImmutableDuration(t *testing.T) {
	if os.Getenv("EIDOLON_ADMIN_DISPOSABLE_DATABASE") != "1" || os.Getenv("MONGO_URI") != "mongodb://127.0.0.1:27017" {
		t.Skip("explicit isolated Mongo fixture required")
	}
	db, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(context.Background())
	now := time.Now().UTC().Truncate(time.Millisecond)
	day := now.Add(-24 * time.Hour).Format("2006-01-02")
	start, _, _ := adminActivityDay(day, now, 90)
	var disconnect AdminActivity
	for _, actor := range []string{"fixture-real", "codex-fixture"} {
		for i := 0; i < 61; i++ {
			event, _ := NewAdminActivity(actor, "", "login", "fixture-login", "success", "Authenticated.", start.Add(time.Hour), 90)
			if err := db.AppendAdminActivity(event); err != nil {
				t.Fatal(err)
			}
		}
		event, _ := NewAdminActivity(actor, "", "disconnect", "fixture-close", "success", "Disconnected.", start.Add(2*time.Hour), 90)
		opened := start.Add(time.Hour)
		event.SessionStartedAt = &opened
		if err := db.AppendAdminActivity(event); err != nil {
			t.Fatal(err)
		}
		if actor == "fixture-real" {
			disconnect = event
		}
	}
	for _, population := range []string{"real", "tests", "all"} {
		page, err := db.ReadAdminActivity(AdminActivityQuery{Population: population, Day: day})
		want := 1
		if population == "all" {
			want = 2
		}
		if err != nil || len(page.Entries) != 50 || page.Next == "" || page.Daily == nil || !page.Daily.Complete ||
			page.Daily.UniqueLogins != want || page.Daily.ClosedSessionSeconds != int64(want*3600) {
			t.Fatal("population/daily database query failed", population, err)
		}
		next, err := db.ReadAdminActivity(AdminActivityQuery{Population: population, Day: day, Before: page.Next})
		if err != nil || len(next.Entries) == 0 || next.Daily != nil {
			t.Fatal("filtered cursor failed", err)
		}
	}
	if err := db.AppendAdminActivity(disconnect); err != nil {
		t.Fatal("duration replay failed", err)
	}
	changed := disconnect
	changed.SessionStartedAt = nil
	if db.AppendAdminActivity(changed) == nil {
		t.Fatal("duration could be removed from immutable record")
	}
	opened := start.Add(30 * time.Minute)
	changed.SessionStartedAt = &opened
	if db.AppendAdminActivity(changed) == nil {
		t.Fatal("duration could be changed in immutable record")
	}
	page, err := db.ReadAdminActivity(AdminActivityQuery{Day: day, Actor: "fixture-real", Action: "disconnect"})
	if err != nil || len(page.Entries) != 1 || page.Daily.UniqueLogins != 1 {
		t.Fatal("daily totals unexpectedly depend on history action", err)
	}
}

func TestAdminPopulationReservedPrefixesAndCursor(t *testing.T) {
	for _, account := range []string{"codex-a", "CODEX-b", "codexq-a", "codexqa-a", "loadtest-a", "resource-journal-a"} {
		if !IsAdminTestAccount(account) || AdminPopulationIncludes(account, "") || !AdminPopulationIncludes(account, "tests") || !AdminPopulationIncludes(account, "all") {
			t.Fatal("test population misclassified")
		}
	}
	for _, account := range []string{"player", "my-codex-character", "administrator", "codex"} {
		if IsAdminTestAccount(account) || !AdminPopulationIncludes(account, "real") || AdminPopulationIncludes(account, "tests") || AdminPopulationIncludes(account, "invalid") {
			t.Fatal("real population misclassified")
		}
	}
	now := time.Now().UTC().Truncate(time.Millisecond)
	event, _ := NewAdminActivity("hero", "", "login", "session-event", "success", "Authenticated.", now, 90)
	for _, population := range []string{"real", "all", "tests"} {
		filter, err := adminActivityFilter(AdminActivityQuery{Population: population, Before: activityCursor(event)}, now, 90)
		if err != nil || len(filter["$or"].(bson.A)) != 2 {
			t.Fatal("population replaced pagination", err)
		}
		if population == "real" && filter["$nor"] == nil || population == "tests" && filter["$and"] == nil {
			t.Fatal("missing population filter")
		}
	}
	if _, err := adminActivityFilter(AdminActivityQuery{Population: "invalid"}, now, 90); err == nil {
		t.Fatal("invalid population accepted")
	}
}

func TestAdminDailyUTCDayAndClosedConnectionClipping(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	start, end, err := adminActivityDay("2026-10-04", now, 90)
	if err != nil {
		t.Fatal(err)
	}
	for _, day := range []string{"2026-10-05", "2026-01-01", "2026-02-30", "bad"} {
		if _, _, err := adminActivityDay(day, now, 90); err == nil {
			t.Fatal("invalid day accepted", day)
		}
	}
	before, late := start.Add(-time.Hour), end.Add(-30*time.Minute)
	events := []AdminActivity{
		{Actor: "a", Action: "login", Result: "success", At: start.Add(time.Minute)},
		{Actor: "a", Action: "login", Result: "success", At: start.Add(2 * time.Minute)},
		{Actor: "b", Action: "login", Result: "success", At: start.Add(3 * time.Minute)},
		{Actor: "c", Action: "resume", Result: "success", At: start.Add(4 * time.Minute)},
		{Actor: "d", Action: "login", Result: "failure", At: start.Add(5 * time.Minute)},
		{Actor: "a", Action: "disconnect", Result: "success", At: start.Add(time.Hour), SessionStartedAt: &before},
		{Actor: "b", Action: "disconnect", Result: "success", At: end.Add(time.Hour), SessionStartedAt: &late},
		{Actor: "legacy", Action: "disconnect", Result: "success", At: start.Add(2 * time.Hour)},
	}
	got := summarizeAdminDaily(events, "2026-10-04", start, end, true)
	if got.UniqueLogins != 2 || got.ClosedSessionSeconds != 5400 || got.MissingDurations != 1 || !got.Complete {
		t.Fatal(got)
	}
	if summarizeAdminDaily(events, "2026-10-04", start, end, false).Complete {
		t.Fatal("partial totals marked complete")
	}
}
