package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func houseFixtureView(b *casinoLoad, phase string, funded, paid bool) json.RawMessage {
	spot := "player"
	if b.table.Game == "roulette" {
		spot = "red"
	}
	players := []map[string]interface{}{}
	if funded {
		players = append(players, map[string]interface{}{"playerId": b.house.playerID, "seat": b.seat, "wagers": []game.CasinoWager{{Spot: spot, Amount: 20}}, "paid": paid, "payout": 0})
	}
	view := map[string]interface{}{"floor": "public", "yourSeat": map[string]interface{}{"tableId": b.table.ID, "seat": b.seat, "sessionId": "synthetic-house-seat"},
		"house": map[string]interface{}{"game": b.table.Game, "available": true, "currency": "gold", "balance": 1000, "roundId": strings.Repeat("a", 32), "phase": phase, "players": players}}
	if phase == "complete" {
		house := view["house"].(map[string]interface{})
		if b.table.Game == "roulette" {
			house["number"] = 2
		} else {
			house["baccarat"] = map[string]interface{}{"winner": "banker"}
		}
	}
	encoded, _ := json.Marshal(view)
	return encoded
}

func TestHouseLoadDistinctSeatsAndOwnPaidOutcomeFences(t *testing.T) {
	seen := map[string]map[int]bool{}
	for index := 0; index < 36; index++ {
		b := newHouseLoad(index, "player-synthetic-house")
		if b.failed || b.table.Currency != "gold" || b.table.Floor != "public" {
			t.Fatal("invalid public house assignment")
		}
		if seen[b.table.ID] == nil {
			seen[b.table.ID] = map[int]bool{}
		}
		if seen[b.table.ID][b.seat] {
			t.Fatal("duplicate chair assignment")
		}
		seen[b.table.ID][b.seat] = true
	}
	if len(seen) != 6 || !newHouseLoad(36, "player-synthetic-house").failed {
		t.Fatal("not exactly four baccarat/two roulette tables")
	}
	for _, index := range []int{0, 24} {
		b := newHouseLoad(index, "player-synthetic-house")
		now := time.Unix(100, 0)
		me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
		requests := 0
		request := func(payload map[string]interface{}) error {
			requests++
			wagers := payload["wagers"].([]game.CasinoWager)
			if payload["action"] != "house_bet" || payload["roundId"] != strings.Repeat("a", 32) {
				t.Fatal("lost exact house round")
			}
			if _, err := game.ValidateHouseWagers(b.table.Game, "gold", wagers); err != nil {
				t.Fatal("driver chose illegal wager")
			}
			return nil
		}
		move := func(float64, float64) { t.Fatal("seated player moved") }
		b.receive(houseFixtureView(b, "betting", false, false))
		b.step(me, now, 20, time.Second, request, move)
		b.receive(houseFixtureView(b, "betting", false, false))
		b.step(me, now.Add(500*time.Millisecond), 20, time.Second, request, move)
		if requests != 1 || b.counts().wagers != 0 {
			t.Fatal("unchanged state counted or retried money")
		}
		b.receive(houseFixtureView(b, "revealing", true, false))
		b.receive(houseFixtureView(b, "complete", true, false))
		if b.counts().wagers != 1 || b.counts().rounds != 0 {
			t.Fatal("reveal/unpaid result counted as settled")
		}
		b.receive(houseFixtureView(b, "complete", true, true))
		b.receive(houseFixtureView(b, "complete", true, true))
		if got := b.counts(); got.rounds != 1 || got.wagers != 1 || got.failed {
			t.Fatal("paid result/duplicate fence incorrect")
		}
	}
}

