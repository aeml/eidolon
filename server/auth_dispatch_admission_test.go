package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAuthDispatchRejectsAccountSwitchBeforeCredentialStorage(t *testing.T) {
	previousDB := db
	db = nil // Any credential query is a failure, not an available test database.
	t.Cleanup(func() { db = previousDB })
	client := &Client{username: "original-owner", send: make(chan []byte, 4)}
	payload, _ := json.Marshal(AuthPayload{Username: "different-owner", Password: "not-checked"})
	client.dispatchMessage(Message{Type: MsgLogin, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError || string(messages[0].Payload) != `"Use a new connection to switch accounts."` {
		t.Fatalf("unexpected account-switch response: %+v", messages)
	}
	if client.username != "original-owner" || client.retired.Load() || client.transportClosed.Load() {
		t.Fatal("rejection changed the original connection")
	}
}

func TestAuthDispatchClosedOrRetiredConnectionCannotStartCredentialWork(t *testing.T) {
	previousDB := db
	db = nil
	t.Cleanup(func() { db = previousDB })
	for _, state := range []string{"closed", "retired"} {
		for _, kind := range []string{MsgLogin, MsgRegister} {
			t.Run(state+"/"+kind, func(t *testing.T) {
				client := &Client{send: make(chan []byte, 4)}
				if state == "closed" {
					client.markTransportClosed()
				} else {
					client.retired.Store(true)
				}
				payload, _ := json.Marshal(AuthPayload{Username: "target", Password: "not-checked", Email: "test@example.invalid"})
				client.dispatchMessage(Message{Type: kind, Payload: payload})
				if client.username != "" || len(client.send) != 0 {
					t.Fatal("unavailable transport accepted authentication or produced a response")
				}
			})
		}
	}
}

func TestAuthDispatchClosedOrRetiredRecipientCannotConsumeResumeToken(t *testing.T) {
	resumeTokensMu.Lock()
	previousTokens, previousIndex := resumeTokens, resumeByUser
	resumeTokens = make(map[string]*resumeTokenEntry)
	resumeByUser = make(map[string]string)
	resumeTokensMu.Unlock()
	t.Cleanup(func() {
		resumeTokensMu.Lock()
		resumeTokens, resumeByUser = previousTokens, previousIndex
		resumeTokensMu.Unlock()
	})
	for _, state := range []string{"closed", "retired"} {
		t.Run(state, func(t *testing.T) {
			owner := &Client{username: "target"}
			token, err := issueResumeToken(owner.username, owner)
			if err != nil {
				t.Fatal(err)
			}
			owner.markTransportClosedAt(time.Now())
			recipient := &Client{send: make(chan []byte, 4)}
			if state == "closed" {
				recipient.markTransportClosed()
			} else {
				recipient.retired.Store(true)
			}
			payload, _ := json.Marshal(map[string]string{"token": token})
			recipient.dispatchMessage(Message{Type: MsgResumeSession, Payload: payload})
			if recipient.username != "" || len(recipient.send) != 0 {
				t.Fatal("unavailable recipient entered the resume path")
			}
			if username, ok := validateAndConsumeResumeToken(token, ""); !ok || username != "target" {
				t.Fatal("unavailable recipient burned the legitimate reconnect token")
			}
		})
	}
}
