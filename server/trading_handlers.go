package main

import (
	"encoding/json"
	"fmt"

	"eidolon-server/internal/game"
)

// handleMsgTradingSearch searches active auctions and sends results to the caller.
func handleMsgTradingSearch(c *Client, msg Message) {
	var payload TradingSearchPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}
	results := world.Trading.SearchAuctions(payload.Query)

	resPayload, _ := json.Marshal(results)
	resp := Message{
		Type:    "trading_list",
		Payload: resPayload,
	}
	b, _ := json.Marshal(resp)
	c.sendSafe(b)
}

// handleMsgTradingMyAuctions sends the caller's active auctions.
func handleMsgTradingMyAuctions(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	results := world.Trading.GetPlayerAuctions(c.playerID)

	resPayload, _ := json.Marshal(results)
	resp := Message{
		Type:    "trading_my_list",
		Payload: resPayload,
	}
	b, _ := json.Marshal(resp)
	c.sendSafe(b)
}

// handleMsgTradingCreate lists an item from the caller's inventory as an auction.
func handleMsgTradingCreate(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload TradingCreatePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	world.Mu.Lock()
	player, ok := world.Entities[c.playerID]
	world.Mu.Unlock()

	if !ok {
		return
	}

	player.Mu.Lock()
	if payload.SlotIndex < 0 || payload.SlotIndex >= len(player.Inventory) {
		player.Mu.Unlock()
		c.sendError("Invalid inventory slot")
		return
	}
	item := player.Inventory[payload.SlotIndex]

	if item.ID == "" {
		player.Mu.Unlock()
		c.sendError("No item in slot")
		return
	}

	// Remove item immediately to prevent duplication
	copy(player.Inventory[payload.SlotIndex:], player.Inventory[payload.SlotIndex+1:])
	player.Inventory = player.Inventory[:len(player.Inventory)-1]
	player.Mu.Unlock()

	_, err := world.Trading.CreateAuction(player, item, payload.Bid, payload.Buyout, payload.Duration)
	if err != nil {
		// Refund item on failure
		player.Mu.Lock()
		player.AddItemToInventory(item)
		player.Mu.Unlock()
		c.sendError(err.Error())

		// Send Inventory Update (to show item back)
		player.Mu.Lock()
		invPayload, _ := json.Marshal(player.Inventory)
		player.Mu.Unlock()
		msgInv := Message{
			Type:    MsgInventory,
			Payload: invPayload,
		}
		bInv, _ := json.Marshal(msgInv)
		c.sendSafe(bInv)
		return
	}

	invPayload, _ := json.Marshal(player.Inventory)
	resp := Message{
		Type:    MsgInventory,
		Payload: invPayload,
	}
	b, _ := json.Marshal(resp)
	c.sendSafe(b)

	results := world.Trading.GetPlayerAuctions(c.playerID)
	resPayload, _ := json.Marshal(results)
	resp2 := Message{
		Type:    "trading_my_list",
		Payload: resPayload,
	}
	b2, _ := json.Marshal(resp2)
	c.sendSafe(b2)
}

// handleMsgTradingBid places a bid on an active auction.
func handleMsgTradingBid(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload TradingBidPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	world.Mu.Lock()
	player, ok := world.Entities[c.playerID]
	world.Mu.Unlock()

	if !ok {
		return
	}

	refundFunc := func(targetID, targetName string, amount int) {
		// Try to find online player
		world.Mu.Lock()
		target, ok := world.Entities[targetID]
		world.Mu.Unlock()

		if ok {
			target.Mu.Lock()
			target.Gold += amount
			target.Mu.Unlock()

			// We could try to notify them if we had the client, but gold update is enough for now.
			// Next time they check inventory it will be there.
		} else {
			// Offline refund
			char, err := db.GetCharacter(targetID, targetName)
			if err == nil {
				char.Gold += amount
				db.SaveCharacter(targetID, char)
			}
		}
	}

	err := world.Trading.BidAuction(payload.AuctionID, player, payload.Amount, refundFunc)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	// Send Inventory Update (Gold changed)
	player.Mu.Lock()
	invPayload, _ := json.Marshal(player.Inventory)
	player.Mu.Unlock()
	msgInv := Message{
		Type:    MsgInventory,
		Payload: invPayload,
	}
	bInv, _ := json.Marshal(msgInv)
	c.sendSafe(bInv)

	c.sendError("Bid placed!")

	// Refresh Search List
	msgRefresh := Message{
		Type:    "trading_refresh",
		Payload: nil,
	}
	bRefresh, _ := json.Marshal(msgRefresh)
	c.sendSafe(bRefresh)
}

