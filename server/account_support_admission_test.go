package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAccountProgressHelpPreservesAuthenticatedReportBudget(t *testing.T) {
	payload, _ := json.Marshal(ReportPayload{ReportType: "Account / Progress Help", Text: "World entry failed.", RequestID: "support-fixture-001"})
	message := Message{Type: MsgReport, Payload: payload}
	now := time.Now()
	if err := (&Client{}).acceptInboundMessage(message, now); err == nil {
		t.Fatal("anonymous support report admitted")
	}
	client := &Client{username: "support-fixture"}
	for i := 0; i < 2; i++ {
		if err := client.acceptInboundMessage(message, now); err != nil {
			t.Fatal("authenticated help incorrectly required world entry", err)
		}
	}
	if err := client.acceptInboundMessage(message, now); err == nil {
		t.Fatal("support bypassed ordinary shared report rate limit")
	}
	message.Payload = make([]byte, inboundMessagePolicies[MsgReport].maxPayloadBytes+1)
	if err := (&Client{username: "support-fixture"}).acceptInboundMessage(message, now); err == nil {
		t.Fatal("support bypassed ordinary payload bound")
	}
}
