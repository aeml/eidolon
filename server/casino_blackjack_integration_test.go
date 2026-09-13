package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type blackjackSocketProbe struct {
	conn *websocket.Conn
	mu   sync.Mutex
	view blackjackTableView
	err  error
}

func watchBlackjackSocket(conn *websocket.Conn) *blackjackSocketProbe {
	// The short login/seat helper leaves its ten-second read deadline installed.
	// This continuous reader spans the real fifteen-second betting window.
	_ = conn.SetReadDeadline(time.Time{})
	p := &blackjackSocketProbe{conn: conn}
	go func() {
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				p.mu.Lock()
				p.err = err
				p.mu.Unlock()
				return
			}
			var message Message
			if json.Unmarshal(data, &message) != nil {
				continue
			}
			if message.Type == "casino_update" {
				var payload struct {
					Blackjack blackjackTableView `json:"blackjack"`
				}
				if json.Unmarshal(message.Payload, &payload) == nil {
					p.mu.Lock()
					p.view = payload.Blackjack
					p.mu.Unlock()
				}
			}
		}
	}()
	return p
}

func queryBlackjackUntil(t *testing.T, probe *blackjackSocketProbe, match func(blackjackTableView) bool) blackjackTableView {
	t.Helper()
	deadline := time.Now().Add(40 * time.Second)
	for time.Now().Before(deadline) {
		// Respect the normal casino rate limit; no accelerated server timer.
		time.Sleep(2 * time.Second)
		resourceSend(t, probe.conn, MsgCasino, map[string]any{"action": "get"})
		time.Sleep(100 * time.Millisecond)
		probe.mu.Lock()
		view, err := probe.view, probe.err
		probe.mu.Unlock()
		if err != nil {
			t.Fatal("fixture socket closed while awaiting table state", err)
		}
		if match(view) {
			return view
		}
	}
	t.Fatal("blackjack did not reach expected shared state")
	return blackjackTableView{}
}

func TestBlackjackActualSocketsWagersRoundAndPayout(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable loopback server required")
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
	collection := cleanup.Database("eidolon").Collection("casino_blackjack_tables")
	count, err := collection.CountDocuments(context.Background(), bson.M{"_id": publicBlackjackTable})
	if err != nil || count != 0 {
		t.Fatal("fixture requires an unused disposable blackjack table; refusing to overwrite existing rounds", err)
	}
	defer collection.DeleteOne(context.Background(), bson.M{"_id": publicBlackjackTable})
	names := []string{fmt.Sprintf("bj-socket-%d-a", time.Now().UnixNano()), fmt.Sprintf("bj-socket-%d-b", time.Now().UnixNano())}
	ids := []string{"player-" + names[0], "player-" + names[1]}
	defer cleanup.Database("eidolon").Collection("users").DeleteMany(context.Background(), bson.M{"username": bson.M{"$in": names}})
	defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteMany(context.Background(), bson.M{"player_id": bson.M{"$in": ids}})
	table := game.CasinoTables()[0]
	for i, name := range names {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		character := &database.Character{Name: name, Class: "Fighter", Level: 1, Gold: 1000, InstanceID: game.CasinoInstanceID, X: table.Seats[i].ExitX, Z: table.Seats[i].ExitZ,
			ProgressionVersion: game.CurrentProgressionVersion, LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
		if err := repo.SetFirstCharacter(name, character); err != nil {
			t.Fatal(err)
		}
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 41, "-save-journal-dir", journal)
	defer stop()
	connections := make([]*websocket.Conn, 2)
	sessions := make([]string, 2)
	for i, name := range names {
		connections[i], _ = resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
		defer connections[i].Close()
		resourceSend(t, connections[i], MsgCasino, map[string]any{"action": "sit", "tableId": table.ID, "seat": i})
		presence := casinoReadPresence(t, connections[i], func(p game.CasinoPresence) bool { return p.YourSeat != nil })
		sessions[i] = presence.YourSeat.SessionID
	}
	// Drain BOTH sockets continuously, like real clients; leaving the inactive
	// player's world stream unread would test backpressure disconnects instead.
	probes := []*blackjackSocketProbe{watchBlackjackSocket(connections[0]), watchBlackjackSocket(connections[1])}
	initial := queryBlackjackUntil(t, probes[0], func(v blackjackTableView) bool { return v.Available && v.Phase == "betting" })
	for i, conn := range connections {
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "bet", "sessionId": sessions[i], "roundId": initial.RoundID, "bet": 100})
	}
	accepted := queryBlackjackUntil(t, probes[0], func(v blackjackTableView) bool { return len(v.Players) == 2 })
	if accepted.Gold != 900 {
		t.Fatal("wager did not debit normal Gold", accepted.Gold)
	}
	// Replay an accepted bet before the real betting deadline: no second debit.
	resourceSend(t, connections[0], MsgCasino, map[string]any{"action": "bet", "sessionId": sessions[0], "roundId": initial.RoundID, "bet": 100})
	view := queryBlackjackUntil(t, probes[0], func(v blackjackTableView) bool { return v.Round != nil })
	if view.Round.Phase == "playing" && (!view.Round.DealerHidden || len(view.Round.Dealer) != 1) {
		t.Fatal("dealer hole card exposed")
	}
	encoded, _ := json.Marshal(view)
	if strings.Contains(string(encoded), `"deck"`) {
		t.Fatal("private shoe exposed")
	}
	for turns := 0; view.Phase == "playing" && turns < 4; turns++ {
		index := 0
		if view.Round.TurnPlayerID == ids[1] {
			index = 1
		}
		revision := view.Round.Revision
		resourceSend(t, connections[index], MsgCasino, map[string]any{"action": "play", "sessionId": sessions[index], "roundId": view.RoundID, "roundRevision": revision, "gameAction": "stand"})
		view = queryBlackjackUntil(t, probes[0], func(v blackjackTableView) bool { return v.Round != nil && v.Round.Revision > revision })
	}
	view = queryBlackjackUntil(t, probes[0], func(v blackjackTableView) bool { return v.Phase == "complete" })
	if view.Round == nil || view.Round.DealerHidden {
		t.Fatal("completed shared round missing")
	}
	for i, conn := range connections {
		payout := 0
		for _, player := range view.Round.Players {
			if player.PlayerID == ids[i] {
				for _, hand := range player.Hands {
					payout += hand.Payout
				}
			}
		}
		saved := resourceCloseAndWait(t, repo, conn, names[i])
		if saved.Gold != 900+payout || saved.X != table.Seats[i].ExitX || saved.Z != table.Seats[i].ExitZ {
			t.Fatal("payout/exit not durable", saved.Gold, payout)
		}
	}
	stop()
	_, restartStop := compatStartServer(t, binary, uri, 42, "-save-journal-dir", journal)
	defer restartStop()
	for i, name := range names {
		character, err := repo.GetCharacter(name, name)
		if err != nil {
			t.Fatal(err)
		}
		payout := 0
		for _, player := range view.Round.Players {
			if player.PlayerID == ids[i] {
				for _, hand := range player.Hands {
					payout += hand.Payout
				}
			}
		}
		if character.Gold != 900+payout {
			t.Fatal("restart duplicated settlement", character.Gold)
		}
	}
}
