package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func TestCasinoLoadSharedTablesRefreshIdleViewsWithoutMoneyRetries(t *testing.T) {
	for _, kind := range []string{"blackjack", "house", "poker"} {
		t.Run(kind, func(t *testing.T) {
			var b *casinoLoad
			var view json.RawMessage
			switch kind {
			case "blackjack":
				b = newBlackjackLoad(0, "player-synthetic-refresh")
				view = blackjackFixtureView(b, "betting", "", 1, true, false, false)
			case "house":
				b = newHouseLoad(0, "player-synthetic-refresh")
				view = houseFixtureView(b, "betting", true, false)
			case "poker":
				b = newPokerLoad(0, "player-synthetic-refresh")
				view = pokerFixtureView(b, "betting", true, false, nil)
			}
			if !b.receive(view) || b.counts().failed {
				t.Fatal("valid funded waiting view refused")
			}
			me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
			now := time.Unix(100, 0)
			requests := 0
			query := func(payload map[string]interface{}) error {
				requests++
				if len(payload) != 1 || payload["action"] != "get" {
					t.Fatal("cached funded view retried a monetary action")
				}
				return nil
			}
			move := func(float64, float64) { t.Fatal("seated bot moved") }
			b.step(me, now, 100, time.Second, query, move)
			b.step(me, now.Add(time.Second), 100, time.Second, query, move)
			b.step(me, now.Add(3*time.Second), 100, time.Second, query, move)
			if requests != 2 || b.counts().wagers != 0 || b.counts().rounds != 0 {
				t.Fatal("idle refresh pacing or outcome evidence incorrect")
			}
			b.pending, b.sentAt = "poker_play", now.Add(4*time.Second)
			b.step(me, now.Add(6*time.Second), 100, 10*time.Second, query, move)
			if requests != 2 {
				t.Fatal("outstanding operation duplicated a query or money request")
			}
			b.pending = ""
			b.step(me, now.Add(7*time.Second), 100, time.Second, func(map[string]interface{}) error { return errors.New("synthetic write failure") }, move)
			if !b.counts().failed {
				t.Fatal("read-only refresh write failure hidden")
			}
		})
	}
	// The controller itself already polls an unavailable view. The shared
	// fallback must not emit a second query on the same tick.
	b := newPokerLoad(0, "player-synthetic-unavailable")
	b.receive(pokerFixtureView(b, "betting", true, false, nil))
	b.view.Poker.Available = false
	requests := 0
	b.step(Entity{InstanceID: game.CasinoInstanceID, Health: 100}, time.Unix(100, 0), 100, time.Second, func(map[string]interface{}) error { requests++; return nil }, func(float64, float64) { t.Fatal("seated bot moved") })
	if requests != 1 {
		t.Fatal("unavailable table emitted duplicate refreshes")
	}
}

func casinoFixtureView(table, session string, revision uint64, bonus bool, balance int) json.RawMessage {
	encoded, _ := json.Marshal(map[string]interface{}{
		"floor": "public", "yourSeat": map[string]interface{}{"tableId": table, "sessionId": session},
		"slots": map[string]interface{}{"currency": "gold", "available": true, "balance": balance,
			"session": map[string]interface{}{"revision": revision, "bonus": bonus, "last": map[string]interface{}{"bonusPicked": 0, "free": false, "payout": 0}}},
	})
	return encoded
}

