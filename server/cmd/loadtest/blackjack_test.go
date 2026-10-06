package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func blackjackFixtureView(b *casinoLoad, phase, turn string, revision uint64, funded, done, paid bool) json.RawMessage {
	players := []map[string]interface{}{}
	if funded {
		players = append(players, map[string]interface{}{"playerId": b.blackjack.playerID, "seat": b.seat, "bet": 20, "paid": paid})
	}
	view := map[string]interface{}{"floor": "public", "yourSeat": map[string]interface{}{"tableId": b.table.ID, "seat": b.seat, "sessionId": "synthetic-owner-seat"},
		"blackjack": map[string]interface{}{"available": true, "currency": "gold", "balance": 1000, "roundId": strings.Repeat("a", 32), "phase": phase, "players": players}}
	if phase != "betting" {
		outcome := ""
		if phase == "complete" {
			outcome = "lose"
		}
		view["blackjack"].(map[string]interface{})["round"] = map[string]interface{}{"id": strings.Repeat("a", 32), "phase": phase, "revision": revision, "turnPlayerId": turn, "turnHand": 0, "actions": []string{"stand"},
			"players": []map[string]interface{}{{"playerId": b.blackjack.playerID, "seat": b.seat, "hands": []map[string]interface{}{{"done": done, "outcome": outcome, "payout": 0}}}}}
	}
	encoded, _ := json.Marshal(view)
	return encoded
}

func TestBlackjackLoadActualBotSocketWagerOwnTurnAndPaidResult(t *testing.T) {
	metrics = loadMetrics{}
	b := newBlackjackLoad(0, "player-synthetic-blackjack")
	completed := make(chan struct{})
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error("fixture upgrade failed")
			return
		}
		defer connection.Close()
		_ = connection.SetReadDeadline(time.Now().Add(7 * time.Second))
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
				_ = connection.WriteJSON(Message{Type: "movement_context", Payload: json.RawMessage(`{"movementContext":"synthetic-owner-context"}`)})
				_ = connection.WriteJSON(Message{Type: "casino_update", Payload: blackjackFixtureView(b, "betting", "", 0, false, false, false)})
				state, _ := json.Marshal(map[string]Entity{b.blackjack.playerID: {ID: b.blackjack.playerID, Type: "Player", InstanceID: game.CasinoInstanceID, Health: 100, State: "SEATED", Speed: 5}})
				_ = connection.WriteJSON(Message{Type: "state", Payload: state})
			case "casino":
				var action struct {
					Action, SessionID, RoundID, GameAction string
					RoundRevision                          uint64
					Bet                                    int
				}
				if json.Unmarshal(message.Payload, &action) != nil || action.SessionID != "synthetic-owner-seat" || action.RoundID != strings.Repeat("a", 32) {
					t.Error("lost owner session or round")
					return
				}
				if action.Action == "bet" && action.Bet == 20 {
					_ = connection.WriteJSON(Message{Type: "casino_update", Payload: blackjackFixtureView(b, "playing", b.blackjack.playerID, 1, true, false, false)})
				} else if action.Action == "play" && action.GameAction == "stand" && action.RoundRevision == 1 {
					_ = connection.WriteJSON(Message{Type: "casino_update", Payload: blackjackFixtureView(b, "complete", "", 2, true, true, true)})
					close(completed)
				} else {
					t.Error("unadvertised wager/action")
					return
				}
			}
		}
	}))
	defer server.Close()
	stop, ended := make(chan struct{}), make(chan struct{})
	var observation loadObservation
	go func() {
		runBot(0, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-blackjack", Password: "synthetic-private-password"}, "casino-blackjack", stop, &observation)
		close(ended)
	}()
	select {
	case <-completed:
	case <-time.After(6 * time.Second):
		close(stop)
		t.Fatal("own turn and paid result not reached")
	}
	close(stop)
	select {
	case <-ended:
	case <-time.After(time.Second):
		t.Fatal("blackjack reader did not stop")
	}
	if got := observation.casino; got.wagers != 1 || got.rounds != 1 || got.actions != 1 || got.failed || metrics.readErrors.Load() != 0 || metrics.decodeErrors.Load() != 0 || metrics.admissionErrors.Load() != 0 {
		t.Fatal("connected wager/turn/result evidence or shutdown incorrect")
	}
}

