package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func pokerFixtureView(b *casinoLoad, phase string, funded, paid bool, round *game.PokerRound) json.RawMessage {
	players := []map[string]interface{}{}
	if funded {
		players = append(players, map[string]interface{}{"playerId": b.poker.playerID, "seat": b.seat, "buyIn": 100, "paid": paid})
	}
	v := map[string]interface{}{"available": true, "currency": "gold", "balance": 1000,
		"phase": phase, "roundId": strings.Repeat("a", 32), "players": players}
	if round != nil {
		v["round"] = round.View(b.poker.playerID)
	}
	payload, _ := json.Marshal(map[string]interface{}{"floor": "public", "yourSeat": map[string]interface{}{
		"tableId": b.table.ID, "seat": b.seat, "sessionId": "synthetic-poker-seat"}, "poker": v})
	return payload
}

func TestPokerLoadDistinctSeatsAndNoStrandedSinglePlayer(t *testing.T) {
	seen := map[string]map[int]bool{}
	for i := 0; i < 24; i++ {
		b := newPokerLoad(i, "player-synthetic-poker")
		if b.failed || b.table.Floor != "public" || b.table.Currency != "gold" || b.table.Game != "poker" {
			t.Fatal("non-public poker assignment")
		}
		if seen[b.table.ID] == nil {
			seen[b.table.ID] = map[int]bool{}
		}
		if seen[b.table.ID][b.seat] {
			t.Fatal("duplicate poker seat")
		}
		seen[b.table.ID][b.seat] = true
	}
	if len(seen) != 4 || !newPokerLoad(24, "player-synthetic-poker").failed || !newPokerLoad(-1, "player-synthetic-poker").failed {
		t.Fatal("wrong poker catalog boundary")
	}
	for n := 0; n <= 25; n++ {
		want := n >= 2 && n <= 24 && n != 7 && n != 13 && n != 19
		if validPokerClientCount(n) != want {
			t.Fatal("one player could be stranded without a real opponent", n)
		}
	}
}

// Actual domain rules/deck/actions, not persistence or socket/load acceptance.
func TestPokerLoadTwoPlayersPlayRealRuleHandThroughPaidCompletion(t *testing.T) {
	now := time.Unix(100, 0)
	bots := []*casinoLoad{newPokerLoad(0, "player-synthetic-a"), newPokerLoad(1, "player-synthetic-b")}
	entries := []game.PokerEntry{}
	me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
	move := func(float64, float64) { t.Fatal("seated bot moved") }
	for _, b := range bots {
		b.receive(pokerFixtureView(b, "betting", false, false, nil))
		b.step(me, now, 100, time.Second, func(payload map[string]interface{}) error {
			if payload["action"] != "poker_buy_in" || payload["bet"] != 100 || payload["roundId"] != strings.Repeat("a", 32) {
				t.Fatal("illegal or wrong-round buy-in")
			}
			return nil
		}, move)
		peer := strings.ReplaceAll(string(pokerFixtureView(b, "betting", true, false, nil)), b.poker.playerID, "player-synthetic-peer")
		b.receive(json.RawMessage(peer))
		if b.counts().wagers != 0 {
			t.Fatal("peer buy-in acknowledged own stake")
		}
		b.receive(pokerFixtureView(b, "betting", true, false, nil))
		entries = append(entries, game.PokerEntry{PlayerID: b.poker.playerID, Seat: b.seat, BuyIn: 100})
	}
	round, err := game.NewPokerRoundForCurrency(strings.Repeat("a", 32), entries, -1, now, "gold")
	if err != nil {
		t.Fatal("real poker setup failed", err)
	}
	for steps := 0; round.Phase == "playing"; steps++ {
		if steps >= 30 {
			t.Fatal("check/call hand failed to progress")
		}
		for _, b := range bots {
			b.receive(pokerFixtureView(b, "playing", true, false, round))
		}
		now = now.Add(3 * time.Second)
		var next *game.PokerRound
		for _, b := range bots {
			b.step(me, now, 100, 15*time.Second, func(payload map[string]interface{}) error {
				if next != nil || payload["action"] != "poker_play" || payload["sessionId"] != "synthetic-poker-seat" || payload["roundId"] != round.ID {
					t.Fatal("peer/wrong-session action or multiple own actions")
				}
				var proposeErr error
				next, proposeErr = round.Propose(b.poker.playerID, payload["gameAction"].(string), payload["bet"].(int), payload["roundRevision"].(uint64), now)
				return proposeErr
			}, move)
			if b.pending == "poker_play" {
				beforeActions := b.counts().actions
				peerRevision := *round
				peerRevision.Revision++
				b.receive(pokerFixtureView(b, "playing", true, false, &peerRevision))
				if b.pending != "poker_play" || b.counts().actions != beforeActions {
					t.Fatal("peer revision alone acknowledged own turn")
				}
			}
		}
		if next == nil {
			t.Fatal("no legal own-turn action")
		}
		round = next
	}
	if err := round.Validate(); err != nil {
		t.Fatal("bot actions corrupted real poker round", err)
	}
	for _, b := range bots {
		historical := newPokerLoad(b.seat, b.poker.playerID)
		historical.receive(pokerFixtureView(b, "complete", true, true, round))
		if historical.counts().rounds != 0 {
			t.Fatal("paid historical hand counted without new funding")
		}
		b.receive(pokerFixtureView(b, "settling", true, false, round))
		b.receive(pokerFixtureView(b, "complete", true, false, round))
		if b.counts().rounds != 0 {
			t.Fatal("unpaid showdown counted as completion")
		}
		b.receive(pokerFixtureView(b, "complete", true, true, round))
		b.receive(pokerFixtureView(b, "complete", true, true, round))
		if got := b.counts(); got.failed || got.wagers != 1 || got.rounds != 1 || got.actions < 1 {
			t.Fatal("fresh paid owner round evidence incorrect", got)
		}
		retained, _ := json.Marshal(b.view)
		if strings.Contains(strings.ToLower(string(retained)), "cards") || strings.Contains(strings.ToLower(string(retained)), "besthand") {
			t.Fatal("load observations retained private cards or hand descriptions")
		}
	}
}

