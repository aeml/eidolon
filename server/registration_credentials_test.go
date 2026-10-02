package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRegistrationCredentialBoundariesPreserveExactValidInput(t *testing.T) {
	for _, scenario := range []struct{ name, username, password string }{
		{"ascii-minimum", "player", "a-unique-phrase!"},
		{"ascii-maximum", "player", strings.Repeat("ab", 36)},
		{"unicode-minimum", "主人", strings.Repeat("🌙", 15)},
		{"unicode-byte-maximum", "主人", strings.Repeat("🌙", 18)},
		{"spaces-case-and-email-optional", "Mixed Case Player", "  Unique phrase with spaces  "},
		{"username-byte-maximum", strings.Repeat("x", 128), "Another unique signup phrase"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			payload := AuthPayload{Username: scenario.username, Password: scenario.password}
			original := payload
			if err := validateRegistrationCredentials(payload); err != nil {
				t.Fatal(err)
			}
			if payload != original {
				t.Fatal("validation transformed the credential")
			}
		})
	}
}

func TestRegistrationRejectsInvalidCredentialsBeforeQueryAndHashWork(t *testing.T) {
	previousGate, previousDB := credentialAdmission, db
	credentialAdmission = newCredentialWorkGate(1)
	db = nil // Invalid requests must never reach a credential-storage call.
	t.Cleanup(func() { credentialAdmission, db = previousGate, previousDB })
	for _, scenario := range []struct{ name, username, password, feedback string }{
		{"empty-user", "", "Another unique signup phrase", "Username must"},
		{"blank-user", " \t ", "Another unique signup phrase", "Username must"},
		{"newline-user", "name\nforged-log", "Another unique signup phrase", "Username must"},
		{"nul-user", "name\x00suffix", "Another unique signup phrase", "Username must"},
		{"oversized-user", strings.Repeat("x", 129), "Another unique signup phrase", "Username must"},
		{"empty-password", "player", "", "at least 15 characters"},
		{"short-ascii", "player", "fourteen-chars", "at least 15 characters"},
		{"short-unicode", "player", strings.Repeat("🌙", 14), "at least 15 characters"},
		{"oversized-ascii", "player", strings.Repeat("x", 73), "72 UTF-8 bytes"},
		{"oversized-unicode", "player", strings.Repeat("🌙", 19), "72 UTF-8 bytes"},
		{"common-complete-password", "player", "passwordpassword", "Choose a unique password"},
		{"common-case-variant", "player", "PASSWORDPASSWORD", "Choose a unique password"},
		{"known-example-phrase", "player", "correct horse battery staple", "Choose a unique password"},
		{"service-address", "player", "play.eidolonrealms.com", "Choose a unique password"},
		{"account-name", "Long Account Name", "long account name", "Choose a unique password"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			client := &Client{send: make(chan []byte, 4)}
			payload, _ := json.Marshal(AuthPayload{Username: scenario.username, Password: scenario.password})
			client.dispatchMessage(Message{Type: MsgRegister, Payload: payload})
			messages := drainSentMessages(client.send)
			var feedback string
			if len(messages) != 1 || messages[0].Type != MsgError || json.Unmarshal(messages[0].Payload, &feedback) != nil ||
				!strings.HasPrefix(feedback, "Registration failed: ") || !strings.Contains(feedback, scenario.feedback) {
				t.Fatalf("missing bounded registration feedback for %s", scenario.name)
			}
			if len(credentialAdmission.accounts) != 0 || len(credentialAdmission.slots) != 0 || client.username != "" {
				t.Fatal("invalid registration spent account/work capacity or acquired an identity")
			}
		})
	}
}

func TestRegistrationPasswordBlocklistMatchesWholeValuesNotSubstrings(t *testing.T) {
	payload := AuthPayload{Username: "player", Password: "Unique passwordpassword story 🌙"}
	if err := validateRegistrationCredentials(payload); err != nil {
		t.Fatal("a blocklisted substring incorrectly rejected a distinct passphrase", err)
	}
}
