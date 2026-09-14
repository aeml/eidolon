package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
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

type pokerSocketPresence struct {
	game.CasinoPresence
	Poker pokerTableView `json:"poker"`
}

func readPokerSocket(t *testing.T, conn *websocket.Conn, match func(pokerSocketPresence) bool) pokerSocketPresence {
	t.Helper()
	// Pace fixture actions and poll at the actual controller's three-second
	// cadence. Consume intervening snapshots instead of adding a query for every
	// stale queued response; production's casino rate limit remains unchanged.
	time.Sleep(750 * time.Millisecond)
	until := time.Now().Add(25 * time.Second)
	nextPoll := time.Time{}
	conn.SetReadDeadline(until)
	for time.Now().Before(until) {
		if !time.Now().Before(nextPoll) {
			resourceSend(t, conn, MsgCasino, map[string]any{"action": "get"})
			nextPoll = time.Now().Add(3 * time.Second)
		}
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == MsgError {
			t.Fatalf("poker session rejected: %s", message.Payload)
		}
		if message.Type != "casino_update" {
			continue
		}
		raw := message.Payload
		var view pokerSocketPresence
		if err := json.Unmarshal(raw, &view); err != nil {
			t.Fatal(err)
		}
		// Only yourSeat contains a token. The poker projection never contains a
		// deck, burns or a private participant session, even after showdown.
		var fields map[string]json.RawMessage
		json.Unmarshal(raw, &fields)
		poker := string(fields["poker"])
		if strings.Contains(poker, "sessionId") || strings.Contains(poker, "\"deck\"") || strings.Contains(poker, "\"burns\"") {
			t.Fatal("private poker state leaked over socket")
		}
		if match(view) {
			return view
		}
	}
	t.Fatal("poker socket did not reach expected state")
	return pokerSocketPresence{}
}

func TestPokerActualSocketsHandAcrossRestart(t *testing.T) {
	testPokerActualSocketsHandAcrossRestart(t, false)
}

func TestVIPPokerActualSocketsHandAcrossRestart(t *testing.T) {
	testPokerActualSocketsHandAcrossRestart(t, true)
}

// Use the ordinary guard and movement protocol on every login. Saved upstairs
// coordinates deliberately restore downstairs; they are not an access grant.
func approachVIPPokerSocket(t *testing.T, conn *websocket.Conn, seat int) {
	t.Helper()
	resourceSend(t, conn, MsgCasino, map[string]any{"action": "vip"})
	var floor struct {
		Upstairs bool `json:"upstairs"`
	}
	resourceReadMessage(t, conn, "casino_floor", &floor)
	if !floor.Upstairs {
		t.Fatal("valid membership did not authorize upstairs access")
	}
	var movement struct {
		Context string `json:"movementContext"`
	}
	resourceReadMessage(t, conn, MsgMovementContext, &movement)
	if movement.Context == "" {
		t.Fatal("stairs omitted movement context")
	}
	table, _ := game.CasinoTableByID("vip-poker")
	point := table.Seats[seat]
	for step := 1; step <= 20; step++ {
		time.Sleep(350 * time.Millisecond)
		fraction := float64(step) / 20
		resourceSend(t, conn, MsgMove, MovePayload{MovementContext: movement.Context,
			X: point.ExitX * fraction, Y: 8, Z: 140 + (point.ExitZ-140)*fraction,
			State: "RUNNING", Sequence: uint64(step)})
	}
}

