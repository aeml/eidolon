package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestInventoryDropDispatchReturnsAuthoritativeBagAndRejectsReplay(t *testing.T) {
	store, _, _, player, _ := groundCoordinatorFixture(t)
	client := newLevelCommandClient()
	client.username, client.playerID = player.Name, player.ID
	player.Health = 100
	player.Inventory = []game.Item{{ID: "drop-me", Name: "Iron Sword", Stack: 1}}
	store.characters[player.Name] = characterSnapshotForSave(player.Name, world.GetEntityCopy(player.ID))
	expected := 1
	payload, _ := json.Marshal(InventoryDropPayload{Index: 0, ItemID: "drop-me", ExpectedStack: &expected})
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

func TestInventoryDropDispatchChecksClientQuantityBeforeMovingStack(t *testing.T) {
	store, _, _, player, _ := groundCoordinatorFixture(t)
	client := newLevelCommandClient()
	client.username, client.playerID = player.Name, player.ID
	player.Health = 100
	player.Inventory = []game.Item{{ID: "changing-stack", Stack: 5, MaxStack: 10}}
	store.characters[player.Name] = characterSnapshotForSave(player.Name, world.GetEntityCopy(player.ID))
	expected := 2
	payload, _ := json.Marshal(InventoryDropPayload{Index: 0, ItemID: "changing-stack", ExpectedStack: &expected})
	client.handleMessage(Message{Type: MsgInventoryDrop, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgError || player.Inventory[0].Stack != 5 {
		t.Fatal("stale quantity did not leave the bag unchanged", messages)
	}
	expected = 5
	payload, _ = json.Marshal(InventoryDropPayload{Index: 0, ItemID: "changing-stack", ExpectedStack: &expected})
	client.handleMessage(Message{Type: MsgInventoryDrop, Payload: payload})
	messages = drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory || player.Inventory[0].ID != "" {
		t.Fatal("fresh quantity did not receive authoritative inventory acknowledgement", messages)
	}
}
