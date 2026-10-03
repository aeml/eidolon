package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
)

// Combat, collection and repair callbacks can own scene/entity locks. Request
// the existing bounded latest-capture worker, not DB IO or one job per kill.
// No quest snapshot is queued: a delayed save must include later independent
// progress, bag changes and the complete current character.
func requestQuestProgressSave(playerID string) {
	client := getClientByPlayerID(playerID)
	if client == nil || client.username == "" || client.playerID != "player-"+client.username || client.retired.Load() {
		return
	}
	client.saveMu.Lock()
	client.questSaveRequested++
	client.saveMu.Unlock()
	savePlayer(client)
}

// Capture BEFORE the character snapshot. A request arriving during capture or
// IO remains unconfirmed and requests another fresh pass, rather than being
// consumed by an earlier saved image.
func questProgressSaveSequence(client *Client) uint64 {
	if client == nil {
		return 0
	}
	client.saveMu.Lock()
	defer client.saveMu.Unlock()
	return client.questSaveRequested
}

// Caller owns account work and has confirmed the complete character save.
// Send this image's quests, never an unsaved newer live snapshot after IO.
func sendSavedQuestProgress(client *Client, sequence uint64, quests []game.Quest) {
	if !markQuestProgressSaved(client, sequence) {
		return
	}
	payload, err := json.Marshal(quests)
	if err == nil {
		client.sendSafe(createMessage(MsgQuestUpdate, payload))
	}
}

func markQuestProgressSaved(client *Client, sequence uint64) bool {
	if sequence == 0 || client == nil || !currentCharacterConnection(client) {
		return false
	}
	client.saveMu.Lock()
	if sequence <= client.questSaveConfirmed {
		client.saveMu.Unlock()
		return false
	}
	client.questSaveConfirmed = sequence
	client.saveMu.Unlock()
	return true
}

// Ordinary quest-menu requests may overtake a queued progress save. Persist
// their whole current image too, rather than turning the read route into an
// alternate unsaved progress acknowledgement. Rereads resend a saved image.
// The network dispatcher owns this account's work lock.
func (client *Client) handleQuestSnapshotRequest() {
	if world == nil || client.playerID == "" {
		return
	}
	persistent := characterSaveJournal != nil || characterSaveCommitter != nil || world.OnQuestProgress != nil
	if persistent && (characterSaveJournal == nil || characterSaveCommitter == nil) {
		client.sendError("Your quest journal cannot be confirmed while character persistence recovers. Please retry shortly.")
		return
	}
	world.GenerateDailyQuests(client.playerID)
	sequence := questProgressSaveSequence(client)
	player := world.GetEntityCopy(client.playerID)
	if player == nil {
		return
	}
	if persistent {
		if err := persistCharacterSnapshot(client.username, characterSnapshotForSave(client.username, player)); err != nil {
			client.sendError("Quest journal save pending. Your progress is retained for recovery; please retry shortly.")
			return
		}
		if !currentCharacterConnection(client) {
			return
		}
		markQuestProgressSaved(client, sequence)
	}
	payload, err := json.Marshal(player.Quests)
	if err == nil {
		client.sendSafe(createMessage(MsgQuestUpdate, payload))
	}
}
