package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestCasinoRejectionKeepsFixedCauseAndNeverRetries(t *testing.T) {
	for _, sample := range []struct {
		reason string
		stage  casinoFailureStage
	}{
		{"table funds are being saved; please wait", casinoFailureBusy},
		{"poker funds are being saved; please wait", casinoFailureBusy},
		{"round changed; review the table", casinoFailureStale},
		{"blackjack round changed; refresh the table", casinoFailureStale},
		{"wait for your blackjack turn", casinoFailureStale},
		{"blackjack turn expired", casinoFailureStale},
		{"review the current round and choose 20–100000 gold in steps of 20", casinoFailureRoundOrBet},
		{"review the current round and choose 2–100 ep in steps of 2", casinoFailureRoundOrBet},
		{"review the hand and choose 100–100000 gold in steps of 100", casinoFailureRoundOrBet},
		{"review the hand and choose 10–100 ep in steps of 10", casinoFailureRoundOrBet},
		{"review the hand and choose 100–100000 gold in steps of 100 private-token", casinoFailureRejected},
		{"review the current round and choose 20–100000 gold in steps of 20 private-token", casinoFailureRejected},
		{"sit at the blackjack table before playing", casinoFailureSeat},
		{"return to your funded blackjack seat before playing this hand", casinoFailureSeat},
		{"slot state changed; refresh before acting", casinoFailureStale},
		{"that seat is occupied or reserved for a reconnect", casinoFailureSeat},
		{"message rate limit exceeded: casino", casinoFailureRate},
		{"private-account/provider/token diagnostic", casinoFailureRejected},
		{strings.Repeat("private", 1000), casinoFailureRejected},
	} {
		for _, kind := range []string{"error", "casino_action_error"} {
			var payload []byte
			if kind == "error" {
				payload, _ = json.Marshal(sample.reason)
			} else {
				payload, _ = json.Marshal(map[string]string{"error": sample.reason, "sessionId": "private-session"})
			}
			b := newCasinoLoad(0)
			b.rejectServer(Message{Type: kind, Payload: payload})
			b.rejectServer(partyMessage("error", "round changed; review the table"))
			counts := b.counts()
			if !counts.failed || counts.failureStage != sample.stage || counts.paidSpins != 0 {
				t.Fatal("rejection cause replaced or invented a paid result")
			}
			b.step(Entity{Health: 100}, time.Now(), 100, time.Second, func(map[string]interface{}) error {
				t.Fatal("rejected wager retried")
				return nil
			}, func(float64, float64) { t.Fatal("failed workload kept moving") })
		}
	}
}

func TestCasinoTimeoutKeepsClosedActionAndNeverRetries(t *testing.T) {
	now := time.Unix(100, 0)
	for _, sample := range []struct {
		action string
		want   casinoTimeoutAction
	}{
		{"enter", casinoTimeoutEnter}, {"sit", casinoTimeoutSit},
		{"slot_spin", casinoTimeoutSpin}, {"slot_bonus", casinoTimeoutBonus},
		{"bet", casinoTimeoutBlackjackBet}, {"play", casinoTimeoutBlackjackPlay},
		{"house_bet", casinoTimeoutHouseBet}, {"poker_buy_in", casinoTimeoutPokerBuyIn},
		{"poker_play", casinoTimeoutPokerPlay}, {"private/session/account-text", casinoTimeoutUnknown},
	} {
		b := newCasinoLoad(0)
		b.pending, b.sentAt = sample.action, now.Add(-time.Second)
		for tick := 0; tick < 2; tick++ {
			b.step(Entity{Health: 100}, now, 100, time.Second,
				func(map[string]interface{}) error { t.Fatal("uncertain request retried"); return nil },
				func(float64, float64) { t.Fatal("timed-out workload moved") })
		}
		b.rejectServer(partyMessage("error", "round changed; review the table"))
		counts := b.counts()
		if !counts.failed || counts.failureStage != casinoFailureTimeout || counts.timeoutAction != sample.want {
			t.Fatal("late response changed first timeout cause/action")
		}
	}
	assignments := []botAssignment{{scenario: "casino-slots"}, {scenario: "casino-slots"}, {scenario: "casino-slots"}}
	observations := []loadObservation{
		{casino: casinoLoadCounts{failed: true, failureStage: casinoFailureTimeout, timeoutAction: casinoTimeoutSpin}},
		{casino: casinoLoadCounts{failed: true, failureStage: casinoFailureTimeout, timeoutAction: casinoTimeoutKinds}},
		{casino: casinoLoadCounts{failed: true, failureStage: casinoFailureRejected, timeoutAction: casinoTimeoutSpin}},
	}
	results, valid := summarizeCombinedCasino(assignments, observations)
	if valid || results[0].failed != 3 || results[0].failures[casinoFailureTimeout] != 2 ||
		results[0].timeouts[casinoTimeoutSpin] != 1 || results[0].timeouts[casinoTimeoutUnknown] != 1 {
		t.Fatal("timeout aggregation counted rejection or lost invalid/unknown action")
	}
}
