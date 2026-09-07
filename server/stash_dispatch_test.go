package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestStashRejectedTransferReportsFeedbackWithoutChangingItems(t *testing.T) {
	for _, scenario := range []string{"full-bag", "full-stash", "quest-item", "stale-item"} {
		t.Run(scenario, func(t *testing.T) {
			previousWorld, previousDB := world, db
			defer func() { world, db = previousWorld, previousDB }()
			db = nil
			world = game.NewWorld(nil)
			client := newLevelCommandClient()
			player := newLevelCommandPlayer(client.playerID)
			world.AddEntity(player)
			item := game.Item{ID: "kept-item", Name: "Kept sword", Stack: 1, MaxStack: 1}
			player.Inventory = []game.Item{item}
			player.Stash = nil
			kind := MsgStashDeposit
			fill := func(n int) []game.Item {
				items := make([]game.Item, n)
				for i := range items {
					items[i] = game.Item{ID: fmt.Sprint(i), Name: fmt.Sprint(i), Stack: 1, MaxStack: 1}
				}
				return items
			}
			switch scenario {
			case "full-bag":
				player.Inventory = fill(game.MaxInventorySize)
				player.Stash = []game.Item{item}
				kind = MsgStashWithdraw
			case "full-stash":
				player.Stash = fill(game.MaxStashSize)
			case "quest-item":
				item.ID = "chronicle-item-test"
				player.Inventory[0] = item
			case "stale-item":
				item.ID = "missing"
			}
			before, _ := json.Marshal([][]game.Item{player.Inventory, player.Stash})
			payload, _ := json.Marshal(StashDepositPayload{ItemID: item.ID})
			client.handleMessage(Message{Type: kind, Payload: payload})
			after, _ := json.Marshal([][]game.Item{player.Inventory, player.Stash})
			if string(before) != string(after) {
				t.Fatal("rejected transfer changed items")
			}
			messages := drainSentMessages(client.send)
			if len(messages) != 1 || messages[0].Type != MsgChat || !strings.Contains(string(messages[0].Payload), "Could not ") {
				t.Fatalf("missing readable rejection: %+v", messages)
			}
		})
	}
}
