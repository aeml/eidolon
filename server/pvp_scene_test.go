package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestDuelSceneEntryAndReturnUseAuthoritativePositions(t *testing.T) {
	previousWorld, previousDB := world, db
	sessionsMu.Lock()
	previousSessions := activeSessions
	first, second := newAutoStatusClient("scene-first"), newAutoStatusClient("scene-second")
	activeSessions = map[string]*Client{first.username: first, second.username: second}
	sessionsMu.Unlock()
	defer func() {
		world, db = previousWorld, previousDB
		sessionsMu.Lock()
		activeSessions = previousSessions
		sessionsMu.Unlock()
	}()
	world, db = game.NewWorld(nil), nil
	world.OnPvPMatchComplete = persistPvPMatchResult
	for i, client := range []*Client{first, second} {
		player := newAutoStatusPlayer(client.playerID, client.username, "available")
		player.X, player.Z = 10+float64(i)*2, 205
		world.AddEntity(player)
	}
	if _, err := world.RequestDuel(first.playerID, second.playerID); err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]interface{}{"requesterId": first.playerID, "accept": true})
	handleMsgDuelRespond(second, Message{Payload: payload})
	for _, client := range []*Client{first, second} {
		assertPvPScene(t, client, "pvp_arena")
	}
	status := world.PvPStatus(first.playerID)
	match := status["match"].(*game.PvPMatch)
	sendPvPMatchState(match) // Ordinary score/elimination updates must not reload a scene.
	for _, client := range []*Client{first, second} {
		for _, msg := range drainSentMessages(client.send) {
			if msg.Type == MsgEnterInstance {
				t.Fatal("score update reloaded arena")
			}
		}
	}
	world.ForfeitPvP(first.playerID)
	for _, client := range []*Client{first, second} {
		assertPvPScene(t, client, "overworld")
	}
}

func assertPvPScene(t *testing.T, client *Client, sceneType string) {
	t.Helper()
	entries := 0
	for _, message := range drainSentMessages(client.send) {
		if message.Type != MsgEnterInstance {
			continue
		}
		entries++
		var payload struct {
			InstanceID string                    `json:"instanceId"`
			Type       string                    `json:"type"`
			Layout     game.DungeonLayout        `json:"layout"`
			Spawn      struct{ X, Y, Z float64 } `json:"spawn"`
		}
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		player := world.GetEntityCopy(client.playerID)
		if payload.Type != sceneType || payload.InstanceID != player.InstanceID ||
			payload.Spawn.X != player.X || payload.Spawn.Y != player.Y || payload.Spawn.Z != player.Z {
			t.Fatalf("scene is not the authoritative destination: %+v", payload)
		}
		if sceneType == "pvp_arena" && len(payload.Layout.WalkRects) != 1 {
			t.Fatal("arena floor missing")
		}
	}
	if entries != 1 {
		t.Fatalf("got %d scene entries, want 1 for %s", entries, sceneType)
	}
}
