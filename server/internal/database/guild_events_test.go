package database

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func calendarFixture() (*Guild, GuildEventRequest, time.Time) {
	now := time.Date(2026, 9, 13, 10, 0, 0, 0, time.UTC)
	guild := &Guild{ID: "calendar", Members: []GuildMember{
		{PlayerID: "leader", Username: "Leader", Rank: GuildRankLeader},
		{PlayerID: "officer", Username: "Officer", Rank: GuildRankOfficer},
		{PlayerID: "member", Username: "Member", Rank: GuildRankMember},
	}}
	return guild, GuildEventRequest{Action: "create", Title: "Verdant expedition", Activity: "verdant_bastion_catacombs", StartsAt: now.Add(time.Hour), DurationMinutes: 120, Capacity: 2}, now
}

func TestGuildEventAuthorityCapacityAndRescheduling(t *testing.T) {
	guild, request, now := calendarFixture()
	for _, actor := range []string{"outsider", "member"} {
		if applyGuildEvent(guild, actor, request, now) == nil {
			t.Fatal("unauthorized creation", actor)
		}
	}
	if err := applyGuildEvent(guild, "officer", request, now); err != nil {
		t.Fatal(err)
	}
	id := guild.Events[0].ID
	rsvp := GuildEventRequest{Action: "rsvp", EventID: id, Revision: 1, Role: "tank", Status: "going"}
	for _, actor := range []string{"leader", "officer"} {
		if err := applyGuildEvent(guild, actor, rsvp, now); err != nil {
			t.Fatal(err)
		}
	}
	if applyGuildEvent(guild, "member", rsvp, now) == nil {
		t.Fatal("overbooked event")
	}
	rsvp.Status = "tentative"
	if err := applyGuildEvent(guild, "member", rsvp, now); err != nil {
		t.Fatal(err)
	}
	if len(guild.Events[0].RSVPs) != 3 {
		t.Fatal("missing sign-ups")
	}
	request.Action, request.EventID, request.Revision = "edit", id, 1
	request.StartsAt = now.Add(2 * time.Hour)
	if applyGuildEvent(guild, "member", request, now) == nil {
		t.Fatal("member edited event")
	}
	if err := applyGuildEvent(guild, "leader", request, now); err != nil {
		t.Fatal(err)
	}
	for _, r := range guild.Events[0].RSVPs {
		if r.Status != "tentative" {
			t.Fatal("reschedule retained promise")
		}
	}
	if applyGuildEvent(guild, "leader", request, now) == nil {
		t.Fatal("stale edit accepted")
	}
	if applyGuildEvent(guild, "member", rsvp, now) == nil {
		t.Fatal("stale consent accepted")
	}
	rsvp.Revision = 2
	if err := applyGuildEvent(guild, "member", rsvp, now); err != nil {
		t.Fatal(err)
	}
	if err := applyGuildEvent(guild, "member", GuildEventRequest{Action: "withdraw", EventID: id}, now); err != nil {
		t.Fatal(err)
	}
	if len(guild.Events[0].RSVPs) != 2 {
		t.Fatal("withdraw did not remove only caller")
	}
	if err := applyGuildEvent(guild, "leader", GuildEventRequest{Action: "cancel", EventID: id, Revision: 2}, now); err != nil {
		t.Fatal(err)
	}
	if applyGuildEvent(guild, "member", rsvp, now) == nil {
		t.Fatal("joined cancelled event")
	}
}

func TestGuildEventBoundsAndDetachedViews(t *testing.T) {
	for _, change := range []func(*GuildEventRequest){
		func(r *GuildEventRequest) { r.Title = "<bad>\n" }, func(r *GuildEventRequest) { r.Title = "x" },
		func(r *GuildEventRequest) { r.Capacity = 101 }, func(r *GuildEventRequest) { r.DurationMinutes = 0 },
		func(r *GuildEventRequest) { r.StartsAt = r.StartsAt.Add(100 * 24 * time.Hour) },
	} {
		guild, request, now := calendarFixture()
		change(&request)
		if applyGuildEvent(guild, "leader", request, now) == nil {
			t.Fatal("invalid event accepted", request)
		}
	}
	guild, request, now := calendarFixture()
	for i := 0; i < 20; i++ {
		if err := applyGuildEvent(guild, "leader", request, now); err != nil {
			t.Fatal(err)
		}
	}
	if applyGuildEvent(guild, "leader", request, now) == nil {
		t.Fatal("unbounded calendar")
	}
	guild.Events[0].RSVPs = []GuildEventRSVP{{PlayerID: "leader", Role: "tank"}, {PlayerID: "departed", Role: "healer"}}
	view := VisibleGuildEvents(guild, now)
	if len(view[0].RSVPs) != 1 {
		t.Fatal("departed member visible")
	}
	view[0].RSVPs[0].Role = "damage"
	if guild.Events[0].RSVPs[0].Role != "tank" {
		t.Fatal("view aliases saved state")
	}
	if len(VisibleGuildEvents(guild, now.Add(8*24*time.Hour))) != 0 {
		t.Fatal("old calendar retained")
	}
}

func TestGuildEventMongoPersistenceAndConcurrentSeats(t *testing.T) {
	uri := os.Getenv("EIDOLON_GUILD_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("requires explicit disposable guild Mongo")
	}
	if !strings.HasPrefix(uri, "mongodb://127.0.0.1:") {
		t.Fatal("requires isolated loopback Mongo")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.client.Disconnect(context.Background()) })
	guild, request, now := calendarFixture()
	guild.ID = uniqueID("calendar")
	guild.NameKey = guild.ID
	guild.Tag = randomGuildTag(t)
	guild.Version = 1
	for i := range guild.Members {
		guild.Members[i].PlayerID = uniqueID(guild.Members[i].PlayerID)
	}
	leader := guild.Members[0].PlayerID
	guild.LeaderID = leader
	if _, err := db.guilds.InsertOne(context.Background(), guild); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.guilds.DeleteOne(context.Background(), bson.M{"id": guild.ID}) })
	created, err := db.ChangeGuildEvent(leader, request, now)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 3)
	for _, member := range guild.Members {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			_, err := db.ChangeGuildEvent(id, GuildEventRequest{Action: "rsvp", EventID: created.Events[0].ID, Revision: 1, Role: "flexible", Status: "going"}, now)
			results <- err
		}(member.PlayerID)
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		}
	}
	if success != 2 {
		t.Fatal("seat authority", success)
	}
	if _, err := db.SetGuildMOTD(leader, "Calendar persists alongside guild management"); err != nil {
		t.Fatal(err)
	}
	loaded, err := db.GetGuildByID(guild.ID)
	if err != nil || len(loaded.Events) != 1 || len(loaded.Events[0].RSVPs) != 2 || loaded.MOTD == "" {
		t.Fatal("calendar was not durably preserved", err)
	}
	if _, err := db.ChangeGuildEvent("outsider", request, now); err == nil {
		t.Fatal("outsider mutation")
	}
}
