package main

import (
	"encoding/json"
	"strings"
	"testing"

	"eidolon-server/internal/game"
)

func TestDungeonDeadRecallDispatchRequiresExplicitRespawn(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("dead-dungeon-player")
	player := newAutoStatusPlayer(client.playerID, "Recovery", "available")
	player.InstanceID, player.State, player.Health = "dungeon_recovery", "DEAD", 0
	world.AddEntity(player)
	client.handleMessage(Message{Type: MsgRecall, Payload: json.RawMessage(`{}`)})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "Respawn") {
		t.Fatalf("dead recall must explain recovery without a false town transition: %+v", messages)
	}
	client.handleMessage(Message{Type: MsgRespawn, Payload: json.RawMessage(`{}`)})
	messages = drainSentMessages(client.send)
	var enteredTown bool
	for _, message := range messages {
		if message.Type == MsgEnterInstance && strings.Contains(string(message.Payload), "overworld") {
			enteredTown = true
		}
	}
	if !enteredTown {
		t.Fatalf("explicit recovery did not send its town scene: %+v", messages)
	}
	recovered := world.GetEntityCopy(player.ID)
	if recovered.InstanceID != "" || recovered.State != "IDLE" || recovered.Health != recovered.MaxHealth {
		t.Fatal("recovery message disagrees with the authoritative character state")
	}
}
