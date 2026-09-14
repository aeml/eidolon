package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
)

func (c *Client) handleCosmeticVendor(msg Message) {
	if c.username == "" || c.playerID == "" || world == nil {
		return
	}
	var request struct {
		ID        string `json:"id"`
		Confirmed bool   `json:"confirmed"`
		PriceEP   int    `json:"priceEP"`
	}
	success, pending, message := true, false, "Veyra: A new look, never a stronger weapon. VIP membership is not required to spend your EP here."
	if err := world.CanUseCosmeticVendor(c.playerID); err != nil {
		success, message = false, err.Error()
	} else if msg.Type == MsgBuyCosmetic {
		if json.Unmarshal(msg.Payload, &request) != nil || !request.Confirmed {
			success, message = false, "Confirm the cosmetic and its EP cost first."
		} else if characterSaveJournal == nil || characterSaveCommitter == nil {
			success, message = false, "The outfitter is unavailable while character persistence recovers."
		} else if err := retryPendingCharacterSaveLocked(c.username); err != nil {
			success, pending, message = false, true, "A save is pending. Retry this same cosmetic after recovery."
		} else if _, err := world.BuyCosmetic(c.playerID, request.ID, request.PriceEP); err != nil {
			success, message = false, err.Error()
		} else if err := saveCharacterDB(c, world.GetEntityCopy(c.playerID)); err != nil {
			success, pending, message = false, true, "Cosmetic save pending. Retrying this unlock cannot charge twice."
		} else {
			message = "Cosmetic saved to your wardrobe. Apply it over equipped gear in town; combat stats never change."
		}
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"success": success, "pending": pending, "message": message, "id": request.ID,
		"catalogue": game.CosmeticCatalogue(), "ep": snapshot.EP,
		"collection": snapshot.AppearanceCollection, "appearances": snapshot.Appearances,
	})
	c.sendSafe(createMessage(MsgCosmeticVendorResult, payload))
}
