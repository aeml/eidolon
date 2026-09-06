package main

import (
	"encoding/json"
	"testing"

	"eidolon-server/internal/game"
)

func TestEquipmentRecoveryDispatchUsesNonBlockingAuthoritativeResult(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Equipment = map[string]game.Item{"gem": {ID: "saved-gem", Type: game.ItemGem, Slot: "gem", Stack: 5}}
	player.Inventory = []game.Item{{ID: "bag-sword", Type: game.ItemWeapon, Slot: "mainHand", Stack: 1}}
	world.AddEntity(player)
	payload, _ := json.Marshal(UnequipPayload{Slot: "gem", ItemID: "saved-gem"})
	request := Message{Type: MsgUnequip, Payload: payload}
	for _, available := range []bool{false, true} {
		if available {
			player.Inventory[0] = game.Item{}
		}
		client.handleMessage(request)
		messages := drainSentMessages(client.send)
		if available && (len(messages) != 2 || messages[0].Type != MsgInventory) {
			t.Fatal("success must update bag before reporting recovery")
		}
		if !available && len(messages) != 1 {
			t.Fatal("rejected recovery should only report its non-blocking result")
		}
		last := messages[len(messages)-1]
		if last.Type != MsgEquipmentResult {
			t.Fatalf("unexpected result type: %s", last.Type)
		}
		var result struct {
			Slot    string `json:"slot"`
			ItemID  string `json:"itemId"`
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		if json.Unmarshal(last.Payload, &result) != nil || result.Slot != "gem" || result.ItemID != "saved-gem" || result.Success != available || result.Message == "" {
			t.Fatal("recovery receipt lost identity or result")
		}
		if available && (player.Inventory[0].ID != "saved-gem" || len(player.Equipment) != 0) {
			t.Fatal("successful receipt disagrees with item ownership")
		}
		if !available && player.Equipment["gem"].Stack != 5 {
			t.Fatal("failed receipt changed the saved stack")
		}
	}
}
