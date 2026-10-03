package main

import (
	"encoding/json"

	"eidolon-server/internal/game"
)

// The admission gate owns this account's work lock. All six Forge commands
// share one journal/commit barrier, including upgrades that used to rely only
// on a later autosave. The quote is also mandatory on the network: retrying an
// old request cannot silently buy another rank or destroy a different gem.
func handleForgeTransaction(c *Client, msg Message) {
	if c.username == "" || c.playerID != "player-"+c.username || world == nil {
		return
	}
	var request struct {
		Slot        string           `json:"slot"`
		Amount      int              `json:"amount"`
		EquipSlot   string           `json:"equipSlot"`
		GemInvIndex int              `json:"gemInvIndex"`
		SocketIndex int              `json:"socketIndex"`
		GemIndices  [3]int           `json:"gemIndices"`
		Expected    *game.ForgeQuote `json:"expected"`
	}
	if json.Unmarshal(msg.Payload, &request) != nil || request.Expected == nil {
		c.sendError("Review the Forge preview before confirming this action.")
		return
	}
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		c.sendError("The Forge is unavailable while character persistence recovers.")
		return
	}
	world.Mu.RLock()
	trading := world.TradeByPlayer[c.playerID] != ""
	world.Mu.RUnlock()
	if trading {
		c.sendError("Finish or cancel your direct trade before using the Forge.")
		return
	}
	if err := reconcilePendingCharacterSaveLocked(c.username); err != nil {
		c.sendError("Your previous save is pending. The Forge has not spent more materials; try again after recovery.")
		return
	}
	var success bool
	var reason string
	switch msg.Type {
	case MsgForgeUpgrade:
		_, success, reason = world.PerformForgeUpgrade(c.playerID, request.Slot, request.Amount, request.Expected)
	case MsgForgePotency:
		_, success, reason = world.PerformForgePotency(c.playerID, request.Slot, request.Expected)
	case MsgForgeSocket:
		_, success, reason = world.PerformForgeSocket(c.playerID, request.Slot, request.Expected)
	case MsgForgeInsertGem:
		_, success, reason = world.PerformForgeInsertGem(c.playerID, request.EquipSlot, request.GemInvIndex, request.SocketIndex, request.Expected)
	case MsgForgeCombineGem:
		_, success, reason = world.PerformForgeCombineGems(c.playerID, request.GemIndices, request.Expected)
	case MsgForgeRemoveGem:
		_, success, reason = world.PerformForgeRemoveGem(c.playerID, request.EquipSlot, request.SocketIndex, request.Expected)
	default:
		return
	}
	if !success {
		c.sendError(reason)
		return
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, snapshot)); err != nil {
		// Retain the entire changed item and material debit in the journal (or
		// pin the live copy if writing the journal failed). Never compensate an
		// ambiguous commit or describe its RAM post-image as completed storage.
		c.sendError("Forge save pending. Your current bag is shown; retry after recovery. No completed save has been confirmed.")
	}
	snapshot = world.GetEntityCopy(c.playerID)
	if snapshot != nil {
		bag, _ := json.Marshal(snapshot.Inventory)
		c.sendSafe(createMessage(MsgInventory, bag))
	}
}
