package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"testing"
)

func TestCasinoActionErrorAcknowledgesExactRejectedSpin(t *testing.T) {
	previous := world
	world = &game.World{Entities: map[string]*game.Entity{}}
	t.Cleanup(func() { world = previous })
	client := &Client{playerID: "player-unseated", send: make(chan []byte, 8)}
	handleMsgCasino(client, Message{Payload: json.RawMessage(`{"action":"slot_spin","sessionId":"expired-seat","roundRevision":42,"bet":20}`)})
	for len(client.send) > 0 {
		var message Message
		if err := json.Unmarshal(<-client.send, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type != "casino_action_error" {
			continue
		}
		var body struct {
			SessionID     string `json:"sessionId"`
			Action        string `json:"action"`
			RoundRevision uint64 `json:"roundRevision"`
			Error         string `json:"error"`
		}
		if err := json.Unmarshal(message.Payload, &body); err != nil {
			t.Fatal(err)
		}
		if body.SessionID != "expired-seat" || body.Action != "slot_spin" || body.RoundRevision != 42 || body.Error == "" {
			t.Fatalf("rejection lost request identity: %+v", body)
		}
		return
	}
	t.Fatal("missing explicit rejection acknowledgement")
}
