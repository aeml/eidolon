package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func casinoReadPresence(t *testing.T, conn *websocket.Conn, matches func(game.CasinoPresence) bool) game.CasinoPresence {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var presence game.CasinoPresence
		resourceReadMessage(t, conn, "casino_update", &presence)
		if matches(presence) {
			return presence
		}
	}
	t.Fatal("casino presence did not reach expected state")
	return game.CasinoPresence{}
}

// Two ordinary authenticated sockets, real token resume and a server restart.
// Uses the existing disposable server helpers; no artificial seat/kill endpoints.
func TestCasinoActualSocketsResumeAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicit disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires disposable loopback Mongo and absolute server binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	cleanupDB, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanupDB.Disconnect(context.Background())
	table := game.CasinoTables()[0]
	names := []string{fmt.Sprintf("casino-seat-%d-a", time.Now().UnixNano()), fmt.Sprintf("casino-seat-%d-b", time.Now().UnixNano())}
	defer func() {
		cleanupDB.Database("eidolon").Collection("users").DeleteMany(context.Background(), bson.M{"username": bson.M{"$in": names}})
		cleanupDB.Database("eidolon").Collection("pvp_profiles").DeleteMany(context.Background(), bson.M{"player_id": bson.M{"$in": []string{"player-" + names[0], "player-" + names[1]}}})
	}()
	for index, name := range names {
		position := table.Seats[index]
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion,
			X: position.ExitX, Z: position.ExitZ, Gold: 1234, LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
		if err := repo.SetFirstCharacter(name, fixture); err != nil {
			t.Fatal(err)
		}
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 31, "-save-journal-dir", journal)
	defer stop()
	a, token := resourceLoginCharacter(t, address, names[0], names[0]+"-local-only", "Fighter")
	b, _ := resourceLoginCharacter(t, address, names[1], names[1]+"-local-only", "Fighter")
	resourceSend(t, a, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0, "playerId": "player-" + names[1]})
	first := casinoReadPresence(t, a, func(p game.CasinoPresence) bool { return p.YourSeat != nil })
	if first.YourSeat.TableID != table.ID || first.YourSeat.Seat != 0 {
		t.Fatal("wrong seat")
	}
	resourceSend(t, b, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 0})
	var rejection string
	resourceReadMessage(t, b, MsgError, &rejection)
	if !strings.Contains(rejection, "occupied") {
		t.Fatal("seat did not remain exclusive", rejection)
	}
	resourceSend(t, b, MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": 1})
	second := casinoReadPresence(t, b, func(p game.CasinoPresence) bool { return p.YourSeat != nil && len(p.Occupants) == 2 })
	encoded, _ := json.Marshal(second)
	if strings.Contains(string(encoded), first.YourSeat.SessionID) {
		t.Fatal("other player's private session leaked")
	}
	resourceSend(t, b, MsgCasino, map[string]any{"action": "ready", "ready": true, "sessionId": first.YourSeat.SessionID})
	resourceReadMessage(t, b, MsgError, &rejection)
	if !strings.Contains(rejection, "session changed") {
		t.Fatal("wrong-session ready accepted", rejection)
	}
	resourceSend(t, a, MsgCasino, map[string]any{"action": "ready", "ready": true, "sessionId": first.YourSeat.SessionID, "revision": second.Preparation[table.ID].Revision})
	casinoReadPresence(t, a, func(p game.CasinoPresence) bool { return p.YourSeat != nil && p.YourSeat.Ready })
	saved := resourceCloseAndWait(t, repo, a, names[0])
	if saved.X != table.Seats[0].ExitX || saved.Z != table.Seats[0].ExitZ || saved.Gold != 1234 {
		t.Fatal("disconnect saved chair coordinate or altered Gold")
	}
	resourceSend(t, b, MsgCasino, map[string]any{"action": "get"})
	casinoReadPresence(t, b, func(p game.CasinoPresence) bool {
		for _, o := range p.Occupants {
			if o.PlayerID == "player-"+names[0] {
				return !o.Connected && !o.Ready
			}
		}
		return false
	})
	resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
	resourceReadMessage(t, resumed, MsgResumeSession, nil)
	resumedPresence := casinoReadPresence(t, resumed, func(p game.CasinoPresence) bool { return p.YourSeat != nil })
	if resumedPresence.YourSeat.SessionID != first.YourSeat.SessionID || resumedPresence.YourSeat.Ready {
		t.Fatal("resume lost seat or retained readiness")
	}
	resourceSend(t, b, MsgCasino, map[string]any{"action": "leave", "sessionId": second.YourSeat.SessionID})
	casinoReadPresence(t, b, func(p game.CasinoPresence) bool { return p.YourSeat == nil })
	resourceCloseAndWait(t, repo, b, names[1])
	resourceCloseAndWait(t, repo, resumed, names[0])
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 32, "-save-journal-dir", journal)
	defer stopAgain()
	returned, _ := resourceLoginCharacter(t, address, names[0], names[0]+"-local-only", "Fighter")
	resourceSend(t, returned, MsgCasino, map[string]any{"action": "get"})
	casinoReadPresence(t, returned, func(p game.CasinoPresence) bool { return p.YourSeat == nil && len(p.Occupants) == 0 })
	restarted := resourceCloseAndWait(t, repo, returned, names[0])
	if restarted.X != table.Seats[0].ExitX || restarted.Z != table.Seats[0].ExitZ || restarted.Gold != 1234 {
		t.Fatal("restart failed safe exit recovery")
	}
}
