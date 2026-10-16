package main

import (
	"eidolon-server/internal/registrationinvites"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestRegistrationInvitationRejectsBeforeAccountStorage(t *testing.T) {
	previousPolicy, previousDB, previousGate := registrationInvitations, db, credentialAdmission
	t.Cleanup(func() { registrationInvitations, db, credentialAdmission = previousPolicy, previousDB, previousGate })
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	now := time.Now()
	token, claims, err := registrationinvites.Issue(key, "private-qa", "invited-new-account", now, now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	revoked, err := registrationinvites.NewPolicy(key, "private-qa", []string{"invited-new-account"}, []string{claims.ID})
	if err != nil {
		t.Fatal(err)
	}
	valid, err := registrationinvites.NewPolicy(key, "private-qa", []string{"invited-new-account"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, x := range []struct {
		name, username, token string
		p                     *registrationinvites.Policy
	}{
		{"missing", "invited-new-account", "", valid}, {"forged", "invited-new-account", "forged", valid},
		{"wrong account", "different-account", token, valid}, {"revoked", "invited-new-account", token, revoked},
	} {
		t.Run(x.name, func(t *testing.T) {
			registrationInvitations = x.p
			db = nil
			credentialAdmission = newCredentialWorkGate(4)
			c := &Client{send: make(chan []byte, 4)}
			payload, _ := json.Marshal(AuthPayload{Username: x.username, Password: "Unique private signup phrase 82!", Email: "qa@example.invalid", Invitation: x.token})
			c.dispatchMessage(Message{Type: MsgRegister, Payload: payload})
			if c.username != "" || len(c.send) != 2 {
				t.Fatal("invitation rejection changed account/session state")
			}
			for len(c.send) > 0 {
				data := <-c.send
				var result Message
				if json.Unmarshal(data, &result) != nil {
					t.Fatal("invalid response")
				}
				if strings.Contains(string(data), x.token) && x.token != "" {
					t.Fatal("invitation credential was echoed")
				}
				if result.Type != MsgError && result.Type != "registration_status" {
					t.Fatal("unauthorized response")
				}
			}
		})
	}
}
func TestRegistrationModeHealthHasNoPrivateRoster(t *testing.T) {
	previous := registrationInvitations
	t.Cleanup(func() { registrationInvitations = previous })
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	p, e := registrationinvites.NewPolicy(key, "private-qa", []string{"private-recipient"}, nil)
	if e != nil {
		t.Fatal(e)
	}
	registrationInvitations = p
	response, _ := collectHealthResponse(t.Context(), nil)
	data, _ := json.Marshal(response)
	if response.RegistrationMode != "invitation" || strings.Contains(string(data), "private-recipient") || strings.Contains(string(data), "private-qa") {
		t.Fatal("health omitted admission mode or exposed private configuration")
	}
}