func testPokerActualSocketsHandAcrossRestart(t *testing.T, vip bool) {
	t.Helper()
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
	tableID, currency, buyInStep, initialTotal := publicPokerTable, "gold", 100, 1000
	if vip {
		tableID, currency, buyInStep, initialTotal = "vip-poker", "ep", 20, 200
	}
	table, ok := game.CasinoTableByID(tableID)
	if !ok {
		t.Fatal("missing poker table", tableID)
	}
	if _, err := repo.GetBlackjackTable(tableID); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatal("disposable poker table must be unused", err)
	}
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": tableID})
	names := []string{fmt.Sprintf("poker-a-%d", time.Now().UnixNano()), fmt.Sprintf("poker-b-%d", time.Now().UnixNano())}
	for i, name := range names {
		defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
		defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": "player-" + name})
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		point := table.Seats[i]
		fixture := &database.Character{Name: name, Class: "Fighter", Level: 1, ProgressionVersion: game.CurrentProgressionVersion, InstanceID: game.CasinoInstanceID, X: point.ExitX, Z: point.ExitZ, Gold: 500, LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10}, Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}
		if vip {
			fixture.X, fixture.Z = 0, 153
			period, err := database.NewVIPPeriod(time.Now().Add(-time.Hour), time.Now().AddDate(0, 1, 0))
			if err != nil {
				t.Fatal(err)
			}
			if added, err := repo.ProvisionVIPPeriod(name, period); err != nil || !added {
				t.Fatal("fixture membership provisioning failed", err)
			}
			// No EP grant: the real membership refresh must award exactly 100.
		}
		if err := repo.SetFirstCharacter(name, fixture); err != nil {
			t.Fatal(err)
		}
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 61, "-save-journal-dir", journal)
	defer stop()
	conns := make([]*websocket.Conn, 2)
	seats := make([]string, 2)
	for i, name := range names {
		conn, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
		conns[i] = conn
		defer conn.Close()
		if vip {
			approachVIPPokerSocket(t, conn, i)
		}
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "sit", "tableId": tableID, "seat": i})
		v := readPokerSocket(t, conn, func(v pokerSocketPresence) bool { return v.YourSeat != nil && v.Poker.Available })
		if v.Poker.Currency != currency || (vip && (v.Poker.Balance != 100 || v.Poker.MaxBuyIn != 100)) {
			t.Fatal("incorrect floor currency, allowance or limit", v.Poker.Currency, v.Poker.Balance, v.Poker.MaxBuyIn)
		}
		seats[i] = v.YourSeat.SessionID
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "poker_buy_in", "sessionId": seats[i], "roundId": v.Poker.RoundID, "bet": buyInStep * (i + 1)})
		readPokerSocket(t, conn, func(v pokerSocketPresence) bool { return len(v.Poker.Players) == i+1 && !v.Poker.Processing })
		if i == 0 {
			v = readPokerSocket(t, conn, func(v pokerSocketPresence) bool { return v.Poker.Phase == "betting" })
			if v.Poker.Round != nil {
				t.Fatal("solo poker dealt a hand")
			}
		}
	}
	first := readPokerSocket(t, conns[0], func(v pokerSocketPresence) bool { return v.Poker.Phase == "playing" })
	other := readPokerSocket(t, conns[1], func(v pokerSocketPresence) bool { return v.Poker.Phase == "playing" })
	if first.Poker.Round.Players[1].Cards[0] != -1 || other.Poker.Round.Players[0].Cards[0] != -1 {
		t.Fatal("opponent's cards visible")
	}
	ownCards := append([]int(nil), first.Poker.Round.Players[0].Cards...)
	for i, conn := range conns {
		resourceCloseAndWait(t, repo, conn, names[i])
	}
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 62, "-save-journal-dir", journal)
	defer stopAgain()
	for i, name := range names {
		conn, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
		conns[i] = conn
		defer conn.Close()
		if vip {
			approachVIPPokerSocket(t, conn, i)
		}
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "sit", "tableId": tableID, "seat": i})
		v := readPokerSocket(t, conn, func(v pokerSocketPresence) bool { return v.YourSeat != nil && v.Poker.Phase == "playing" })
		if v.YourSeat.SessionID == seats[i] || v.Poker.Round.ID != first.Poker.Round.ID || v.Poker.Round.Revision != first.Poker.Round.Revision {
			t.Fatal("restart lost hand or reused obsolete seat token")
		}
		if i == 0 && !reflect.DeepEqual(v.Poker.Round.Players[0].Cards, ownCards) {
			t.Fatal("restart reshuffled private hand")
		}
		seats[i] = v.YourSeat.SessionID
	}
	view := first.Poker
	for actions := 0; view.Phase == "playing"; actions++ {
		if actions > 12 {
			t.Fatal("check/call hand did not finish")
		}
		i := 0
		if view.Round.TurnPlayerID == "player-"+names[1] {
			i = 1
		}
		current := readPokerSocket(t, conns[i], func(v pokerSocketPresence) bool {
			return v.Poker.Round != nil && v.Poker.Round.Revision >= view.Round.Revision
		})
		action := "check"
		if current.Poker.Round.CallAmount > 0 {
			action = "call"
		}
		request := map[string]any{"action": "poker_play", "sessionId": seats[i], "roundId": view.RoundID, "roundRevision": view.Round.Revision, "gameAction": action}
		resourceSend(t, conns[i], MsgCasino, request)
		next := readPokerSocket(t, conns[i], func(v pokerSocketPresence) bool {
			return v.Poker.Round != nil && v.Poker.Round.Revision > view.Round.Revision
		})
		if actions == 0 {
			resourceSend(t, conns[i], MsgCasino, request)
			var rejection string
			resourceReadMessage(t, conns[i], MsgError, &rejection)
			if !strings.Contains(rejection, "changed") {
				t.Fatal("replayed turn was not rejected", rejection)
			}
		}
		view = next.Poker
	}
	complete := readPokerSocket(t, conns[0], func(v pokerSocketPresence) bool { return v.Poker.Phase == "complete" && !v.Poker.Processing })
	if len(complete.Poker.Round.Board) != 5 {
		t.Fatal("hand did not reach showdown")
	}
	total := 0
	for i, conn := range conns {
		resourceSend(t, conn, MsgCasino, map[string]any{"action": "leave", "sessionId": seats[i]})
		readPokerSocket(t, conn, func(v pokerSocketPresence) bool { return v.YourSeat == nil })
		saved := resourceCloseAndWait(t, repo, conn, names[i])
		if vip {
			total += saved.EP
			if saved.Gold != 500 || len(saved.GoldCreditReceipts) != 0 || len(saved.EPCasinoReceipts) != 2 || len(saved.VIPAllowanceReceipts) != 1 {
				t.Fatal("EP poker changed Gold, lost casino receipts or repeated membership allowance")
			}
			continue
		}
		total += saved.Gold
		if len(saved.GoldCreditReceipts) != 2 {
			t.Fatal("buy-in/cash-out receipt count changed")
		}
	}
	if total != initialTotal {
		t.Fatal("two-player socket poker created or lost currency", currency, total)
	}
	t.Logf("two-player %s poker: shared deal, private cards, guard/restart/reseat, replay rejection, showdown, cash-out and conserved total=%d", currency, total)
}

