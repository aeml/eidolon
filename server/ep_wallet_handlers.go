package main

import (
	"eidolon-server/internal/database"
	"encoding/json"
)

func (c *Client) handleEPWallet(msg Message) {
	if c.username == "" || c.playerID == "" || world == nil {
		return
	}
	var request struct {
		ID        string `json:"id"`
		Amount    int    `json:"amount"`
		Confirmed bool   `json:"confirmed"`
	}
	success, pending, message := true, false, "EP cannot be converted back to Gold."
	if msg.Type == MsgExchangeGoldForEP {
		if json.Unmarshal(msg.Payload, &request) != nil || !request.Confirmed {
			c.sendError("Confirm the one-way Gold to EP exchange first")
			return
		}
		// Never accept new spending while a prior full save is unresolved.
		if characterSaveJournal == nil || characterSaveCommitter == nil {
			success, message = false, "Exchange unavailable: character persistence is not ready."
		} else if err := retryPendingCharacterSaveLocked(c.username); err != nil {
			success, pending, message = false, true, "A previous save is pending. Retry this same exchange after recovery."
		} else if err := world.ExchangeGoldForEP(c.playerID, request.ID, request.Amount); err != nil {
			success, message = false, err.Error()
		} else if err := saveCharacterDB(c, world.GetEntityCopy(c.playerID)); err != nil {
			success, pending, message = false, true, "Exchange save pending. Stay connected; retrying this receipt will not charge twice."
		} else {
			message = "Exchange saved. EP is for cosmetics and EP-only casino play, never character power."
		}
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"success": success, "pending": pending, "message": message, "id": request.ID,
		"ep": snapshot.EP, "gold": snapshot.Gold, "goldPerEP": database.GoldPerEP,
	})
	c.sendSafe(createMessage(MsgEPWalletResult, payload))
}
