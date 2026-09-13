package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

func (c *Client) handleWardrobe(msg Message) {
	if c.playerID == "" || world == nil {
		return
	}
	message, success := "Wardrobe ready.", true
	var err error
	switch msg.Type {
	case MsgCollectAppearances:
		var count int
		count, err = world.CollectOwnedAppearances(c.playerID)
		message = fmt.Sprintf("Learned %d new looks. Your gear is unchanged.", count)
	case MsgSelectAppearance:
		var request struct {
			Slot string `json:"slot"`
			Key  string `json:"key"`
		}
		if json.Unmarshal(msg.Payload, &request) != nil {
			c.sendError("Invalid appearance request")
			return
		}
		err = world.SelectAppearance(c.playerID, request.Slot, request.Key)
		message = "Appearance updated. Combat stats are unchanged."
	}
	if err != nil {
		success, message = false, strings.ReplaceAll(err.Error(), "loadouts", "appearances")
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	if success && msg.Type != MsgGetWardrobe {
		if saveCharacterDB(c, snapshot) != nil {
			success, message = false, "Wardrobe changed in this session; durable save is pending. Please stay connected."
		}
	}
	payload, _ := json.Marshal(map[string]interface{}{"success": success, "message": message, "collection": snapshot.AppearanceCollection, "appearances": snapshot.Appearances})
	c.sendSafe(createMessage(MsgWardrobeResult, payload))
}
