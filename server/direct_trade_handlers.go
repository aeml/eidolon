package main

import (
	"encoding/json"
	"strings"

	"eidolon-server/internal/game"
)

func handleDirectTradeRequest(client *Client, message Message) {
	var payload TradeRequestPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || strings.TrimSpace(payload.TargetName) == "" {
		client.sendError("invalid trade request")
		return
	}
	target := activeClientByUsername(strings.TrimSpace(payload.TargetName))
	if target == nil || target.playerID == "" {
		client.sendError("trade player is offline")
		return
	}
	if chatService.shouldFilter(target.username, client.username) || chatService.shouldFilter(client.username, target.username) {
		client.sendError("trade player is unavailable")
		return
	}
	trade, err := world.StartDirectTrade(client.playerID, target.playerID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	sendDirectTradeUpdate(trade, "open")
}

func handleDirectTradeOffer(client *Client, message Message) {
	var payload TradeOfferPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid trade offer")
		return
	}
	trade, err := world.SetDirectTradeOffer(client.playerID, payload.TradeID, payload.ItemIDs, payload.Gold)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	sendDirectTradeUpdate(trade, "offer")
	sendInventoryForPlayer(client.playerID)
}

func handleDirectTradeConfirm(client *Client, message Message) {
	var payload TradeActionPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid trade confirmation")
		return
	}
	trade, complete, err := world.ConfirmDirectTrade(client.playerID, payload.TradeID)
	if err != nil {
		client.sendError(err.Error())
		if trade != nil {
			sendDirectTradeUpdate(trade, "rejected")
		}
		return
	}
	if !complete {
		sendDirectTradeUpdate(trade, "confirm")
		return
	}
	sendDirectTradeUpdate(trade, "complete")
	sendInventoryForPlayer(trade.PlayerAID)
	sendInventoryForPlayer(trade.PlayerBID)
}

func handleDirectTradeCancel(client *Client, message Message) {
	var payload TradeActionPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid trade cancellation")
		return
	}
	trade, err := world.CancelDirectTrade(client.playerID, payload.TradeID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	sendDirectTradeUpdate(trade, "cancelled")
	sendInventoryForPlayer(trade.PlayerAID)
	sendInventoryForPlayer(trade.PlayerBID)
}

func sendDirectTradeUpdate(trade *game.DirectTrade, state string) {
	if trade == nil {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"trade": trade,
		"state": state,
	})
	messageType := MsgTradeUpdate
	if state == "complete" {
		messageType = MsgTradeComplete
	} else if state == "cancelled" {
		messageType = MsgTradeCancel
	}
	wire := createMessage(messageType, payload)
	for _, playerID := range []string{trade.PlayerAID, trade.PlayerBID} {
		if participant := getClientByPlayerID(playerID); participant != nil {
			participant.sendSafe(wire)
		}
	}
}

func sendInventoryForPlayer(playerID string) {
	client := getClientByPlayerID(playerID)
	entity := world.GetEntityCopy(playerID)
	if client == nil || entity == nil {
		return
	}
	payload, _ := json.Marshal(entity.Inventory)
	client.sendSafe(createMessage(MsgInventory, payload))
}
