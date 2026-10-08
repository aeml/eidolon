package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAdminBetaInvitationAuditWriteFailureCannotReturnProof(t *testing.T) {
	client, _ := adminReadFixture(t)
	previousPolicy, previousJournal := registrationInvitations, adminActivityJournal
	registrationInvitations, _ = newRegistrationInvitationPolicy("invited", strings.Repeat("7a", 32))
	adminActivityJournal = nil
	unjournaledActivity.Lock()
	previousEvents := unjournaledActivity.events
	unjournaledActivity.events = nil
	unjournaledActivity.Unlock()
	t.Cleanup(func() {
		registrationInvitations, adminActivityJournal = previousPolicy, previousJournal
		unjournaledActivity.Lock()
		unjournaledActivity.events = previousEvents
		unjournaledActivity.Unlock()
	})
	// The buffer is initialized explicitly as in the running server.
	unjournaledActivity.Lock()
	unjournaledActivity.events = make(map[primitive.ObjectID]database.AdminActivity)
	unjournaledActivity.Unlock()
	adminActivities.(*fakeAdminActivityStore).appendErr = errors.New("synthetic audit write failure")
	handleAdminBetaInvitation(client, Message{Type: MsgAdminBetaInvitation, Payload: betaInvitationPayload(t)})
	messages := drainSentMessages(client.send)
	var result betaInvitationResult
	if len(messages) != 1 || json.Unmarshal(messages[0].Payload, &result) != nil || result.Code != "" || result.Success || result.Final || !client.transportClosed.Load() {
		t.Fatal("audit failure returned a proof or retained unsafe transport")
	}
	unjournaledActivity.Lock()
	encoded, _ := json.Marshal(unjournaledActivity.events)
	count := len(unjournaledActivity.events)
	unjournaledActivity.Unlock()
	if count != 1 || strings.Contains(string(encoded), "private@example.invalid") || strings.Contains(string(encoded), strings.Repeat("7a", 32)) {
		t.Fatal("admission recovery missing or exposes private data")
	}
}

func betaInvitationPayload(t *testing.T) []byte {
	t.Helper()
	payload, err := json.Marshal(map[string]interface{}{"id": "invite-request-000001", "username": "Invited Player",
		"email": "private@example.invalid", "expiresAt": time.Now().Add(time.Hour).UTC().Format(time.RFC3339), "confirmed": true})
	if err != nil {
		t.Fatal(err)
	}
	return payload
}

func TestAdminBetaInvitationReturnsPrivateProofAfterSecretFreeAudit(t *testing.T) {
	client, _ := adminReadFixture(t)
	previous := registrationInvitations
	registrationInvitations, _ = newRegistrationInvitationPolicy("open", strings.Repeat("7a", 32))
	t.Cleanup(func() { registrationInvitations = previous })
	handleAdminBetaInvitation(client, Message{Type: MsgAdminBetaInvitation, Payload: betaInvitationPayload(t)})
	messages := drainSentMessages(client.send)
	var result betaInvitationResult
	if len(messages) != 1 || messages[0].Type != MsgAdminBetaInvitation+"_result" || json.Unmarshal(messages[0].Payload, &result) != nil ||
		!result.Authorized || !result.Success || !result.Final || len(result.Code) != 76 {
		t.Fatal("private invitation result missing")
	}
	policy := registrationInvitations
	policy.mode = registrationInvitedMode
	if policy.authorize("Invited Player", "private@example.invalid", result.Code, time.Now()) != nil {
		t.Fatal("private proof invalid")
	}
	journal := adminActivities.(*fakeAdminActivityStore).events
	encoded, _ := json.Marshal(journal)
	if len(journal) != 1 || journal[0].Action != MsgAdminBetaInvitation || journal[0].Target != "Invited Player" ||
		strings.Contains(string(encoded), result.Code) || strings.Contains(string(encoded), "private@example.invalid") ||
		!strings.Contains(string(encoded), "admission") {
		t.Fatal("audit missing or exposes private proof/email")
	}
}

func TestAdminBetaInvitationFailsClosedOnRoleAuditAndLateAuthorityLoss(t *testing.T) {
	for _, stage := range []string{"disabled", "revoked", "audit", "late-revocation", "replacement", "closed"} {
		t.Run(stage, func(t *testing.T) {
			client, roles := adminReadFixture(t)
			previous := registrationInvitations
			registrationInvitations, _ = newRegistrationInvitationPolicy("invited", strings.Repeat("7a", 32))
			t.Cleanup(func() { registrationInvitations = previous })
			switch stage {
			case "disabled":
				registrationInvitations, _ = newRegistrationInvitationPolicy("open", "")
			case "revoked":
				delete(roles.roles, client.username)
			case "audit":
				adminActivities = nil
			case "closed":
				client.markTransportClosed()
			default:
				adminActivities = &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}, afterAppend: func() {
					if stage == "replacement" {
						activeSessions[client.username] = &Client{username: client.username}
					} else {
						delete(roles.roles, client.username)
					}
				}}
			}
			handleAdminBetaInvitation(client, Message{Type: MsgAdminBetaInvitation, Payload: betaInvitationPayload(t)})
			messages := drainSentMessages(client.send)
			if stage == "closed" && len(messages) == 0 {
				return
			}
			var result betaInvitationResult
			if len(messages) != 1 || json.Unmarshal(messages[0].Payload, &result) != nil || result.Code != "" || result.Success || result.Final {
				t.Fatal("failed authority/storage returned a proof")
			}
		})
	}
}

func TestAdminBetaInvitationClosedRequestAndMandatoryPolicy(t *testing.T) {
	valid := string(betaInvitationPayload(t))
	for _, payload := range []string{"{}", "null", valid + "{}", strings.Repeat(" ", 2049),
		strings.Replace(valid, "\"confirmed\":true", "\"confirmed\":false", 1),
		strings.Replace(valid, "\"confirmed\":true", "\"confirmed\":true,\"actor\":\"operator\"", 1),
		strings.Replace(valid, "\"confirmed\":true", "\"confirmed\":true,\"confirmed\":true", 1)} {
		if _, _, err := decodeBetaInvitationRequest([]byte(payload), time.Now()); err == nil {
			t.Fatal("invalid request admitted")
		}
	}
	policy, ok := inboundMessagePolicies[MsgAdminBetaInvitation]
	if !ok || policy.access != accessAuthenticated || policy.maxPayloadBytes != 2048 || policy.burst != 3 || policy.window != time.Minute ||
		messageHandlers[MsgAdminBetaInvitation] == nil {
		t.Fatal("missing bounded authenticated dispatch")
	}
}
