package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPublicRegistrationCannotCaptureConfiguredBootstrapNames(t *testing.T) {
	previousNames, previousGate, previousDB := adminBootstrapUsernames, credentialAdmission, db
	adminBootstrapUsernames = parseAdminBootstrapUsernames("BootstrapOwner, Second Owner")
	credentialAdmission = newCredentialWorkGate(1)
	db = nil // Reserved registration must not reach credentials or account storage.
	t.Cleanup(func() {
		adminBootstrapUsernames, credentialAdmission, db = previousNames, previousGate, previousDB
	})
	for _, name := range []string{"BootstrapOwner", "bootstrapowner", "BOOTSTRAPOWNER", "Second Owner", "second owner"} {
		t.Run(name, func(t *testing.T) {
			client := &Client{send: make(chan []byte, 4)}
			payload, _ := json.Marshal(AuthPayload{Username: name, Password: "A unique prepared signup phrase"})
			client.dispatchMessage(Message{Type: MsgRegister, Payload: payload})
			messages := drainSentMessages(client.send)
			var feedback string
			if len(messages) != 1 || messages[0].Type != MsgError || json.Unmarshal(messages[0].Payload, &feedback) != nil || !strings.Contains(feedback, "account name is reserved") {
				t.Fatal("public signup could claim a configured bootstrap identity")
			}
			if client.username != "" || len(credentialAdmission.accounts) != 0 || len(credentialAdmission.slots) != 0 {
				t.Fatal("reserved signup acquired identity or spent credential work")
			}
		})
	}
	if err := validateRegistrationCredentials(AuthPayload{Username: "ordinary-player", Password: "A unique prepared signup phrase"}); err != nil {
		t.Fatal("reservation blocked an ordinary username", err)
	}
}

func TestBootstrapRegistrationReservationCannotAuthorizeCaseVariants(t *testing.T) {
	previousNames := adminBootstrapUsernames
	adminBootstrapUsernames = parseAdminBootstrapUsernames("BootstrapOwner")
	t.Cleanup(func() { adminBootstrapUsernames = previousNames })
	if !isAdminBootstrapUsername("BootstrapOwner") || !isReservedBootstrapRegistrationName("bootstrapowner") || isAdminBootstrapUsername("bootstrapowner") {
		t.Fatal("registration reservation changed exact bootstrap authority")
	}
	adminBootstrapUsernames = parseAdminBootstrapUsernames("")
	if isAdminBootstrapUsername("BootstrapOwner") || isReservedBootstrapRegistrationName("BootstrapOwner") {
		t.Fatal("disabled bootstrap retained an implicit privileged username")
	}
}