func TestCasinoLoadDistinctPublicMachinesAndExactOutcomeAcknowledgements(t *testing.T) {
	seen := map[string]bool{}
	for index := 0; index < 32; index++ {
		b := newCasinoLoad(index)
		if b.failed || seen[b.table.ID] || b.table.Floor != "public" || b.table.Currency != "gold" {
			t.Fatal("machine assignment overlaps or uses EP")
		}
		seen[b.table.ID] = true
	}
	if !newCasinoLoad(32).failed {
		t.Fatal("invented a33rd public slot machine")
	}
	b := newCasinoLoad(0)
	now := time.Unix(100, 0)
	me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
	var requests []map[string]interface{}
	request := func(payload map[string]interface{}) error { requests = append(requests, payload); return nil }
	move := func(float64, float64) { t.Fatal("seated bot tried walking") }
	if !b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 4, false, 1000)) {
		t.Fatal("fixture view refused")
	}
	b.step(me, now, 20, time.Second, request, move)
	if len(requests) != 1 || requests[0]["action"] != "slot_spin" || requests[0]["roundRevision"] != uint64(4) {
		t.Fatal("spin lost exact revision")
	}
	b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 4, false, 1000))
	b.step(me, now.Add(500*time.Millisecond), 20, time.Second, request, move)
	if len(requests) != 1 || b.counts().spins != 0 {
		t.Fatal("unchanged state counted a spin or retried wager")
	}
	b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 5, true, 980))
	b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 5, true, 980))
	if b.counts().spins != 1 {
		t.Fatal("duplicate acknowledgement changed completed count")
	}
	b.step(me, now.Add(3*time.Second), 20, time.Second, request, move)
	if len(requests) != 2 || requests[1]["action"] != "slot_bonus" || requests[1]["choice"] != 0 {
		t.Fatal("bonus choice not submitted through normal action")
	}
	b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 6, false, 980))
	if got := b.counts(); got.spins != 1 || got.bonuses != 1 || got.failed {
		t.Fatal("bonus outcome not acknowledged")
	}
	b.step(me, now.Add(6*time.Second), 20, time.Second, request, move)
	b.receive(json.RawMessage(strings.ReplaceAll(string(casinoFixtureView(b.table.ID, "synthetic-seat", 7, false, 980)), `"free":false`, `"free":true`)))
	if got := b.counts(); got.spins != 2 || got.paidSpins != 1 {
		t.Fatal("free spin mislabeled as paid Gold workload")
	}
}

func TestCasinoLoadRejectsUncertainWagersAndNeverInventsBankroll(t *testing.T) {
	for _, scenario := range []string{"timeout", "rejected", "wrong-session", "revision-gap", "ep", "bankrupt"} {
		t.Run(scenario, func(t *testing.T) {
			b := newCasinoLoad(0)
			now := time.Unix(100, 0)
			me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
			balance := 1000
			if scenario == "bankrupt" {
				balance = 0
			}
			b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 4, false, balance))
			requests := 0
			request := func(map[string]interface{}) error { requests++; return nil }
			move := func(float64, float64) { t.Fatal("seated bot moved") }
			b.step(me, now, 20, time.Second, request, move)
			switch scenario {
			case "rejected":
				b.reject()
			case "wrong-session":
				b.receive(casinoFixtureView(b.table.ID, "synthetic-other", 5, false, 980))
			case "revision-gap":
				b.receive(casinoFixtureView(b.table.ID, "synthetic-seat", 6, false, 980))
			case "ep":
				b.receive(json.RawMessage(strings.ReplaceAll(string(casinoFixtureView(b.table.ID, "synthetic-seat", 5, false, 980)), `"gold"`, `"ep"`)))
			}
			b.step(me, now.Add(5*time.Second), 20, time.Second, request, move)
			b.step(me, now.Add(10*time.Second), 20, time.Second, request, move)
			want := 1
			if scenario == "bankrupt" {
				want = 0
			}
			if got := b.counts(); !got.failed || got.spins != 0 || requests != want {
				t.Fatal("failed workload retried money change, invented Gold or counted outcome")
			}
		})
	}
}

func TestCasinoLoadWalksToDoorAndSeatBeforeNormalRequests(t *testing.T) {
	b := newCasinoLoad(0)
	now := time.Unix(100, 0)
	var actions []string
	var destinations [][2]float64
	request := func(payload map[string]interface{}) error {
		actions = append(actions, payload["action"].(string))
		return nil
	}
	move := func(x, z float64) { destinations = append(destinations, [2]float64{x, z}) }
	me := Entity{Health: 100, Speed: 5, X: 0, Z: 200}
	b.step(me, now, 20, time.Second, request, move)
	if len(actions) != 0 || destinations[0] != [2]float64{0, 180} {
		t.Fatal("did not approach town casino door")
	}
	me.Z = 181
	b.step(me, now, 20, time.Second, request, move)
	if len(actions) != 1 || actions[0] != "enter" {
		t.Fatal("normal enter request missing")
	}
	me.InstanceID = game.CasinoInstanceID
	b.step(me, now.Add(3*time.Second), 20, time.Second, request, move)
	position := b.table.Seats[0]
	if len(actions) != 1 || destinations[1] != [2]float64{position.ExitX, position.ExitZ} {
		t.Fatal("did not approach physical machine")
	}
	me.X, me.Z = position.ExitX, position.ExitZ
	b.step(me, now.Add(3*time.Second), 20, time.Second, request, move)
	if len(actions) != 2 || actions[1] != "sit" {
		t.Fatal("normal sit request missing")
	}
}

