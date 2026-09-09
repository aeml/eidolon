package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"eidolon-server/internal/game"
)

func TestCollectionTurnInDispatchRefreshesBagBeforeQuestCompletion(t *testing.T) {
	for _, seeds := range []int{6, 8, 10} {
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
			// Complete the newly required diary through its real recording and
			// manual turn-in paths before testing collection bag receipts.
			diary := game.ChronicleInvestigationCatalog()[0]
			site := diary.Sites[0]
			world.AddEntity(&game.Entity{ID: site.EntityID, Type: game.TypeNPC, SubType: "ChronicleSite", X: site.X, Z: site.Z})
			if _, ok := world.PerformAcceptQuest(player.ID, diary.ID); !ok {
				t.Fatal("diary acceptance failed")
			}
			player.X, player.Z = site.X, site.Z
			if _, err := world.InspectChronicleSite(player.ID, site.EntityID); err != nil {
				t.Fatal(err)
			}
			player.X, player.Z = 20, 215
			if _, ok := world.PerformCompleteQuest(player.ID, diary.ID); !ok {
				t.Fatal("diary manual turn-in failed")
			}
			// Prepared objective credit keeps this a bag-receipt dispatch test;
			// real qualifying enemy deaths are covered by the hunt pipeline test.
			hunt := game.ChronicleHuntCatalog()[0]
			if _, ok := world.PerformAcceptQuest(player.ID, hunt.ID); !ok {
				t.Fatal("watch acceptance failed")
			}
			for i := 0; i < hunt.Count; i++ {
				world.UpdateQuestProgress(player, "ChronicleHunt:"+hunt.ID)
			}
			if _, ok := world.PerformCompleteQuest(player.ID, hunt.ID); !ok {
				t.Fatal("watch manual turn-in failed")
			}
			world.PerformAcceptQuest(player.ID, collection)
			required := 0
			for _, quest := range player.Quests {
				if quest.ID == collection {
					required = quest.MaxCount
				}
			}
			if required != 8 {
				t.Fatalf("expected current eight-fragment contract, got %d", required)
			}
			player.Inventory[0] = game.Item{ID: "quest-seeds", Name: "Verdant Memory Seed", Stack: seeds}
			player.Inventory[1] = game.Item{ID: "keep-sword", Name: "Iron Sword", Stack: 1}
			// A saved ready count must not bypass the physical-item requirement.
			world.UpdateCollectionQuestProgress(player, "Verdant Memory Seed", required)
			goldBefore := player.Gold
			payload, _ := json.Marshal(CompleteQuestPayload{QuestID: collection})
			request := Message{Type: MsgCompleteQuest, Payload: payload}
			client.handleMessage(request)
			messages := drainSentMessages(client.send)
			if seeds < required {
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
			if !reflect.DeepEqual(bag, player.Inventory) || bag[0].Stack != seeds-required || bag[1].ID != "keep-sword" {
				t.Fatalf("bag receipt differs from exact authoritative consumption: %+v", bag)
			}
			if seeds == required && bag[0].ID != "" {
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
