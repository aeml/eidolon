package database

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestAdminActivityRetentionAndValidation(t *testing.T) {
	for raw, want := range map[string]int{"": 90, "7": 7, "90": 90, "365": 365} {
		got, err := ParseAdminActivityRetention(raw)
		if err != nil || got != want {
			t.Fatal(raw, got, err)
		}
	}
	for _, raw := range []string{"0", "6", "366", "-1", "forever", "7.5"} {
		if _, err := ParseAdminActivityRetention(raw); err == nil {
			t.Fatal(raw)
		}
	}
	event, err := NewAdminActivity("operator", "", "admin_players", "test-request", "success", "Online players refreshed.", time.Now(), 90)
	if err != nil || event.ExpiresAt.Sub(event.At) != 90*24*time.Hour || event.At.Nanosecond()%1_000_000 != 0 {
		t.Fatal(event, err)
	}
	for _, change := range []func(*AdminActivity){
		func(e *AdminActivity) { e.Actor = "" }, func(e *AdminActivity) { e.Action = "raw_logs" },
		func(e *AdminActivity) { e.Summary = strings.Repeat("x", 257) }, func(e *AdminActivity) { e.Summary = "token\nlog" },
		func(e *AdminActivity) { e.Result = "maybe" }, func(e *AdminActivity) { e.RequestID = "" },
		func(e *AdminActivity) { e.Reason = strings.Repeat("x", 161) }, func(e *AdminActivity) { e.Reason = "bad\nreason" },
	} {
		invalid := event
		change(&invalid)
		if ValidateAdminActivity(invalid) == nil {
			t.Fatal(invalid)
		}
	}
}

func TestAdminActivityLegacyAccountNamesRemainAuditable(t *testing.T) {
	for _, username := range []string{strings.Repeat("legacy", 20), "legacy\naccount"} {
		event, err := NewAdminActivity(username, "", "login", "session-request", "success", "Account authenticated.", time.Now(), 90)
		if err != nil || !strings.HasPrefix(event.Actor, "sha256:") || len(event.Actor) != 71 {
			t.Fatal(event.Actor, err)
		}
		if _, err := adminActivityFilter(AdminActivityQuery{Actor: event.Actor}, time.Now(), 90); err != nil {
			t.Fatal(err)
		}
		if AdminActivityAccountKey(event.Actor) == event.Actor {
			t.Fatal("a literal digest-shaped username collides with another account's key")
		}
	}
	if got := AdminActivityAccountKey("ordinary-account"); got != "ordinary-account" {
		t.Fatal(got)
	}
}

func TestAdminActivityFilterUsesTimestampAndIDAndExcludesExpiredRows(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Millisecond)
	event, _ := NewAdminActivity("operator", "", "login", "session-event", "success", "Authenticated login.", now, 90)
	filter, err := adminActivityFilter(AdminActivityQuery{Before: activityCursor(event), Actor: "operator", Action: "login"}, now, 90)
	if err != nil || filter["actor"] != "operator" || filter["action"] != "login" || filter["expires_at"] == nil || filter["at"] == nil {
		t.Fatal(filter, err)
	}
	clauses := filter["$or"].(bson.A)
	if len(clauses) != 2 || clauses[1].(bson.M)["_id"].(bson.M)["$lt"] != event.ID {
		t.Fatal(filter)
	}
	for _, q := range []AdminActivityQuery{{Before: "bad cursor"}, {Before: strings.Repeat("a", 161)}, {Actor: strings.Repeat("a", 65)}, {Action: "raw_logs"}} {
		if _, err := adminActivityFilter(q, now, 90); err == nil {
			t.Fatal(q)
		}
	}
}

func TestAdminActivityMongoImmutableReplayPaginationAndExpiry(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI required for isolated activity integration")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(context.Background())
	actor := fmt.Sprintf("audit-test-%d", time.Now().UnixNano())
	defer db.adminActivity.DeleteMany(context.Background(), bson.M{"actor": actor})
	now := time.Now().UTC().Truncate(time.Millisecond)
	var first AdminActivity
	for index := 0; index < 61; index++ {
		event, _ := NewAdminActivity(actor, "", "admin_players", fmt.Sprintf("audit-request-%03d", index), "success", "Online players refreshed.", now, 90)
		if err := db.AppendAdminActivity(event); err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			first = event
		}
	}
	if err := db.AppendAdminActivity(first); err != nil {
		t.Fatal("identical replay", err)
	}
	conflict := first
	conflict.Summary = "Changed event"
	if db.AppendAdminActivity(conflict) == nil {
		t.Fatal("immutable event replaced")
	}
	expired, _ := NewAdminActivity(actor, "", "login", "expired-event", "success", "Authenticated login.", now.Add(-100*24*time.Hour), 90)
	if err := db.AppendAdminActivity(expired); err != nil {
		t.Fatal(err)
	}
	page, err := db.ReadAdminActivity(AdminActivityQuery{Actor: actor})
	if err != nil || len(page.Entries) != 50 || page.Next == "" {
		t.Fatal(page, err)
	}
	seen := map[string]bool{}
	for _, row := range page.Entries {
		seen[row.ID.Hex()] = true
		if row.ID == expired.ID {
			t.Fatal("expired row visible before TTL deletion")
		}
	}
	second, err := db.ReadAdminActivity(AdminActivityQuery{Actor: actor, Before: page.Next})
	if err != nil || len(second.Entries) != 11 || second.Next != "" {
		t.Fatal(second, err)
	}
	for _, row := range second.Entries {
		if seen[row.ID.Hex()] {
			t.Fatal("duplicate on next page")
		}
		seen[row.ID.Hex()] = true
	}
	if len(seen) != 61 {
		t.Fatal("pagination lost rows")
	}
	// A fresh repository sees the same durable records, not a process-local log.
	reopened, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	if result, err := reopened.ReadAdminActivity(AdminActivityQuery{Actor: actor, Action: "admin_players"}); err != nil || len(result.Entries) != 50 {
		t.Fatal(result, err)
	}
	indexes, err := db.adminActivity.Indexes().List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var specs []bson.M
	if err := indexes.All(context.Background(), &specs); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, index := range specs {
		if index["name"] == "admin_activity_expiry" {
			found = true
			if index["expireAfterSeconds"] != int32(0) {
				t.Fatal(index)
			}
		}
	}
	if !found {
		t.Fatal("missing expiry index")
	}
}
