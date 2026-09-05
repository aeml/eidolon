package main

import (
	"encoding/json"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestPvPRecoveryDispatchRejectsTownSceneTransition(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("pvp-first")
	first := newAutoStatusPlayer(client.playerID, "First", "available")
	second := newAutoStatusPlayer("pvp-second", "Second", "available")
	world.AddEntity(first)
	world.AddEntity(second)
	_, err := world.RequestDuel(first.ID, second.ID)
	if err != nil {
		t.Fatal(err)
	}
	match, err := world.RespondDuel(second.ID, first.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{MsgRecall, MsgRespawn} {
		client.handleMessage(Message{Type: kind, Payload: json.RawMessage(`{}`)})
		messages := drainSentMessages(client.send)
		if len(messages) != 1 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "Forfeit") {
			t.Fatalf("%s must explain forfeit without sending an overworld scene: %+v", kind, messages)
		}
		if world.GetEntityCopy(first.ID).InstanceID != match.ID {
			t.Fatal("recovery escaped the match")
		}
	}
}

func TestPracticeResultNotifiesBothPlayersWithoutDatabaseWrites(t *testing.T) {
	previousWorld, previousDB := world, db
	sessionsMu.Lock()
	previousSessions := activeSessions
	first, second := newAutoStatusClient("practice-first"), newAutoStatusClient("practice-second")
	activeSessions = map[string]*Client{first.username: first, second.username: second}
	sessionsMu.Unlock()
	defer func() {
		world, db = previousWorld, previousDB
		sessionsMu.Lock()
		activeSessions = previousSessions
		sessionsMu.Unlock()
	}()
	world, db = game.NewWorld(nil), nil // Any attempted profile write would panic.
	for _, client := range []*Client{first, second} {
		world.AddEntity(newAutoStatusPlayer(client.playerID, client.username, "available"))
	}
	persistPvPMatchResult(game.PvPMatchResult{Mode: game.PvPModeDuel, WinnerIDs: []string{first.playerID}, LoserIDs: []string{second.playerID}})
	for _, client := range []*Client{first, second} {
		messages := drainSentMessages(client.send)
		var resultText, cleared bool
		for _, message := range messages {
			if strings.Contains(string(message.Payload), "Practice duel") {
				resultText = true
			}
			if message.Type == MsgPvPUpdate {
				var payload map[string]interface{}
				if err := json.Unmarshal(message.Payload, &payload); err != nil {
					t.Fatal(err)
				}
				cleared = payload["match"] == nil
			}
		}
		if !resultText || !cleared {
			t.Fatalf("practice participant missed result/cleared match: %+v", messages)
		}
	}
}