func TestBlackjackLoadAssignmentsCoverDistinctMultiplayerSeats(t *testing.T) {
	seen := map[string]map[int]bool{}
	for index := 0; index < 24; index++ {
		b := newBlackjackLoad(index, "player-synthetic-blackjack")
		if b.failed || b.table.Game != "blackjack" || b.table.Currency != "gold" || b.table.Floor != "public" {
			t.Fatal("invalid public blackjack assignment")
		}
		if seen[b.table.ID] == nil {
			seen[b.table.ID] = map[int]bool{}
		}
		if seen[b.table.ID][b.seat] {
			t.Fatal("two bots assigned same chair")
		}
		seen[b.table.ID][b.seat] = true
	}
	if len(seen) != 4 || !newBlackjackLoad(24, "player-synthetic-blackjack").failed {
		t.Fatal("did not cover exactly four six-seat public tables")
	}
	for _, seats := range seen {
		if len(seats) != 6 {
			t.Fatal("multiplayer table not filled")
		}
	}
}

func TestBlackjackLoadWaitsForOwnBetTurnAndPaidCompletion(t *testing.T) {
	b := newBlackjackLoad(3, "player-synthetic-blackjack")
	now := time.Unix(100, 0)
	me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
	var requests []map[string]interface{}
	request := func(payload map[string]interface{}) error { requests = append(requests, payload); return nil }
	move := func(float64, float64) { t.Fatal("seated player walked") }
	if !b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false)) {
		t.Fatal("fixture view refused")
	}
	b.step(me, now, 20, time.Second, request, move)
	if len(requests) != 1 || requests[0]["action"] != "bet" || requests[0]["sessionId"] != "synthetic-owner-seat" {
		t.Fatal("exact owner wager missing")
	}
	b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false))
	b.step(me, now.Add(500*time.Millisecond), 20, time.Second, request, move)
	if len(requests) != 1 || b.counts().wagers != 0 {
		t.Fatal("unchanged lobby acknowledged or retried wager")
	}
	b.receive(blackjackFixtureView(b, "betting", "", 0, true, false, false))
	if b.counts().wagers != 1 || b.counts().rounds != 0 {
		t.Fatal("accepted wager mistaken for completed round")
	}
	b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 8, true, false, false))
	b.step(me, now.Add(3*time.Second), 20, time.Second, request, move)
	if len(requests) != 2 || len(requests[1]) != 1 || requests[1]["action"] != "get" {
		t.Fatal("peer turn must refresh read-only, not play or retry money")
	}
	b.receive(blackjackFixtureView(b, "playing", b.blackjack.playerID, 8, true, false, false))
	b.step(me, now.Add(6*time.Second), 20, time.Second, request, move)
	if len(requests) != 3 || requests[2]["gameAction"] != "stand" || requests[2]["roundRevision"] != uint64(8) {
		t.Fatal("stand lost advertised turn/revision")
	}
	b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 9, true, false, false))
	if b.counts().actions != 0 {
		t.Fatal("peer revision advance credited owner's unfinished hand")
	}
	b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 10, true, true, false))
	if b.counts().actions != 1 || b.counts().rounds != 0 {
		t.Fatal("own done hand was not observed or prematurely paid")
	}
	b.receive(blackjackFixtureView(b, "complete", "", 11, true, true, false))
	if b.counts().rounds != 0 {
		t.Fatal("unpaid result counted as settled")
	}
	b.receive(blackjackFixtureView(b, "complete", "", 11, true, true, true))
	b.receive(blackjackFixtureView(b, "complete", "", 11, true, true, true))
	if got := b.counts(); got.wagers != 1 || got.rounds != 1 || got.actions != 1 || got.failed {
		t.Fatal("own paid completion or duplicate fence incorrect")
	}
	// A delayed refusal must not disappear just because a shared-table frame
	// cleared pending before its explicit rejection reached the reader.
	b.reject()
	if !b.counts().failed {
		t.Fatal("late rejection was hidden")
	}
}

