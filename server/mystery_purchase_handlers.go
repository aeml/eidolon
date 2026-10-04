package main

import "encoding/json"

// The ordinary protocol admission gate holds this account's work lock. A
// mystery-box click is a new purchase, not a retryable table wager. Settle any
// previous save first, and never reroll an uncertain purchase during recovery.
func handleMysteryPurchase(c *Client, msg Message) {
	if c.username == "" || c.playerID != "player-"+c.username || world == nil {
		return
	}
	var request BuyGamblePayload
	if json.Unmarshal(msg.Payload, &request) != nil || request.Slot == "" {
		c.sendError("Choose a mystery item to purchase.")
		return
	}
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		c.sendError("Mystery purchases are unavailable while character persistence recovers.")
		return
	}
	world.Mu.RLock()
	trading := world.TradeByPlayer[c.playerID] != ""
	world.Mu.RUnlock()
	if trading {
		c.sendError("Finish or cancel your direct trade before buying a mystery item.")
		return
	}
	recovered, err := reconcilePendingCharacterSaveWithStatusLocked(c.username)
	if err != nil {
		c.sendError("Your previous save is pending. No new mystery item was purchased; wait for recovery.")
		return
	}
	if recovered {
		c.sendError("Your previous save was recovered. No new mystery item was purchased; review your bag before buying another.")
		if snapshot := world.GetEntityCopy(c.playerID); snapshot != nil {
			bag, _ := json.Marshal(snapshot.Inventory)
			c.sendSafe(createMessage(MsgInventory, bag))
		}
		return
	}
	if _, success := world.PerformBuyGamble(c.playerID, request.Slot); !success {
		c.sendError("That mystery purchase is unavailable. Check your Gold, bag space and selected item type.")
		return
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, snapshot)); err != nil {
		// Retain the complete original roll/debit in the journal, or pin the
		// live post-image if the local write failed. Never refund/reroll an
		// ambiguous save or publish the random result as a confirmed purchase.
		c.sendError("Mystery purchase save pending. Do not buy again to retry; your original item is retained while storage recovers.")
		return
	}
	bag, _ := json.Marshal(snapshot.Inventory)
	c.sendSafe(createMessage(MsgInventory, bag))
}
