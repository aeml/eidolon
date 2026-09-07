package main

import "encoding/json"

func (c *Client) handleChronicleInspection(raw json.RawMessage) {
	if c.playerID == "" {
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
	// Resend the personal snapshot even for a reread, so a lost earlier update
	// cannot leave the journal behind its acknowledged discovery.
	if player := world.GetEntityCopy(c.playerID); player != nil {
		quests, _ := json.Marshal(player.Quests)
		c.sendSafe(createMessage(MsgQuestUpdate, quests))
	}
	receipt, _ := json.Marshal(discovery)
	c.sendSafe(createMessage(MsgChronicleDiscovery, receipt))
}
