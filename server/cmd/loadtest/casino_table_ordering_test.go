package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestCasinoOrderingFenceSurvivesUnavailableAndSavingFeedback(t *testing.T) {
	for _, kind := range []string{"blackjack", "house", "poker"} {
		for _, feedback := range []string{"unavailable", "missing-version", "older-saving", "newer-saving"} {
			t.Run(kind+"/"+feedback, func(t *testing.T) {
				var b *casinoLoad
				var data json.RawMessage
				switch kind {
				case "blackjack":
					b = newBlackjackLoad(0, "player-synthetic-order")
					data = blackjackFixtureView(b, "betting", "", 0, false, false, false)
				case "house":
					b = newHouseLoad(0, "player-synthetic-order")
					data = houseFixtureView(b, "betting", false, false)
				case "poker":
					b = newPokerLoad(0, "player-synthetic-order")
					data = pokerFixtureView(b, "betting", false, false, nil)
				}
				frame := func(version string, available, processing bool) json.RawMessage {
					var payload map[string]interface{}
					if err := json.Unmarshal(data, &payload); err != nil {
						t.Fatal(err)
					}
					state := payload[kind].(map[string]interface{})
					state["tableId"], state["tableVersion"] = b.table.ID, version
					state["available"], state["processing"] = available, processing
					if version == "" {
						delete(state, "tableVersion")
						delete(state, "roundId")
					}
					encoded, err := json.Marshal(payload)
					if err != nil {
						t.Fatal(err)
					}
					return encoded
				}
				if !b.receive(frame("22", true, false)) {
					t.Fatal("ready view rejected")
				}
				version, available, processing := "21", false, false
				if feedback == "missing-version" {
					version = ""
				} else if strings.HasSuffix(feedback, "saving") {
					available, processing = true, true
					if feedback == "newer-saving" {
						version = "23"
					}
				}
				if !b.receive(frame(version, available, processing)) || b.failed {
					t.Fatal("failure/save feedback must remain visible")
				}
				if !b.receive(frame("21", true, false)) || b.failed {
					t.Fatal("delayed ready view malformed")
				}
				state := b.tableOrder(b.view)
				if state.available && !state.processing {
					t.Fatal("late old lobby cleared failure/save feedback")
				}
				if counts := b.counts(); counts.wagers != 0 || counts.rounds != 0 {
					t.Fatal("ordering invented monetary evidence")
				}
				if !b.receive(frame("24", true, false)) || b.failed || b.tableOrder(b.view).version != "24" {
					t.Fatal("fresh recovery view was not accepted")
				}
			})
		}
	}
}

func TestHouseLoadKeepsNewerTableLobbyAcrossRoundTransitions(t *testing.T) {
	for _, index := range []int{0, 24} {
		b := newHouseLoad(index, "player-synthetic-order")
		frame := func(round, version string) json.RawMessage {
			var payload map[string]interface{}
			if err := json.Unmarshal(houseFixtureView(b, "betting", false, false), &payload); err != nil {
				t.Fatal(err)
			}
			house := payload["house"].(map[string]interface{})
			house["roundId"], house["tableVersion"], house["tableId"] = strings.Repeat(round, 32), version, b.table.ID
			encoded, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			return encoded
		}
		if !b.receive(frame("b", "9007199254740994")) || !b.receive(frame("a", "9007199254740993")) {
			t.Fatal("valid view rejected")
		}
		b.step(Entity{InstanceID: game.CasinoInstanceID, Health: 100, Speed: 5}, time.Now(), 20, time.Second,
			func(payload map[string]interface{}) error {
				if payload["roundId"] != strings.Repeat("b", 32) {
					t.Fatal("stale lobby selected for money-changing request")
				}
				return nil
			}, func(float64, float64) { t.Fatal("seated player moved") })
	}
}

func TestCasinoTableVersionBoundedCanonicalInt64(t *testing.T) {
	for _, invalid := range []string{"", "0", "-1", "+1", "01", " 1", "1e2", "1.1", "9223372036854775808", strings.Repeat("9", 200)} {
		if _, valid := casinoTableVersion(invalid); valid {
			t.Fatal("invalid version accepted")
		}
	}
	for _, valid := range []string{"1", "9007199254740993", "9223372036854775807"} {
		if _, ok := casinoTableVersion(valid); !ok {
			t.Fatal("exact version rejected")
		}
	}
}

func TestCasinoTableOrderingPreservesValidationOwnershipAndSaveFeedback(t *testing.T) {
	for _, kind := range []string{"blackjack", "house", "poker"} {
		for _, scenario := range []string{"older", "newer", "equal", "legacy", "malformed", "wrong-table", "wrong-seat", "wrong-session", "ep", "unavailable", "processing", "bad-phase"} {
			t.Run(kind+"/"+scenario, func(t *testing.T) {
				var b *casinoLoad
				var data json.RawMessage
				switch kind {
				case "blackjack":
					b = newBlackjackLoad(0, "player-synthetic-order")
					data = blackjackFixtureView(b, "betting", "", 0, false, false, false)
				case "house":
					b = newHouseLoad(0, "player-synthetic-order")
					data = houseFixtureView(b, "betting", false, false)
				case "poker":
					b = newPokerLoad(0, "player-synthetic-order")
					data = pokerFixtureView(b, "betting", false, false, nil)
				}
				var payload map[string]interface{}
				if err := json.Unmarshal(data, &payload); err != nil {
					t.Fatal(err)
				}
				key := kind
				state := payload[key].(map[string]interface{})
				state["tableId"], state["tableVersion"] = b.table.ID, "9007199254740994"
				encoded, _ := json.Marshal(payload)
				if !b.receive(encoded) || b.failed {
					t.Fatal("initial ready view rejected")
				}
				state["tableVersion"] = "9007199254740993"
				seat := payload["yourSeat"].(map[string]interface{})
				switch scenario {
				case "newer":
					state["tableVersion"] = "9007199254740995"
				case "equal":
					state["tableVersion"] = "9007199254740994"
				case "legacy":
					delete(state, "tableVersion")
				case "malformed":
					state["tableVersion"] = "01"
				case "wrong-table":
					state["tableId"] = "other-table"
				case "wrong-seat":
					seat["seat"] = b.seat + 1
				case "wrong-session":
					seat["sessionId"] = "other-private-seat"
				case "ep":
					state["currency"] = "ep"
				case "unavailable":
					state["available"] = false
				case "processing":
					state["processing"] = true
				case "bad-phase":
					state["phase"] = "not-a-phase"
				}
				encoded, _ = json.Marshal(payload)
				var incoming casinoLoadView
				if err := json.Unmarshal(encoded, &incoming); err != nil {
					t.Fatal(err)
				}
				if got := b.olderReadyTableView(incoming); got != (scenario == "older") {
					t.Fatal("ordering hid validation/ownership/save state or lost exact older view")
				}
			})
		}
	}
}
