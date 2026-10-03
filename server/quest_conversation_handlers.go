package main

import "encoding/json"

// Called under normal account work ownership. Acceptance freezes the promised
// quote; completion saves that quote's exact item consumption and earned reward
// before publishing a completion conversation. A failed/unknown save is retained
// by the existing character journal, never compensated or awarded a second time.
func handleQuestConversation(client *Client, message Message) {
	if client.username == "" || client.playerID != "player-"+client.username || world == nil {
		return
	}
	var request CompleteQuestPayload
	if json.Unmarshal(message.Payload, &request) != nil || request.QuestID == "" {
		client.sendError("Select a quest before speaking to its giver.")
		return
	}
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		client.sendError("Quest conversations are unavailable while character persistence recovers.")
		return
	}
	if err := reconcilePendingCharacterSaveLocked(client.username); err != nil {
		client.sendError("Your previous save is pending. No new quest reward has been issued; retry after recovery.")
		return
	}
	var advancePayload []byte
	if message.Type == MsgAcceptQuest {
		if _, accepted := world.PerformAcceptQuest(client.playerID, request.QuestID); !accepted {
			client.sendError("Speak to the correct quest giver nearby to accept an available quest.")
			return
		}
	} else if message.Type == MsgCompleteQuest {
		_, advance, completed := world.PerformCompleteQuestDeferred(client.playerID, request.QuestID)
		if !completed {
			client.sendError("Return to the correct quest giver with all objectives and required items to complete this quest.")
			return
		}
		if advance != nil {
			advancePayload, _ = json.Marshal(advance)
		}
	} else {
		return
	}
	snapshot := world.GetEntityCopy(client.playerID)
	if snapshot == nil {
		return
	}
	if err := persistCharacterSnapshot(client.username, characterSnapshotForSave(client.username, snapshot)); err != nil {
		client.sendError("Quest save pending. Your conversation and earned reward are retained for recovery; no completed save has been confirmed. Retry after recovery.")
		return
	}
	if !currentCharacterConnection(client) {
		return
	}
	snapshot = world.GetEntityCopy(client.playerID)
	if snapshot == nil {
		return
	}
	if message.Type == MsgCompleteQuest {
		// Publish item consumption before the quest dialogue moves on.
		bag, _ := json.Marshal(snapshot.Inventory)
		client.sendSafe(createMessage(MsgInventory, bag))
	}
	quests, _ := json.Marshal(snapshot.Quests)
	client.sendSafe(createMessage(MsgQuestUpdate, quests))
	if message.Type == MsgCompleteQuest {
		if advancePayload != nil {
			client.sendSafe(createMessage("chronicle_advance", advancePayload))
		}
		sendEndgameState(client)
	}
}
