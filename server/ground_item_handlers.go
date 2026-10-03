package main

import (
	"encoding/json"
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func groundItemCommandReady(client *Client) bool {
	if client.username == "" || client.playerID != "player-"+client.username || world == nil ||
		groundItemOperations == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		client.sendError("Item transfers are unavailable while persistence recovers.")
		return false
	}
	if _, found := pendingGroundItemForAccount(client.username); found {
		client.sendError("Your previous item transfer is retained. Free bag space by selling or stashing items, or retry after recovery.")
		return false
	}
	if err := reconcilePendingCharacterSaveLocked(client.username); err != nil {
		client.sendError("Your previous character save is pending. Please retry shortly.")
		return false
	}
	return true
}

// Caller owns normal admitted character work. No legacy no-store success path:
// publish ground loot and acknowledge the bag only after the complete save.
func handleGroundItemDrop(client *Client, message Message) {
	var payload InventoryDropPayload
	if json.Unmarshal(message.Payload, &payload) != nil {
		client.sendError("Invalid drop selection.")
		return
	}
	if payload.ExpectedStack == nil || *payload.ExpectedStack < 1 {
		client.sendError("Item quantity is missing. Refresh your bag and try again.")
		return
	}
	if !groundItemCommandReady(client) {
		return
	}
	op, err := world.PrepareDurableInventoryDrop(client.playerID, payload.Index, payload.ItemID, *payload.ExpectedStack)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if _, err := prepareAndCompleteGroundItemLocked(op); err != nil {
		client.sendError("Drop/save pending or rejected. Your item is retained for recovery; retry shortly.")
		return
	}
	sendConfirmedGroundInventory(client)
}

func handleGroundItemPickup(client *Client, message Message) {
	var payload PickupPayload
	if json.Unmarshal(message.Payload, &payload) != nil || payload.LootID == "" {
		client.sendError("Invalid loot selection.")
		return
	}
	if !groundItemCommandReady(client) {
		return
	}
	op, err := world.PrepareDurableGroundPickup(client.playerID, payload.LootID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if _, err := prepareAndCompleteGroundItemLocked(op); err != nil {
		if errors.Is(err, game.ErrGroundItemFull) {
			client.sendError("Your pickup is reserved. Free bag space by selling or stashing items; it will finish automatically.")
		} else {
			client.sendError("Pickup/save pending or rejected. Your item is retained for recovery; retry shortly.")
		}
		return
	}
	sendConfirmedGroundInventory(client)
}

func sendConfirmedGroundInventory(client *Client) {
	if world == nil || client == nil || !currentCharacterConnection(client) {
		return
	}
	entity := world.GetEntityCopy(client.playerID)
	if entity != nil && entity.Name == client.username {
		payload, _ := json.Marshal(entity.Inventory)
		client.sendSafe(createMessage(MsgInventory, payload))
	}
}

// Full bags may continue play and make room. Retry only after bag changes or
// background passes, not on every movement packet. Caller owns account work.
func recoverAccountGroundItemLocked(username string) error {
	entry, found := pendingGroundItemForAccount(username)
	if !found || entry.full {
		return nil
	}
	_, err := prepareAndCompleteGroundItemLocked(entry.op)
	if errors.Is(err, game.ErrGroundItemFull) {
		return nil
	}
	if err == nil && world != nil {
		sendInventoryForPlayer(entry.op.PlayerID)
	}
	return err
}

// After authentication only, with this account's work lock already owned.
func recoverColdAccountGroundItemLocked(username string) error {
	if groundItemOperations == nil {
		return nil
	}
	pending, err := groundItemOperations.PendingGroundItemOperations(username, "", 2)
	if err != nil {
		return err
	}
	if len(pending) > 1 {
		return database.ErrGroundItemConflict
	}
	for _, record := range pending {
		if record.Validate() != nil || record.State != database.GroundItemPending || record.Username != username {
			return database.ErrGroundItemConflict
		}
		if err := trackGroundItemLocked(record.GroundItemOperation, true); err != nil {
			return err
		}
	}
	return recoverAccountGroundItemLocked(username)
}

func retryGroundItemAfterBagChangeLocked(client *Client, action string) {
	switch action {
	case MsgSell, MsgStashDeposit, MsgEquip, MsgInventoryMove, MsgInventorySort:
	default:
		return
	}
	entry, found := pendingGroundItemForAccount(client.username)
	if !found {
		return
	}
	_, err := prepareAndCompleteGroundItemLocked(entry.op)
	if err == nil {
		sendConfirmedGroundInventory(client)
	} else if !errors.Is(err, game.ErrGroundItemFull) {
		client.sendError("Your reserved item is retained while its save recovers. Please retry shortly.")
	}
}
