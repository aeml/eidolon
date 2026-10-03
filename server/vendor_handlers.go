package main

import "encoding/json"

// Ordinary vendor operations own one account, unlike the two-account trade
// coordinator. The caller holds its account work lock via handleMessage.
func handleVendorTransaction(c *Client, msg Message) {
	if c.username == "" || c.playerID == "" || world == nil {
		return
	}
	var request SellPayload
	if json.Unmarshal(msg.Payload, &request) != nil || request.ItemID == "" {
		c.sendError("Choose an item to sell or recover.")
		return
	}
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		c.sendError("The vendor is unavailable while character persistence recovers.")
		return
	}
	// Keep vendor edits outside an active trade review. Persisted escrow itself
	// is now retained in complete snapshots; a completed full-bag delivery does
	// not reserve a RAM trade and must allow selling to free delivery space.
	world.Mu.RLock()
	trading := world.TradeByPlayer[c.playerID] != ""
	world.Mu.RUnlock()
	if trading {
		c.sendError("Finish or cancel your direct trade before using the vendor.")
		return
	}
	if err := reconcilePendingCharacterSaveLocked(c.username); err != nil {
		c.sendError("Your previous save is pending. The vendor has not changed another item; try again after recovery.")
		return
	}
	var success bool
	switch msg.Type {
	case MsgSell:
		_, success = world.PerformSell(c.playerID, request.ItemID)
	case MsgBuyback:
		_, success = world.PerformBuyback(c.playerID, request.ItemID)
	default:
		return
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	if success {
		if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, snapshot)); err != nil {
			// Keep the complete post-image in the existing journal (or pin the
			// live entity on a local-write failure). Do not compensate, grant a
			// second effect or claim durable success after an unknown result.
			c.sendError("Vendor save pending. Your current bag is shown; retry the same item after recovery. No completed save has been confirmed.")
		}
	} else {
		c.sendError("That vendor action is unavailable. Check the item, your Gold and bag space.")
	}
	snapshot = world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	// Also resynchronize a repeated request after its first effect was recovered.
	// These are authoritative current views, not a durable-success notification.
	bag, _ := json.Marshal(snapshot.Inventory)
	buyback, _ := json.Marshal(snapshot.Buyback)
	c.sendSafe(createMessage(MsgInventory, bag))
	c.sendSafe(createMessage(MsgBuybackList, buyback))
}
