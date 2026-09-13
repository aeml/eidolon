package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
)

type loadoutResponse struct {
	Action   string                  `json:"action"`
	Success  bool                    `json:"success"`
	Applied  bool                    `json:"applied"`
	Message  string                  `json:"message"`
	Profiles []game.EquipmentLoadout `json:"profiles"`
	Hotbar   []string                `json:"hotbar,omitempty"`
}

// Admission already owns this account's work lock. Equipment mutation is atomic
// under the world lock; acknowledgement waits for the ordinary durable journal.
func (c *Client) handleEquipmentLoadout(msg Message) {
	if c.playerID == "" || world == nil {
		return
	}
	result := loadoutResponse{Action: msg.Type, Success: true}
	var request struct {
		Index  *int     `json:"index"`
		Name   string   `json:"name"`
		Hotbar []string `json:"hotbar"`
	}
	if msg.Type != MsgGetLoadouts {
		if json.Unmarshal(msg.Payload, &request) != nil || request.Index == nil {
			result.Success, result.Message = false, "Choose a loadout slot."
		} else {
			var err error
			if msg.Type == MsgSaveLoadout {
				err = world.SaveEquipmentLoadout(c.playerID, *request.Index, request.Name, request.Hotbar)
				result.Message = "Equipment and skill bar saved."
			} else {
				var profile game.EquipmentLoadout
				profile, err = world.ApplyEquipmentLoadout(c.playerID, *request.Index)
				if err == nil {
					result.Applied, result.Hotbar = true, profile.Hotbar
				}
				result.Message = "Loadout equipped."
			}
			if err != nil {
				result.Success, result.Message = false, err.Error()
			} else if snapshot := world.GetEntityCopy(c.playerID); snapshot != nil {
				if saveCharacterDB(c, snapshot) != nil {
					// Do not claim a rollback after a journal/database failure: the
					// live change exists and the normal save recovery retains it.
					result.Success, result.Message = false, "Loadout changed in this session; durable save is pending. Please stay connected."
				}
			}
		}
	}
	if snapshot := world.GetEntityCopy(c.playerID); snapshot != nil {
		result.Profiles = snapshot.EquipmentLoadouts
		if result.Applied {
			payload, _ := json.Marshal(snapshot.Inventory)
			c.sendSafe(createMessage(MsgInventory, payload))
		}
	}
	if result.Profiles == nil {
		result.Profiles = []game.EquipmentLoadout{}
	}
	payload, _ := json.Marshal(result)
	c.sendSafe(createMessage(MsgLoadoutResult, payload))
}
