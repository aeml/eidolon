package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"eidolon-server/internal/game"
)

func TestCollectionTurnInDispatchRefreshesBagBeforeQuestCompletion(t *testing.T) {
	for _, seeds := range []int{2, 4, 6} {
		t.Run(fmt.Sprintf("seeds_%d", seeds), func(t *testing.T) {
			previousWorld, previousDB := world, db
			defer func() { world, db = previousWorld, previousDB }()
			db = nil
			world = game.NewWorld(nil)
			client := newLevelCommandClient()
			player := newLevelCommandPlayer(client.playerID)
			player.X, player.Z = 20, 215
			world.AddEntity(player)
			world.GenerateDailyQuests(player.ID)
			first, collection := "chronicle_01_bell_below", "chronicle_02_seeds_first_grove"
			world.PerformAcceptQuest(player.ID, first)
			for i := 0; i < 3; i++ {
				world.UpdateQuestProgress(player, "Skeleton")
			}
			if _, ok := world.PerformCompleteQuest(player.ID, first); !ok {
				t.Fatal("first chapter setup failed")
			}
			world.PerformAcceptQuest(player.ID, collection)
			player.Inventory[0] = game.Item{ID: "quest-seeds", Name: "Verdant Memory Seed", Stack: seeds}
			player.Inventory[1] = game.Item{ID: "keep-sword", Name: "Iron Sword", Stack: 1}
			// A saved ready count must not bypass the physical-item requirement.
			world.UpdateCollectionQuestProgress(player, "Verdant Memory Seed", 4)
			goldBefore := player.Gold
			payload, _ := json.Marshal(CompleteQuestPayload{QuestID: collection})
			request := Message{Type: MsgCompleteQuest, Payload: payload}
			client.handleMessage(request)
			messages := drainSentMessages(client.send)
			if seeds < 4 {
				if len(messages) != 1 || messages[0].Type != MsgError || player.Inventory[0].Stack != seeds || player.Gold != goldBefore {
					t.Fatal("missing-item turn-in changed the bag or returned success")
				}
				return
			}
			if len(messages) < 2 || messages[0].Type != MsgInventory || messages[1].Type != MsgQuestUpdate {
				types := make([]string, len(messages))
				for i, message := range messages {
					types[i] = message.Type
				}
				t.Fatalf("completion must refresh the bag before showing completed quests: %v", types)
			}
			var bag []game.Item
			if err := json.Unmarshal(messages[0].Payload, &bag); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(bag, player.Inventory) || bag[0].Stack != seeds-4 || bag[1].ID != "keep-sword" {
				t.Fatalf("bag receipt differs from exact authoritative consumption: %+v", bag)
			}
			if seeds == 4 && bag[0].ID != "" {
				t.Fatal("consumed stack did not free its slot")
			}
			var quests []game.Quest
			if err := json.Unmarshal(messages[1].Payload, &quests); err != nil {
				t.Fatal(err)
			}
			completed := false
			for _, quest := range quests {
				if quest.ID == collection {
					completed = quest.Completed
				}
			}
			if !completed || player.Gold <= goldBefore {
				t.Fatal("inventory refresh lost the completion or reward")
			}
			goldAfter := player.Gold
			client.handleMessage(request)
			messages = drainSentMessages(client.send)
			if len(messages) != 1 || messages[0].Type != MsgError || !reflect.DeepEqual(bag, player.Inventory) || player.Gold != goldAfter {
				t.Fatal("replayed turn-in consumed more items or rewarded again")
			}
		})
	}
}