// Release-only shared presence check using the real clock and event scheduler.
// Prepared approach positions are not an earned clear or wave-combat proof.
func TestPublicEventActualSharedSockets(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("explicit disposable server required")
	}
	now := time.Now()
	phase := now.Unix() % int64(game.PublicEventPeriod/time.Second)
	if phase < 60 || phase > 450 {
		t.Skip("run during an active event window; do not accelerate the production clock")
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
	if _, err := repo.GetBlackjackTable(publicPokerTable); !errors.Is(err, mongo.ErrNoDocuments) {
		t.Fatal("disposable poker table must be unused", err)
	}
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Disconnect(context.Background())
	defer cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": publicPokerTable})
	site := game.PublicEventSites()[(now.Unix()/int64(game.PublicEventPeriod/time.Second))%4]
	names := []string{fmt.Sprintf("event-a-%d", now.UnixNano()), fmt.Sprintf("event-b-%d", now.UnixNano())}
	for i, name := range names {
		defer cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
		defer cleanup.Database("eidolon").Collection("pvp_profiles").DeleteOne(context.Background(), bson.M{"player_id": "player-" + name})
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
			t.Fatal(err)
		}
		x, z := site.X+float64(i)*2, site.Z
		if site.ID == "tide" {
			x = site.X - 10 + 20*float64(i)
		}
		if site.ID == "ember" {
			x = site.X + 16
		}
		fixture := &database.Character{Name: name, Class: "Fighter", Level: 100, ProgressionVersion: game.CurrentProgressionVersion, X: x, Z: z, Gold: 500, LastDailyQuest: now, Stats: database.Stats{Strength: 100, Dexterity: 100, Intelligence: 100, Vitality: 100, Wisdom: 100}, Resources: &database.CharacterResources{Version: 1, Health: 1000, Mana: 500}}
		if err := repo.SetFirstCharacter(name, fixture); err != nil {
			t.Fatal(err)
		}
	}
	address, stop := compatStartServer(t, binary, uri, 63, "-save-journal-dir", t.TempDir())
	defer stop()
	conns := []*websocket.Conn{}
	for _, name := range names {
		conn, _ := resourceLoginCharacter(t, address, name, name+"-local-only", "Fighter")
		conns = append(conns, conn)
		defer conn.Close()
	}
	views := []game.PublicEventView{}
	for _, conn := range conns {
		matched := false
		for attempts := 0; attempts < 10; attempts++ {
			var view game.PublicEventView
			resourceReadMessage(t, conn, "public_event", &view)
			if view.Site.ID == site.ID && view.Participants == 2 && view.Phase == "defending" && view.Wave == 1 && view.Remaining > 0 {
				views = append(views, view)
				matched = true
				break
			}
		}
		if !matched {
			t.Fatal("two nearby players did not receive the active shared encounter")
		}
	}
	if views[0].ID != views[1].ID || views[0].StartsAt != views[1].StartsAt || views[0].EndsAt != views[1].EndsAt {
		t.Fatal("players saw different event schedules")
	}
	for i, conn := range conns {
		saved := resourceCloseAndWait(t, repo, conn, names[i])
		if saved.Gold != 500 {
			t.Fatal("joining an event granted unintended Gold")
		}
	}
	t.Logf("shared_event=%s realm=%s participants=%d wave=%d remaining=%d", views[0].ID, site.Realm, views[0].Participants, views[0].Wave, views[0].Remaining)
}