// handleMsgTradingBuyout immediately purchases an auctioned item at the buyout price.
func handleMsgTradingBuyout(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload TradingBuyoutPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	world.Mu.Lock()
	player, ok := world.Entities[c.playerID]
	world.Mu.Unlock()

	if !ok {
		return
	}

	_, err := world.Trading.BuyoutAuction(payload.AuctionID, player, world)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	invPayload, _ := json.Marshal(player.Inventory)
	resp := Message{
		Type:    MsgInventory,
		Payload: invPayload,
	}
	b, _ := json.Marshal(resp)
	c.sendSafe(b)

	c.sendError("Auction bought!")

	// Refresh Search List
	msgRefresh := Message{
		Type:    "trading_refresh",
		Payload: nil,
	}
	bRefresh, _ := json.Marshal(msgRefresh)
	c.sendSafe(bRefresh)
}

// handleMsgTradingCollect collects the proceeds of a completed auction (gold or item).
func handleMsgTradingCollect(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload TradingCollectPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	world.Mu.Lock()
	player, ok := world.Entities[c.playerID]
	world.Mu.Unlock()

	if !ok {
		return
	}

	result, err := world.Trading.CollectAuction(payload.AuctionID, player)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	if gold, ok := result.(int); ok {
		c.sendError(fmt.Sprintf("Collected %d gold", gold))
	} else if item, ok := result.(game.Item); ok {
		player.Mu.Lock()
		remaining := player.AddItemToInventory(item)
		player.Mu.Unlock()

		if remaining > 0 {
			// Update item stack to remaining amount
			item.Stack = remaining

			// Fallback to Stash
			player.Mu.Lock()
			stashRemaining := player.AddItemToStash(item)
			player.Mu.Unlock()

			if stashRemaining == 0 {
				c.sendError("Inventory full! Item sent to Stash.")
				// Send Stash Update
				stashPayload, _ := json.Marshal(player.Stash)
				msgStash := Message{
					Type:    MsgStash,
					Payload: stashPayload,
				}
				bStash, _ := json.Marshal(msgStash)
				c.sendSafe(bStash)
			} else {
				// Stash also full - Drop on Ground
				item.Stack = stashRemaining
				world.DropLoot(item, player.X, player.Z)
				c.sendError("Inventory & Stash full! Item dropped on ground.")
			}
		} else {
			c.sendError("Item reclaimed")
		}
	}

	invPayload, _ := json.Marshal(player.Inventory)
	resp := Message{
		Type:    MsgInventory,
		Payload: invPayload,
	}
	b, _ := json.Marshal(resp)
	c.sendSafe(b)

	results := world.Trading.GetPlayerAuctions(c.playerID)
	resPayload, _ := json.Marshal(results)
	resp2 := Message{
		Type:    "trading_my_list",
		Payload: resPayload,
	}
	b2, _ := json.Marshal(resp2)
	c.sendSafe(b2)

	// Refresh Search List
	msgRefresh := Message{
		Type:    "trading_refresh",
		Payload: nil,
	}
	bRefresh, _ := json.Marshal(msgRefresh)
	c.sendSafe(bRefresh)
}

// handleMsgTradingCancel cancels an active auction and returns the item to inventory.
func handleMsgTradingCancel(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload TradingCancelPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	world.Mu.Lock()
	player, ok := world.Entities[c.playerID]
	world.Mu.Unlock()

	if !ok {
		return
	}

	err := world.Trading.CancelAuction(payload.AuctionID, player, world)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	c.sendError("Auction cancelled & item reclaimed")

	// Send Inventory Update
	player.Mu.Lock()
	invPayload, _ := json.Marshal(player.Inventory)
	player.Mu.Unlock()
	msgInv := Message{
		Type:    MsgInventory,
		Payload: invPayload,
	}
	bInv, _ := json.Marshal(msgInv)
	c.sendSafe(bInv)

	// Refresh My Auctions
	results := world.Trading.GetPlayerAuctions(c.playerID)
	resPayload, _ := json.Marshal(results)
	resp2 := Message{
		Type:    "trading_my_list",
		Payload: resPayload,
	}
	b2, _ := json.Marshal(resp2)
	c.sendSafe(b2)

	// Refresh Search List
	msgRefresh := Message{
		Type:    "trading_refresh",
		Payload: nil,
	}
	bRefresh, _ := json.Marshal(msgRefresh)
	c.sendSafe(bRefresh)
}
