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
