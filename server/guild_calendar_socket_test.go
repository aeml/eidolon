package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func readGuildSocket(t *testing.T, conn *websocket.Conn, match func(guildStatePayload) bool) guildStatePayload {
	t.Helper()
	for messages := 0; messages < 30; messages++ {
		var state guildStatePayload
		resourceReadMessage(t, conn, MsgGuildUpdate, &state)
		if match(state) {
			return state
		}
	}
	t.Fatal("guild did not reach expected calendar or membership state")
	return guildStatePayload{}
}

func TestGuildCalendarActualSocketsConsentAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable Mongo and built server required")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	names := []string{fmt.Sprintf("calendar-a-%d", time.Now().UnixNano()), fmt.Sprintf("calendar-b-%d", time.Now().UnixNano())}
	for _, name := range names {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
		defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": "player-" + name})
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 91, "-save-journal-dir", journal)
	defer stop()
	connections := make([]*websocket.Conn, 2)
	classes := []string{"Fighter", "Cleric"}
	for i, name := range names {
		connections[i], _ = resourceLoginCharacter(t, address, name, name+"-local-only", classes[i])
	}
	resourceSend(t, connections[0], MsgGuildCreate, GuildCreatePayload{Name: "Calendar Witnesses", Tag: "CAL"})
	state := readGuildSocket(t, connections[0], func(s guildStatePayload) bool { return s.Guild != nil })
	guildID := state.Guild.ID
	defer cleanup.Database("eidolon").Collection("guilds").DeleteOne(context.Background(), bson.M{"id": guildID})
	resourceSend(t, connections[0], MsgGuildInvite, GuildTargetPayload{Username: names[1]})
	state = readGuildSocket(t, connections[1], func(s guildStatePayload) bool { return len(s.Invites) == 1 })
	if state.Guild != nil {
		t.Fatal("guild invitation joined member without acceptance")
	}
	resourceSend(t, connections[1], MsgGuildRespond, GuildRespondPayload{GuildID: guildID, Accept: true})
	for _, conn := range connections {
		readGuildSocket(t, conn, func(s guildStatePayload) bool {
			return s.Guild != nil && s.Guild.ID == guildID && len(s.Guild.Members) == 2
		})
	}
	create := database.GuildEventRequest{Action: "create", Title: "Earth Crystal Expedition", Activity: "earth_crystal_raid",
		StartsAt: time.Now().UTC().Add(time.Hour).Truncate(time.Second), DurationMinutes: 60, Capacity: 5}
	resourceSend(t, connections[0], MsgGuildEvent, create)
	state = readGuildSocket(t, connections[1], func(s guildStatePayload) bool { return s.Guild != nil && len(s.Guild.Events) == 1 })
	event := state.Guild.Events[0]
	if event.Title != create.Title || event.Activity != create.Activity || !event.StartsAt.Equal(create.StartsAt) || event.Revision != 1 || len(event.RSVPs) != 0 {
		t.Fatal("new event was not replicated faithfully", event)
	}
	rsvp := database.GuildEventRequest{Action: "rsvp", EventID: event.ID, Revision: event.Revision, Role: "healer", Status: "going"}
	resourceSend(t, connections[1], MsgGuildEvent, rsvp)
	readGuildSocket(t, connections[0], func(s guildStatePayload) bool {
		return s.Guild != nil && len(s.Guild.Events) == 1 && len(s.Guild.Events[0].RSVPs) == 1 && s.Guild.Events[0].RSVPs[0].PlayerID == "player-"+names[1] && s.Guild.Events[0].RSVPs[0].Role == "healer" && s.Guild.Events[0].RSVPs[0].Status == "going"
	})
	// Regular membership does not confer calendar-management authority.
	resourceSend(t, connections[1], MsgGuildEvent, database.GuildEventRequest{Action: "cancel", EventID: event.ID, Revision: event.Revision})
	var rejection string
	resourceReadMessage(t, connections[1], MsgError, &rejection)
	if rejection == "" {
		t.Fatal("member cancellation was not rejected")
	}
	edit := create
	edit.Action, edit.EventID, edit.Revision, edit.StartsAt = "edit", event.ID, event.Revision, create.StartsAt.Add(time.Hour)
	resourceSend(t, connections[0], MsgGuildEvent, edit)
	for _, conn := range connections {
		state = readGuildSocket(t, conn, func(s guildStatePayload) bool {
			return s.Guild != nil && len(s.Guild.Events) == 1 && s.Guild.Events[0].Revision == 2
		})
		e := state.Guild.Events[0]
		if e.Cancelled || !e.StartsAt.Equal(edit.StartsAt) || len(e.RSVPs) != 1 || e.RSVPs[0].Status != "tentative" {
			t.Fatal("reschedule carried old consent or unauthorized cancellation", e)
		}
	}
	resourceSend(t, connections[1], MsgGuildEvent, rsvp)
	resourceReadMessage(t, connections[1], MsgError, &rejection)
	if rejection == "" {
		t.Fatal("stale RSVP accepted after reschedule")
	}
	rsvp.Revision = 2
	resourceSend(t, connections[1], MsgGuildEvent, rsvp)
	readGuildSocket(t, connections[0], func(s guildStatePayload) bool {
		return s.Guild != nil && len(s.Guild.Events) == 1 && len(s.Guild.Events[0].RSVPs) == 1 && s.Guild.Events[0].Revision == 2 && s.Guild.Events[0].RSVPs[0].Status == "going"
	})
	for i, conn := range connections {
		resourceCloseAndWait(t, repo, conn, names[i])
	}
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 92, "-save-journal-dir", journal)
	defer stopAgain()
	for i, name := range names {
		connections[i], _ = resourceLoginCharacter(t, address, name, name+"-local-only", classes[i])
		resourceSend(t, connections[i], MsgGuildGet, map[string]any{})
		state = readGuildSocket(t, connections[i], func(s guildStatePayload) bool {
			return s.Guild != nil && s.Guild.ID == guildID && len(s.Guild.Events) == 1
		})
		e := state.Guild.Events[0]
		if len(state.Guild.Members) != 2 || e.ID != event.ID || e.Revision != 2 || !e.StartsAt.Equal(edit.StartsAt) || len(e.RSVPs) != 1 || e.RSVPs[0].PlayerID != "player-"+names[1] || e.RSVPs[0].Status != "going" || e.RSVPs[0].Role != "healer" {
			t.Fatal("restart lost membership, event or renewed consent", e)
		}
	}
	resourceSend(t, connections[0], MsgGuildEvent, database.GuildEventRequest{Action: "cancel", EventID: event.ID, Revision: 2})
	for _, conn := range connections {
		readGuildSocket(t, conn, func(s guildStatePayload) bool {
			return s.Guild != nil && len(s.Guild.Events) == 1 && s.Guild.Events[0].Cancelled && s.Guild.Events[0].Revision == 3
		})
	}
	for i, conn := range connections {
		saved := resourceCloseAndWait(t, repo, conn, names[i])
		if saved.Level != 1 || saved.XP != 0 || saved.Gold != 0 || saved.EP != 0 {
			t.Fatal("calendar changed progression or currencies")
		}
	}
	t.Log("connected guild invite/accept, shared calendar, management permissions, reschedule consent, stale RSVP rejection, actual restart and cancellation passed")
}
