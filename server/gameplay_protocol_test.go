package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestGameplayProtocolResumeRefusalPrecedesAccountWorkAndTokenConsumption(t *testing.T) {
	owner := &Client{username: "protocol-owner"}
	token, err := issueResumeToken(owner.username, owner)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { revokeAccountResumeToken(owner.username) })
	for _, protocol := range []string{"", "future-protocol"} {
		client := &Client{send: make(chan []byte, 4)}
		payload, _ := json.Marshal(map[string]string{"token": token, "gameplayProtocol": protocol})
		client.dispatchMessage(Message{Type: MsgResumeSession, Payload: payload})
		messages := drainSentMessages(client.send)
		if len(messages) != 1 || messages[0].Type != "world_access_denied" {
			t.Fatal("cached client did not receive the previous client's readable response", messages)
		}
		var denied struct{ Code, Message string }
		if json.Unmarshal(messages[0].Payload, &denied) != nil || denied.Code != "client_update_required" || !strings.Contains(denied.Message, "Reload") {
			t.Fatal("missing reload instruction")
		}
		if client.username != "" || client.playerID != "" || client.transportClosed.Load() || client.retired.Load() {
			t.Fatal("update refusal changed session ownership or account-help availability")
		}
		if account, ok := resumeTokenAccount(token, ""); !ok || account != owner.username {
			t.Fatal("cached resume consumed the current token")
		}
	}
}

func TestGameplayProtocolCompatiblePatchesKeepAdmission(t *testing.T) {
	client := &Client{send: make(chan []byte, 4)}
	if !gameplayAdmissionAllowed(client, gameplayProtocol) || len(client.send) != 0 {
		t.Fatal("matching capability was refused")
	}
}