func TestBlackjackLoadDelayedLobbyCannotReplayFundedWager(t *testing.T) {
	b := newBlackjackLoad(0, "player-synthetic-blackjack")
	now := time.Unix(100, 0)
	me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
	requests := 0
	request := func(payload map[string]interface{}) error {
		if payload["action"] == "get" {
			return nil
		}
		if payload["action"] != "bet" {
			t.Fatal("unexpected money action")
		}
		requests++
		return nil
	}
	b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false))
	b.step(me, now, 20, time.Second, request, func(float64, float64) {})
	b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 1, true, false, false))
	if requests != 1 || b.pending != "" || b.counts().wagers != 1 {
		t.Fatal("missing exact own wager acknowledgement")
	}
	// A lobby view has no round revision, so the same-hand revision guard
	// cannot fence it. The owner already knows this wager was accepted.
	b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false))
	b.step(me, now.Add(4*time.Second), 20, time.Second, request, func(float64, float64) {})
	if requests != 1 || b.pending != "" || b.counts().failed {
		t.Fatal("delayed lobby replayed an already funded wager")
	}
	// A fresh round still requires an ordinary explicit wager; no paid result
	// or current hand completion is invented by suppressing the stale request.
	fresh := strings.ReplaceAll(string(blackjackFixtureView(b, "betting", "", 0, false, false, false)), strings.Repeat("a", 32), strings.Repeat("b", 32))
	b.receive(json.RawMessage(fresh))
	b.step(me, now.Add(8*time.Second), 20, time.Second, request, func(float64, float64) {})
	if requests != 2 || b.pending != "bet" || b.counts().rounds != 0 {
		t.Fatal("fresh wager refused or paid completion invented")
	}
}

func TestBlackjackLoadDelayedViewCannotReplayFinishedHand(t *testing.T) {
	b := newBlackjackLoad(0, "player-synthetic-blackjack")
	now := time.Unix(100, 0)
	me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
	requests := 0
	request := func(payload map[string]interface{}) error {
		if payload["action"] != "get" {
			requests++
		}
		return nil
	}
	move := func(float64, float64) { t.Fatal("seated player walked") }
	b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false))
	b.step(me, now, 20, time.Second, request, move)
	b.receive(blackjackFixtureView(b, "playing", b.blackjack.playerID, 8, true, false, false))
	b.step(me, now.Add(3*time.Second), 20, time.Second, request, move)
	b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 9, true, true, false))
	if requests != 2 || b.pending != "" || b.counts().actions != 1 {
		t.Fatal("normal owner action was not acknowledged")
	}
	// Another sender may queue a snapshot built before the actor's response.
	b.receive(blackjackFixtureView(b, "playing", b.blackjack.playerID, 8, true, false, false))
	b.step(me, now.Add(6*time.Second), 20, time.Second, request, move)
	if requests != 2 || b.view.Blackjack.Round.Revision != 9 || b.counts().actions != 1 || b.failed {
		t.Fatal("older same-seat round replayed the completed owner's action")
	}
}

