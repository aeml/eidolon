package main

import "encoding/json"

func (c *Client) handleChronicleInspection(raw json.RawMessage) {
	if c.playerID == "" || world == nil {
		return
	}
	// Main installs both stores and the progress callback before admission.
	// Only game-only fixtures with NONE of these may omit persistence.
	persistent := characterSaveJournal != nil || characterSaveCommitter != nil || world.OnQuestProgress != nil
	if persistent && (characterSaveJournal == nil || characterSaveCommitter == nil) {
		c.sendError("Your discovery cannot be confirmed while character persistence recovers. Please retry shortly.")
		return
	}
	var request struct {
		EntityID string `json:"entityId"`
	}
	if err := json.Unmarshal(raw, &request); err != nil || request.EntityID == "" || len(request.EntityID) > 128 {
		c.sendError("Choose a nearby Chronicle discovery to investigate.")
		return
	}
	discovery, err := world.InspectChronicleSite(c.playerID, request.EntityID)
	if err != nil {
		c.sendError(err.Error())
		return
	}
	sequence := questProgressSaveSequence(c)
	player := world.GetEntityCopy(c.playerID)
	if player == nil {
		return
	}
	if persistent {
		if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, player)); err != nil {
			c.sendError("Discovery save pending. Your evidence is retained for recovery; please retry shortly.")
			return
		}
		if !currentCharacterConnection(c) {
			return
		}
		markQuestProgressSaved(c, sequence)
	}
	// Even a reread resends its exact saved snapshot. Do not expose later live
	// discoveries as confirmed while this command's save is waiting.
	quests, _ := json.Marshal(player.Quests)
	c.sendSafe(createMessage(MsgQuestUpdate, quests))
	receipt, _ := json.Marshal(discovery)
	c.sendSafe(createMessage(MsgChronicleDiscovery, receipt))
}
