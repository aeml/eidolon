package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestInventoryDropDispatchReturnsAuthoritativeBagAndRejectsReplay(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Health = 100
	player.Inventory = []game.Item{{ID: "drop-me", Name: "Iron Sword", Stack: 1}}
	world.AddEntity(player)
	payload, _ := json.Marshal(InventoryDropPayload{Index: 0, ItemID: "drop-me"})
	request := Message{Type: MsgInventoryDrop, Payload: payload}
	client.handleMessage(request)
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory {
		t.Fatalf("missing inventory acknowledgement: %+v", messages)
	}
	var inventory []game.Item
	if err := json.Unmarshal(messages[0].Payload, &inventory); err != nil || len(inventory) != 1 || inventory[0].ID != "" {
		t.Fatal("drop acknowledgement did not contain the updated bag")
	}
	client.handleMessage(request)
	messages = drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError {
		t.Fatal("replayed drop was not rejected")
	}
}