func TestPokerLoadRejectsHistoricalAndUncertainFunding(t *testing.T) {
	for _, scenario := range []string{"timeout", "wrong-round", "wrong-session", "wrong-buy-in", "ep", "insufficient", "illegal-buy-in", "late-error"} {
		t.Run(scenario, func(t *testing.T) {
			b := newPokerLoad(0, "player-synthetic-poker")
			now := time.Unix(100, 0)
			me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
			move := func(float64, float64) { t.Fatal("seated bot moved") }
			requests := 0
			request := func(map[string]interface{}) error { requests++; return nil }
			b.receive(pokerFixtureView(b, "complete", true, true, nil))
			if b.counts().wagers != 0 || b.counts().rounds != 0 {
				t.Fatal("historical state counted as new play")
			}
			lobby := string(pokerFixtureView(b, "betting", false, false, nil))
			buyIn := 100
			if scenario == "insufficient" {
				lobby = strings.ReplaceAll(lobby, `"balance":1000`, `"balance":0`)
			}
			if scenario == "illegal-buy-in" {
				buyIn = 20
			}
			b.receive(json.RawMessage(lobby))
			b.step(me, now, buyIn, time.Second, request, move)
			ack := string(pokerFixtureView(b, "betting", true, false, nil))
			switch scenario {
			case "wrong-round":
				ack = strings.ReplaceAll(ack, strings.Repeat("a", 32), strings.Repeat("b", 32))
			case "wrong-session":
				ack = strings.ReplaceAll(ack, "synthetic-poker-seat", "synthetic-other-seat")
			case "wrong-buy-in":
				ack = strings.ReplaceAll(ack, `"buyIn":100`, `"buyIn":200`)
			case "ep":
				ack = strings.ReplaceAll(ack, `"gold"`, `"ep"`)
			case "late-error":
				b.receive(json.RawMessage(ack))
				b.reject()
			}
			if scenario != "timeout" && scenario != "insufficient" && scenario != "illegal-buy-in" {
				b.receive(json.RawMessage(ack))
			}
			b.step(me, now.Add(2*time.Second), buyIn, time.Second, request, move)
			b.step(me, now.Add(5*time.Second), buyIn, time.Second, request, move)
			if got := b.counts(); !got.failed || got.rounds != 0 || requests > 1 {
				t.Fatal("uncertain funding retried or accepted as completed play", got)
			}
		})
	}
}
