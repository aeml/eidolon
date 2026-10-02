package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestMoveDispatchRejectsSpeedAndAcknowledgesUnchangedPosition(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("movement-authority")
	player := newAutoStatusPlayer(client.playerID, "Movement", "available")
	player.X, player.Z, player.Speed = 0, 200, 5
	world.AddEntity(player)

	client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":50,"z":200,"state":"MOVING","sequence":1}`)})
	if got := world.GetEntity(player.ID); got.X != 0 || got.LastMoveSequence != 1 {
		t.Fatalf("50-unit untrusted teleport accepted or not acknowledged: x=%v ack=%d", got.X, got.LastMoveSequence)
	}
	client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":10,"z":200,"state":"MOVING","sequence":2}`)})
	if got := world.GetEntity(player.ID); got.X != 10 || got.LastMoveSequence != 2 {
		t.Fatalf("valid delayed sample rejected: x=%v ack=%d", got.X, got.LastMoveSequence)
	}
	client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":11,"z":200,"state":"MOVING","sequence":3}`)})
	if got := world.GetEntity(player.ID); got.X != 10 || got.LastMoveSequence != 3 {
		t.Fatalf("packet burst bypassed consumed allowance: x=%v ack=%d", got.X, got.LastMoveSequence)
	}
}
