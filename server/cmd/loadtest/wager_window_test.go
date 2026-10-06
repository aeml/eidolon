package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestCasinoWagerWindowUnstartedAndMalformedDeadline(t *testing.T) {
	now := time.Unix(100, 0)
	if !casinoWagerWindowOpen(time.Time{}, now) {
		t.Fatal("unstarted poker/legacy window refused")
	}
	b := newBlackjackLoad(0, "player-synthetic")
	var view map[string]any
	if json.Unmarshal(blackjackFixtureView(b, "betting", "", 0, false, false, false), &view) != nil {
		t.Fatal("fixture decode failed")
	}
	view["blackjack"].(map[string]any)["dealAt"] = "invalid-private-date"
	payload, err := json.Marshal(view)
	if err != nil || b.receive(payload) {
		t.Fatal("malformed deadline accepted")
	}
}

func TestCasinoLoadWagerUsesAdvertisedWindowWithoutWeakeningPaidGate(t *testing.T) {
	for _, family := range []string{"blackjack", "poker", "house-first", "house-second"} {
		for _, remaining := range []time.Duration{-time.Second, 0, time.Second, 2 * time.Second, 2*time.Second + time.Nanosecond, 30 * time.Second} {
			t.Run(family+"/"+remaining.String(), func(t *testing.T) {
				now := time.Unix(100, 0)
				var b *casinoLoad
				var payload json.RawMessage
				field, action, amount := "house", "house_bet", 20
				switch family {
				case "blackjack":
					b = newBlackjackLoad(0, "player-synthetic")
					payload = blackjackFixtureView(b, "betting", "", 0, false, false, false)
					field, action = "blackjack", "bet"
				case "poker":
					b = newPokerLoad(0, "player-synthetic")
					payload = pokerFixtureView(b, "betting", false, false, nil)
					field, action, amount = "poker", "poker_buy_in", 100
				default:
					index := 0
					if family == "house-second" {
						index = 24
					}
					b = newHouseLoad(index, "player-synthetic")
					payload = houseFixtureView(b, "betting", false, false)
				}
				var view map[string]any
				if json.Unmarshal(payload, &view) != nil {
					t.Fatal("fixture decode failed")
				}
				withDeadline := func(deadline time.Time) json.RawMessage {
					view[field].(map[string]any)["dealAt"] = deadline
					encoded, err := json.Marshal(view)
					if err != nil {
						t.Fatal("fixture encode failed")
					}
					return encoded
				}
				requests := 0
				request := func(body map[string]any) error {
					if body["action"] == "get" {
						return nil
					}
					if body["action"] != action {
						t.Fatal("unadvertised action")
					}
					requests++
					return nil
				}
				me := Entity{InstanceID: game.CasinoInstanceID, Health: 100}
				move := func(float64, float64) { t.Fatal("seated fixture walked") }
				if !b.receive(withDeadline(now.Add(remaining))) {
					t.Fatal("valid window rejected")
				}
				b.step(me, now, amount, 5*time.Second, request, move)
				want := 0
				if remaining > 2*time.Second {
					want = 1
				}
				if requests != want || b.counts().failed || b.counts().rounds != 0 {
					t.Fatal("expired/near-expiry wager sent or result invented")
				}
				if want == 0 {
					b.receive(withDeadline(now.Add(30 * time.Second)))
					b.step(me, now.Add(3*time.Second), amount, 5*time.Second, request, move)
					if requests != 1 || b.pending != action || b.counts().rounds != 0 {
						t.Fatal("fresh window refused or paid result invented")
					}
				}
			})
		}
	}
}
