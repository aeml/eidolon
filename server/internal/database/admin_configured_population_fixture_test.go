package database

import (
	"context"
	"os"
	"regexp"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestAdminConfiguredPopulationOwnedMongoFixture(t *testing.T) {
	uri := os.Getenv("EIDOLON_ADMIN_FIXTURE_URI")
	if os.Getenv("EIDOLON_ADMIN_DISPOSABLE_DATABASE") != "1" || !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+$`).MatchString(uri) {
		t.Skip("explicit owned loopback Mongo fixture required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(context.Background())
	// This fixture owns a unique database; the production eidolon database is
	// never opened, migrated or cleared, even when other fixtures share a host.
	database := client.Database("eidolon_admin_fixture_" + primitive.NewObjectID().Hex())
	defer database.Drop(context.Background())
	db := &DB{client: client, adminActivity: database.Collection("admin_activity"), adminActivityRetentionDays: 90}
	now := time.Now().UTC().Truncate(time.Millisecond)
	day := now.Add(-24 * time.Hour).Format("2006-01-02")
	start, _, err := adminActivityDay(day, now, 90)
	if err != nil {
		t.Fatal(err)
	}
	accounts := []string{"ordinary-player", "qa.automation", "qaXautomation", "jump27-abcdef012345", "jump27-player", "codex-fixture"}
	for _, actor := range accounts {
		for i := 0; i < 61; i++ {
			event, err := NewAdminActivity(actor, "", "login", "fixture-login", "success", "Authenticated.", start.Add(time.Hour), 90)
			if err != nil {
				t.Fatal(err)
			}
			if err := db.AppendAdminActivity(event); err != nil {
				t.Fatal(err)
			}
		}
		event, err := NewAdminActivity(actor, "", "disconnect", "fixture-close", "success", "Disconnected.", start.Add(2*time.Hour), 90)
		if err != nil {
			t.Fatal(err)
		}
		opened := start.Add(time.Hour)
		event.SessionStartedAt = &opened
		if err := db.AppendAdminActivity(event); err != nil {
			t.Fatal(err)
		}
	}
	roster := []string{"QA.Automation"}
	for _, population := range []string{"real", "tests", "all"} {
		query := AdminActivityQuery{Population: population, Day: day, TestAccounts: roster}
		want := 3
		if population == "all" {
			want = 6
		}
		seen := map[primitive.ObjectID]bool{}
		for pageNumber := 0; pageNumber < 10; pageNumber++ {
			page, err := db.ReadAdminActivity(query)
			if err != nil {
				t.Fatal(err)
			}
			if pageNumber == 0 {
				if page.Daily == nil || !page.Daily.Complete || page.Daily.UniqueLogins != want || page.Daily.ClosedSessionSeconds != int64(want*3600) {
					t.Fatalf("wrong daily aggregation for %s: %+v", population, page.Daily)
				}
			} else if page.Daily != nil {
				t.Fatal("cursor repeated daily aggregation")
			}
			for _, event := range page.Entries {
				if seen[event.ID] {
					t.Fatal("duplicate cursor entry")
				}
				seen[event.ID] = true
				if !AdminPopulationIncludes(event.Actor, population, roster...) {
					t.Fatalf("wrong population %s", population)
				}
			}
			query.Before = page.Next
			if page.Next == "" {
				break
			}
		}
		if len(seen) != want*62 {
			t.Fatalf("population %s: got %d events, want %d", population, len(seen), want*62)
		}
	}
}
