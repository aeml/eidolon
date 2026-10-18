package main

import (
	"encoding/json"
	"errors"
)

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
	if err := world.ValidateChronicleInspection(c.playerID, request.EntityID); err != nil {
		c.sendError(err.Error())
		return
	}
	c.startStationaryCast("chronicle_inspect", request.EntityID, func(castID uint64) error {
		return c.completeChronicleInspection(request.EntityID, castID, persistent)
	})
}

func (c *Client) completeChronicleInspection(entityID string, castID uint64, persistent bool) error {
	discovery, err := world.CompleteChronicleInspectionCast(c.playerID, entityID, castID)
	if err != nil {
		return err
	}
	sequence := questProgressSaveSequence(c)
	player := world.GetEntityCopy(c.playerID)
	if player == nil {
		return errors.New("player unavailable")
	}
	if persistent {
		if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, player)); err != nil {
			return errors.New("Discovery save pending. Your evidence is retained for recovery; please retry shortly.")
		}
		if !currentCharacterConnection(c) {
			return errors.New("Cast cancelled")
		}
		markQuestProgressSaved(c, sequence)
	}
	// Even a reread resends its exact saved snapshot. Do not expose later live
	// discoveries as confirmed while this command's save is waiting.
	c.sendStationaryCast(castID, "chronicle_inspect", entityID, "completed")
	quests, _ := json.Marshal(player.Quests)
	c.sendSafe(createMessage(MsgQuestUpdate, quests))
	receipt, _ := json.Marshal(discovery)
	c.sendSafe(createMessage(MsgChronicleDiscovery, receipt))
	return nil
}