func TestBlackjackLoadRegressionGuardCannotHideMalformedOrUnfundedViews(t *testing.T) {
	for _, change := range []string{"currency", "balance", "phase", "round-identity", "empty-own-hand", "pending-round", "funded-seat", "seat"} {
		t.Run(change, func(t *testing.T) {
			b := newBlackjackLoad(0, "player-synthetic-blackjack")
			b.receive(blackjackFixtureView(b, "playing", "player-synthetic-peer", 9, true, true, false))
			var incoming casinoLoadView
			json.Unmarshal(blackjackFixtureView(b, "playing", b.blackjack.playerID, 8, true, false, false), &incoming)
			switch change {
			case "currency":
				incoming.Blackjack.Currency = "ep"
			case "balance":
				incoming.Blackjack.Balance = -1
			case "phase":
				incoming.Blackjack.Phase = "forged"
			case "round-identity":
				incoming.Blackjack.Round.ID = "foreign"
			case "empty-own-hand":
				incoming.Blackjack.Round.Players[0].Hands = nil
			case "pending-round":
				b.pending, b.pendingSession, b.blackjack.pendingRound = "bet", incoming.YourSeat.SessionID, "foreign"
			case "funded-seat":
				b.blackjack.fundedRound, b.blackjack.fundedSession = incoming.Blackjack.RoundID, "foreign"
			case "seat":
				incoming.YourSeat.SessionID = "new-seat"
				b.blackjack.fundedRound, b.blackjack.fundedSession = incoming.Blackjack.RoundID, "synthetic-owner-seat"
			}
			payload, _ := json.Marshal(incoming)
			b.receive(payload)
			if !b.failed {
				t.Fatal("revision guard hid malformed/ownership failure")
			}
		})
	}
}

func TestBlackjackLoadExistingHistoryAndForeignOutcomesDoNotProveFreshPlay(t *testing.T) {
	b := newBlackjackLoad(0, "player-synthetic-blackjack")
	b.receive(blackjackFixtureView(b, "complete", "", 11, true, true, true))
	if b.counts().rounds != 0 {
		t.Fatal("existing result used as fresh workload proof")
	}
	b.pending, b.pendingSession = "bet", "synthetic-owner-seat"
	b.blackjack.pendingRound, b.blackjack.pendingBet = strings.Repeat("a", 32), 20
	payload := strings.ReplaceAll(string(blackjackFixtureView(b, "betting", "", 0, true, false, false)), "player-synthetic-blackjack", "player-synthetic-peer")
	b.receive(json.RawMessage(payload))
	if b.counts().wagers != 0 {
		t.Fatal("another player's wager credited this bot")
	}
	bad := strings.ReplaceAll(string(blackjackFixtureView(b, "betting", "", 0, true, false, false)), `"gold"`, `"ep"`)
	b.receive(json.RawMessage(bad))
	if !b.counts().failed {
		t.Fatal("EP table accepted as Gold workload")
	}
}

func TestBlackjackLoadTimeoutAndWrongSeatDoNotRetryMoney(t *testing.T) {
	for _, scenario := range []string{"timeout", "wrong-seat", "wrong-round", "wrong-bet"} {
		t.Run(scenario, func(t *testing.T) {
			b := newBlackjackLoad(0, "player-synthetic-blackjack")
			now := time.Unix(100, 0)
			me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
			requests := 0
			request := func(map[string]interface{}) error { requests++; return nil }
			move := func(float64, float64) { t.Fatal("seated player walked") }
			b.receive(blackjackFixtureView(b, "betting", "", 0, false, false, false))
			b.step(me, now, 20, time.Second, request, move)
			payload := string(blackjackFixtureView(b, "betting", "", 0, true, false, false))
			switch scenario {
			case "wrong-seat":
				payload = strings.ReplaceAll(payload, "synthetic-owner-seat", "synthetic-changed-seat")
			case "wrong-round":
				payload = strings.ReplaceAll(payload, strings.Repeat("a", 32), strings.Repeat("b", 32))
			case "wrong-bet":
				payload = strings.ReplaceAll(payload, `"bet":20`, `"bet":40`)
			}
			if scenario != "timeout" {
				b.receive(json.RawMessage(payload))
			}
			b.step(me, now.Add(2*time.Second), 20, time.Second, request, move)
			b.step(me, now.Add(5*time.Second), 20, time.Second, request, move)
			if got := b.counts(); !got.failed || got.rounds != 0 || requests != 1 {
				t.Fatal("invalid/uncertain wager retried or credited")
			}
		})
	}
}
