package main

import (
	"encoding/json"
	"reflect"
	"testing"

	"eidolon-server/internal/game"
)

func TestForgeDispatchRejectsChangedQuoteWithoutSpending(t *testing.T) {
	for _, action := range []string{MsgForgeUpgrade, MsgForgePotency} {
		for _, changed := range []string{"replay", "replacement"} {
			t.Run(action+"/"+changed, func(t *testing.T) {
				previousWorld, previousDB := world, db
				defer func() { world, db = previousWorld, previousDB }()
				db = nil
				world = game.NewWorld(nil)
				t.Cleanup(world.StopBackground)
				client := newLevelCommandClient()
				player := newLevelCommandPlayer(client.playerID)
				player.Level, player.Health = 100, 100
				player.Equipment = map[string]game.Item{"mainHand": {ID: "quoted-staff", Level: 30, Stats: map[string]int{"damage": 30}}}
				player.Inventory = []game.Item{{ID: "shards", Name: "Eidolon Shard", Stack: 100}, {ID: "hearts", Name: "Eidolon Heart", Stack: 100}}
				world.AddEntity(player)
				request := func(item game.Item) Message {
					payload, _ := json.Marshal(map[string]any{"slot": "mainHand", "amount": 1,
						"expected": map[string]any{"itemId": item.ID, "level": item.Level, "potency": item.Potency}})
					return Message{Type: action, Payload: payload}
				}
				quoted := request(player.Equipment["mainHand"])
				if changed == "replay" {
					client.handleMessage(quoted)
					messages := drainSentMessages(client.send)
					if len(messages) != 1 || messages[0].Type != MsgInventory {
						t.Fatal("initial quoted upgrade failed", messages)
					}
				} else {
					replacement := player.Equipment["mainHand"]
					replacement.ID = "different-staff"
					player.Equipment["mainHand"] = replacement
				}
				before := world.GetEntityCopy(player.ID)
				client.handleMessage(quoted)
				messages := drainSentMessages(client.send)
				if len(messages) != 1 || messages[0].Type != MsgError {
					t.Fatal("stale quoted purchase was not rejected", messages)
				}
				if !reflect.DeepEqual(before.Inventory, player.Inventory) || !reflect.DeepEqual(before.Equipment, player.Equipment) {
					t.Fatal("stale quote consumed materials or changed equipment")
				}
				client.handleMessage(request(player.Equipment["mainHand"]))
				messages = drainSentMessages(client.send)
				if len(messages) != 1 || messages[0].Type != MsgInventory {
					t.Fatal("freshly inspected quote could not upgrade", messages)
				}
			})
		}
	}
}

func TestForgeCraftDispatchRejectsChangedSocketsAndGems(t *testing.T) {
	for _, action := range []string{MsgForgeSocket, MsgForgeInsertGem, MsgForgeCombineGem, MsgForgeRemoveGem} {
		t.Run(action, func(t *testing.T) {
			previousWorld, previousDB := world, db
			defer func() { world, db = previousWorld, previousDB }()
			db = nil
			world = game.NewWorld(nil)
			t.Cleanup(world.StopBackground)
			client := newLevelCommandClient()
			player := newLevelCommandPlayer(client.playerID)
			player.Level, player.Health = 100, 100
			item := game.Item{ID: "staff", Level: 30, Stats: map[string]int{"damage": 30}}
			if action == MsgForgeInsertGem || action == MsgForgeRemoveGem {
				item.Sockets = 2
			}
			if action == MsgForgeRemoveGem {
				item.Gems = []game.SocketedGem{{Type: game.GemRuby, Quality: game.GemChipped}, {Type: game.GemSapphire, Quality: game.GemChipped}}
			}
			player.Equipment = map[string]game.Item{"mainHand": item}
			for i := 0; i < 6; i++ {
				gem := game.GenerateGem(game.GemRuby, game.GemChipped)
				gem.Stack = 4
				player.Inventory = append(player.Inventory, *gem)
			}
			// Use compact, predictable indices rather than the fixture's default bag.
			player.Inventory = player.Inventory[len(player.Inventory)-6:]
			player.Inventory = append(player.Inventory, game.Item{ID: "shards", Name: "Eidolon Shard", Stack: 2000}, game.Item{ID: "hearts", Name: "Eidolon Heart", Stack: 100})
			world.AddEntity(player)
			gemIDs := []string{player.Inventory[0].ID}
			gemCounts := []int{4}
			if action == MsgForgeCombineGem {
				gemIDs = append(gemIDs, player.Inventory[1].ID, player.Inventory[2].ID)
				gemCounts = []int{4, 4, 4}
			}
			payload, _ := json.Marshal(map[string]any{"slot": "mainHand", "equipSlot": "mainHand", "gemInvIndex": 0, "socketIndex": 0,
				"gemIndices": []int{0, 1, 2}, "expected": map[string]any{"itemId": item.ID, "level": item.Level,
					"potency": item.Potency, "sockets": item.Sockets, "gems": item.Gems, "gemIds": gemIDs, "gemCounts": gemCounts}})
			request := Message{Type: action, Payload: payload}
			if action == MsgForgeInsertGem {
				player.Inventory[0], player.Inventory[1] = player.Inventory[1], player.Inventory[0]
			} else {
				client.handleMessage(request)
				messages := drainSentMessages(client.send)
				if len(messages) != 1 || messages[0].Type != MsgInventory {
					t.Fatal("initial quoted crafting action failed")
				}
			}
			before := world.GetEntityCopy(player.ID)
			client.handleMessage(request)
			messages := drainSentMessages(client.send)
			if len(messages) != 1 || messages[0].Type != MsgError {
				t.Fatal("changed crafting selection was not rejected")
			}
			if !reflect.DeepEqual(before.Inventory, player.Inventory) || !reflect.DeepEqual(before.Equipment, player.Equipment) {
				t.Fatal("stale crafting request consumed or destroyed different items")
			}
		})
	}
}