func TestHouseLoadRejectsHistoryForeignWagerAndUncertainActions(t *testing.T) {
	for _, scenario := range []string{"timeout", "wrong-round", "wrong-session", "wrong-wager", "ep", "bad-outcome"} {
		t.Run(scenario, func(t *testing.T) {
			b := newHouseLoad(24, "player-synthetic-house")
			b.receive(houseFixtureView(b, "complete", true, true))
			if b.counts().rounds != 0 {
				t.Fatal("existing history used as fresh proof")
			}
			now := time.Unix(100, 0)
			me := Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}
			requests := 0
			request := func(map[string]interface{}) error { requests++; return nil }
			move := func(float64, float64) { t.Fatal("seated player moved") }
			b.receive(houseFixtureView(b, "betting", false, false))
			b.step(me, now, 20, time.Second, request, move)
			foreign := strings.ReplaceAll(string(houseFixtureView(b, "betting", true, false)), "player-synthetic-house", "player-synthetic-peer")
			b.receive(json.RawMessage(foreign))
			if b.counts().wagers != 0 {
				t.Fatal("peer stake acknowledged own wager")
			}
			payload := string(houseFixtureView(b, "complete", true, true))
			switch scenario {
			case "wrong-round":
				payload = strings.ReplaceAll(payload, strings.Repeat("a", 32), strings.Repeat("b", 32))
			case "wrong-session":
				payload = strings.ReplaceAll(payload, "synthetic-house-seat", "synthetic-other-seat")
			case "wrong-wager":
				payload = strings.ReplaceAll(payload, `"amount":20`, `"amount":40`)
			case "ep":
				payload = strings.ReplaceAll(payload, `"gold"`, `"ep"`)
			case "bad-outcome":
				payload = strings.ReplaceAll(payload, `"number":2`, `"number":99`)
			}
			if scenario != "timeout" {
				b.receive(json.RawMessage(payload))
			}
			b.step(me, now.Add(2*time.Second), 20, time.Second, request, move)
			b.step(me, now.Add(5*time.Second), 20, time.Second, request, move)
			if got := b.counts(); !got.failed || got.rounds != 0 || requests != 1 {
				t.Fatal("invalid/uncertain outcome passed or retried wager")
			}
		})
	}
}

func TestHouseLoadActualBotSocketOwnStakeAndPaidResult(t *testing.T) {
	for _, index := range []int{0, 24} {
		t.Run(newHouseLoad(index, "player-synthetic-house").table.Game, func(t *testing.T) {
			metrics = loadMetrics{}
			b := newHouseLoad(index, "player-synthetic-house")
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
				bets := 0
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
						_ = connection.WriteJSON(Message{Type: "movement_context", Payload: json.RawMessage(`{"movementContext":"synthetic-house-context"}`)})
						_ = connection.WriteJSON(Message{Type: "casino_update", Payload: houseFixtureView(b, "betting", false, false)})
						state, _ := json.Marshal(map[string]Entity{b.house.playerID: {ID: b.house.playerID, Type: "Player", InstanceID: game.CasinoInstanceID, Health: 100, State: "SEATED", Speed: 5}})
						_ = connection.WriteJSON(Message{Type: "state", Payload: state})
					case "casino":
						var action struct {
							Action, SessionID, RoundID string
							Wagers                     []game.CasinoWager
						}
						if json.Unmarshal(message.Payload, &action) != nil || action.Action != "house_bet" || action.SessionID != "synthetic-house-seat" || len(action.Wagers) != 1 {
							t.Error("invalid house action")
							return
						}
						wanted := strings.Repeat("a", 32)
						if bets == 1 {
							wanted = strings.Repeat("b", 32)
						}
						if action.RoundID != wanted {
							t.Error("stale house round")
							return
						}
						if _, err := game.ValidateHouseWagers(b.table.Game, "gold", action.Wagers); err != nil {
							t.Error("illegal house stake")
							return
						}
						bets++
						if bets == 1 {
							_ = connection.WriteJSON(Message{Type: "casino_update", Payload: houseFixtureView(b, "complete", true, true)})
							lobby := strings.ReplaceAll(string(houseFixtureView(b, "betting", false, false)), strings.Repeat("a", 32), strings.Repeat("b", 32))
							_ = connection.WriteJSON(Message{Type: "casino_update", Payload: json.RawMessage(lobby)})
						} else {
							ack := strings.ReplaceAll(string(houseFixtureView(b, "betting", true, false)), strings.Repeat("a", 32), strings.Repeat("b", 32))
							_ = connection.WriteJSON(Message{Type: "casino_update", Payload: json.RawMessage(ack)})
							close(completed)
						}
					}
				}
			}))
			defer server.Close()
			stop, ended := make(chan struct{}), make(chan struct{})
			var observation loadObservation
			go func() {
				runBot(index, "ws"+strings.TrimPrefix(server.URL, "http"), BotCredentials{Username: "synthetic-house", Password: "synthetic-private-password"}, "casino-house", stop, &observation)
				close(ended)
			}()
			select {
			case <-completed:
			case <-time.After(6 * time.Second):
				close(stop)
				t.Fatal("new paid house round not observed")
			}
			close(stop)
			select {
			case <-ended:
			case <-time.After(time.Second):
				t.Fatal("house reader did not stop")
			}
			if got := observation.casino; got.wagers != 2 || got.rounds != 1 || got.failed || metrics.readErrors.Load() != 0 || metrics.decodeErrors.Load() != 0 || metrics.admissionErrors.Load() != 0 {
				t.Fatal("connected house evidence or shutdown incorrect")
			}
		})
	}
}
