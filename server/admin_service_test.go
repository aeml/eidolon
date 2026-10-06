package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAdminServiceReadIsAuditedBoundedAndSecretFree(t *testing.T) {
	client, roles := adminReadFixture(t)
	previousDB := db
	db = nil
	t.Cleanup(func() { db = previousDB })
	t.Setenv("POSTMARK_SERVER_TOKEN", "private-provider-token-marker")
	t.Setenv("ADMIN_NOTIFICATION_EMAILS", "private-recipient-marker@example.invalid")
	payload := json.RawMessage(`{"id":"read-request-000001"}`)
	handleAdminRead(client, Message{Type: MsgAdminService, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminServiceResult {
		t.Fatal("diagnostic read lost its registered correlated response")
	}
	var result adminReadResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
		t.Fatal(err)
	}
	if !result.Success || !result.Authorized || result.ID != "read-request-000001" || result.Service == nil || result.Service.SampledAt.IsZero() || result.Service.Health.Goroutines <= 0 || result.Service.Health.Database != "unavailable" {
		t.Fatal("diagnostic snapshot missing or nil database reported ready", result)
	}
	store := adminActivities.(*fakeAdminActivityStore)
	if len(store.events) != 1 || store.events[0].Action != MsgAdminService || store.events[0].Result != "success" {
		t.Fatal("service read bypassed its durable audit", store.events)
	}
	encoded, _ := json.Marshal(result)
	if strings.Contains(string(encoded), "private-") || result.Account != "" || result.Players != nil || result.Items != nil {
		t.Fatal("service diagnostics included environment/account/player details")
	}
	delete(roles.roles, client.username)
	denied := adminRead(t, client, MsgAdminService, "")
	if denied.Success || denied.Authorized || denied.Service != nil {
		t.Fatal("revoked role received diagnostic payload")
	}
	policy := inboundMessagePolicies[MsgAdminService]
	if policy.access != accessAuthenticated || policy.maxPayloadBytes != 1024 || policy.burst != 5 {
		t.Fatal("service read lost authentication/resource bounds")
	}
}

func TestAdminServiceReadRejectsForeignFields(t *testing.T) {
	for _, payload := range []string{
		`{"id":"read-request-000001","after":"foreign"}`,
		`{"id":"read-request-000001","actor":"foreign"}`,
		`{"id":"read-request-000001","role":"admin"}`,
		`{"id":"read-request-000001","id":"read-request-000002"}`,
		`{"id":"read-request-000001","status":"open"}`,
	} {
		if _, err := decodeAdminRead(Message{Type: MsgAdminService, Payload: json.RawMessage(payload)}); err == nil {
			t.Fatal("diagnostic request accepted a filter or authority override")
		}
	}
}
