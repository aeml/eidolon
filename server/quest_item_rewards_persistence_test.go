package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"go.mongodb.org/mongo-driver/bson"
	"reflect"
	"testing"
)

func TestQuestItemRewardsBSONAndClaimSaveBarrier(t *testing.T) {
	for _, lostAck := range []bool{false, true} {
		t.Run(map[bool]string{false: "save-error", true: "lost-ack"}[lostAck], func(t *testing.T) {
			client, player, store, _ := questConversationFixture(t, false)
			item := *game.GenerateEquipmentLoot(12)
			player.Quests[0].Completed = true
			player.Quests[0].RewardChoiceLevel = 12
			player.Quests[0].RewardChoices = []game.Item{item}
			saved := characterSnapshotForSave(client.username, world.GetEntityCopy(player.ID))
			raw, err := bson.Marshal(saved.Quests[0])
			if err != nil {
				t.Fatal(err)
			}
			var restored database.Quest
			if err = bson.Unmarshal(raw, &restored); err != nil {
				t.Fatal(err)
			}
			loaded := questFromDatabase(restored)
			if !reflect.DeepEqual(loaded.RewardChoices, player.Quests[0].RewardChoices) || loaded.RewardChoiceLevel != 12 {
				t.Fatal("pending offers changed on cold BSON reload")
			}
			store.characters[client.username] = cloneTradeRecoveryCharacter(saved)
			store.failSaveAccount, store.failSaveAfter = client.username, lostAck
			request, _ := json.Marshal(CompleteQuestPayload{QuestID: player.Quests[0].ID, ItemID: item.ID})
			client.handleMessage(Message{Type: MsgClaimQuestItem, Payload: request})
			replies := drainSentMessages(client.send)
			if len(replies) != 1 || replies[0].Type != MsgError {
				t.Fatal("item claim acknowledged before save", replies)
			}
			pending, err := characterSaveJournal.Read(client.username)
			if err != nil || pending == nil {
				t.Fatal("claim not recoverable", err)
			}
			planned, err := pending.Character()
			if err != nil {
				t.Fatal(err)
			}
			if planned.Quests[0].ClaimedRewardID != item.ID || len(planned.Quests[0].RewardChoices) != 0 {
				t.Fatal("saved claim receipt missing")
			}
			liveWorld := world
			world = nil
			if err := retryPendingCharacterSaveLocked(client.username); err != nil {
				t.Fatal(err)
			}
			world = liveWorld
			drainSentMessages(client.send)
			client.handleMessage(Message{Type: MsgClaimQuestItem, Payload: request})
			replies = drainSentMessages(client.send)
			if len(replies) != 1 || replies[0].Type != MsgError {
				t.Fatal("replayed claim accepted", replies)
			}
			final := store.characters[client.username]
			count := 0
			for _, reward := range final.Inventory {
				if reward.ID == item.ID {
					count += reward.Stack
				}
			}
			if count != 1 || final.Gold != saved.Gold || final.EP != saved.EP {
				t.Fatal("replay duplicated item or changed wallets")
			}
		})
	}
}
func TestQuestItemRewardsSuccessfulClaimPublishesSavedBagThenReceipt(t *testing.T) {
	client, player, store, _ := questConversationFixture(t, false)
	item := *game.GenerateEquipmentLoot(30)
	player.Quests[0].Completed = true
	player.Quests[0].RewardChoices = []game.Item{item}
	request, _ := json.Marshal(CompleteQuestPayload{QuestID: player.Quests[0].ID, ItemID: item.ID})
	client.handleMessage(Message{Type: MsgClaimQuestItem, Payload: request})
	replies := drainSentMessages(client.send)
	if len(replies) != 2 || replies[0].Type != MsgInventory || replies[1].Type != MsgQuestUpdate {
		t.Fatal("wrong saved claim reply order", replies)
	}
	var quests []game.Quest
	if json.Unmarshal(replies[1].Payload, &quests) != nil || quests[0].ClaimedRewardID != item.ID {
		t.Fatal("claim receipt missing")
	}
	if store.characters[client.username].Quests[0].ClaimedRewardID != item.ID {
		t.Fatal("confirmed unsaved claim")
	}
}
