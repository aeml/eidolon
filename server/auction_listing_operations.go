package main

import (
	"encoding/json"
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func handleDurableTradingCreate(c *Client, player *game.Entity, payload TradingCreatePayload) {
	op, err := world.Trading.PrepareAuctionListing(player, payload.SlotIndex, payload.Bid, payload.Buyout, payload.Duration)
	if err != nil {
		c.sendError(err.Error())
		return
	}
	if err := completePendingAuctionBidLocked(*op); err != nil {
		if errors.Is(err, database.ErrInsufficientGold) || errors.Is(err, game.ErrAuctionListingItemUnavailable) {
			c.sendError(err.Error())
		} else {
			c.sendError("Your auction listing is awaiting recovery. Please try again shortly.")
		}
		return
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return
	}
	invPayload, _ := json.Marshal(snapshot.Inventory)
	invMessage, _ := json.Marshal(Message{Type: MsgInventory, Payload: invPayload})
	c.sendSafe(invMessage)
	listPayload, _ := json.Marshal(world.Trading.GetPlayerAuctions(c.playerID))
	listMessage, _ := json.Marshal(Message{Type: "trading_my_list", Payload: listPayload})
	c.sendSafe(listMessage)
}