func TestCasinoLoadActualBotSocketUsesAcknowledgedRevision(t *testing.T) {
	metrics = loadMetrics{}
	table := newCasinoLoad(0).table
	secondSpin := make(chan struct{})
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error("fixture upgrade failed")
			return
		}
		defer connection.Close()
		_ = connection.SetReadDeadline(time.Now().Add(7 * time.Second))
		spins := 0
		for {
			var message Message
			if connection.ReadJSON(&message) != nil {
				return
			}
			switch message.Type {
			case "register":
				_ = connection.WriteJSON(Message{Type: "error", Payload: json.RawMessage(`"Registration successful! Please login."`)})
			case "login":
				_ = connection.WriteJSON(Message{Type: "login_success", Payload: json.RawMessage(`{"hasCharacter":true,"characterType":"Wizard"}`)})
			case "join":
				_ = connection.WriteJSON(Message{Type: "movement_context", Payload: json.RawMessage(`{"movementContext":"synthetic-seat-context"}`)})
				_ = connection.WriteJSON(Message{Type: "casino_update", Payload: casinoFixtureView(table.ID, "synthetic-seat", 0, false, 1000)})
				state, _ := json.Marshal(map[string]Entity{"player-synthetic-casino": {ID: "player-synthetic-casino", Type: "Player", InstanceID: game.CasinoInstanceID, Health: 100, State: "SEATED", Speed: 5}})
				_ = connection.WriteJSON(Message{Type: "state", Payload: state})
			case "casino":
				var action struct {
					Action, SessionID string
					RoundRevision     uint64
					Bet               int
				}
				if json.Unmarshal(message.Payload, &action) != nil || action.Action != "slot_spin" || action.SessionID != "synthetic-seat" || action.RoundRevision != uint64(spins) || action.Bet != 20 {
					t.Error("driver sent incorrect wager/revision")
					return
				}
				spins++
				_ = connection.WriteJSON(Message{Type: "casino_update", Payload: casinoFixtureView(table.ID, "synthetic-seat", uint64(spins), false, 1000-20*spins)})
				if spins == 2 {
					close(secondSpin)
				}
			}
		}
	}))
	defer server.Close()
	stop, ended := make(chan struct{}), make(chan struct{})
	var observation loadObservation
	go func() {
		runBot(0, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-casino", Password: "synthetic-private-password"}, "casino-slots", stop, &observation)
		close(ended)
	}()
	select {
	case <-secondSpin:
	case <-time.After(6 * time.Second):
		close(stop)
		t.Fatal("acknowledged next spin was not submitted")
	}
	close(stop)
	select {
	case <-ended:
	case <-time.After(time.Second):
		t.Fatal("casino reader did not stop")
	}
	if got := observation.casino; got.spins != 2 || got.bonuses != 0 || got.failed || metrics.readErrors.Load() != 0 || metrics.decodeErrors.Load() != 0 || metrics.admissionErrors.Load() != 0 {
		t.Fatal("actual socket outcome evidence or shutdown incorrect")
	}
}

func TestCasinoLoadShutdownBoundsOutstandingAcknowledgement(t *testing.T) {
	b := newCasinoLoad(0)
	b.pending = "slot_spin"
	b.awaitSettled(make(chan struct{}), 10*time.Millisecond)
	if !b.counts().failed {
		t.Fatal("unacknowledged final wager was hidden on shutdown")
	}
	b = newCasinoLoad(0)
	b.pending = "slot_bonus"
	done := make(chan struct{})
	close(done)
	b.awaitSettled(done, time.Second)
	if !b.counts().failed {
		t.Fatal("closed reader passed outstanding bonus")
	}
}
