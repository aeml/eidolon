package main

import (
	"encoding/json"
	"errors"
	"strings"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func handleDirectTradeRequest(client *Client, message Message) {
	if directTradeOperations == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		client.sendError("Trading is unavailable while persistence recovers.")
		return
	}
	var payload TradeRequestPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || strings.TrimSpace(payload.TargetName) == "" {
		client.sendError("invalid trade request")
		return
	}
	target := getClientByUsername(strings.TrimSpace(payload.TargetName))
	if target == nil || target.playerID == "" {
		client.sendError("trade player is offline")
		return
	}
	if chatService.shouldFilter(target.username, client.username) || chatService.shouldFilter(client.username, target.username) {
		client.sendError("trade player is unavailable")
		return
	}
	for _, account := range []string{client.username, target.username} {
		if err := recoverAccountDirectTradesLocked(account); err != nil {
			client.sendError("A previous trade is awaiting recovery; retry shortly.")
			return
		}
		if _, err := claimAndSaveDirectTradeDeliveryLocked(account, directTradeOperations); err != nil {
			client.sendError("A previous trade delivery is still retained. Free bag space or retry after recovery.")
			return
		}
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
	if err := rejectFrozenDirectTradeEditLocked(payload.TradeID); err != nil {
		client.sendError("This trade is awaiting recovery; its frozen offer cannot be edited.")
		return
	}
	trade, err := setAndSaveDirectTradeOfferLocked(client.username, client.playerID, payload.TradeID, payload.ItemIDs, payload.Gold)
	if err != nil {
		client.sendError(err.Error())
		if trade := world.GetActiveDirectTrade(client.playerID); trade != nil && trade.ID == payload.TradeID {
			sendDirectTradeUpdate(trade, "saving")
		}
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
	trade, op, err := world.PrepareDurableDirectTradeConfirmation(client.playerID, payload.TradeID)
	if err != nil {
		client.sendError(err.Error())
		if trade != nil {
			sendDirectTradeUpdate(trade, "rejected")
		}
		return
	}
	if op == nil {
		sendDirectTradeUpdate(trade, "confirm")
		return
	}
	completed, err := prepareAndCompleteDirectTradeLocked(*op)
	if err != nil {
		sendDirectTradeUpdate(trade, "recovering")
		client.sendError("Trade decision/save pending. Your items are retained; retry after recovery.")
		return
	}
	_ = finishDirectTradeDeliveryLocked(*completed)
}

func handleDirectTradeCancel(client *Client, message Message) {
	var payload TradeActionPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid trade cancellation")
		return
	}
	trade, op, err := world.PrepareDurableDirectTradeCancellation(client.playerID, payload.TradeID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	completed, err := prepareAndCompleteDirectTradeLocked(*op)
	if err != nil {
		sendDirectTradeUpdate(trade, "recovering")
		client.sendError("Trade cancellation/save pending. No competing refund was created; retry after recovery.")
		return
	}
	_ = finishDirectTradeDeliveryLocked(*completed)
}

// Both account locks are owned. A stored same-ID decision is immutable even if
// a prior completion response was lost. Private state edits cannot replace it.
func rejectFrozenDirectTradeEditLocked(tradeID string) error {
	if directTradeOperations == nil {
		return database.ErrDirectTradeBusy
	}
	op, err := directTradeOperations.GetDirectTradeOperation(database.DirectTradeOperationID(tradeID))
	if err != nil {
		return err
	}
	if op != nil {
		return database.ErrDirectTradeBusy
	}
	return nil
}

// Shared completion and actual bag delivery are distinct. A full bag or an
// unknown claim save never reopens settlement or falsely announces delivery.
// The caller owns both accounts and the completion came from the trusted store.
func finishDirectTradeDeliveryLocked(op database.DirectTradeOperation) error {
	if op.Validate() != nil || op.State != database.DirectTradeComplete {
		return database.ErrDirectTradeConflict
	}
	trade := &game.DirectTrade{ID: op.TradeID, CreatedAt: op.CreatedAt,
		PlayerAID: op.Participants[0].PlayerID, PlayerBID: op.Participants[1].PlayerID}
	if json.Unmarshal([]byte(op.Participants[0].OfferPayload), &trade.OfferA) != nil ||
		json.Unmarshal([]byte(op.Participants[1].OfferPayload), &trade.OfferB) != nil {
		return database.ErrDirectTradeConflict
	}
	state, messageType := "complete", MsgTradeComplete
	if op.Decision == database.DirectTradeCancel {
		state, messageType = "cancelled", MsgTradeCancel
	}
	var failures []error
	for _, participant := range op.Participants {
		_, err := claimAndSaveDirectTradeDeliveryLocked(participant.Username, directTradeOperations)
		if err != nil && !errors.Is(err, game.ErrDirectTradeDeliveryFull) {
			failures = append(failures, err)
		}
		if client := getClientByPlayerID(participant.PlayerID); client != nil {
			payload, _ := json.Marshal(map[string]any{"trade": trade, "state": state, "deliveryPending": err != nil})
			client.sendSafe(createMessage(messageType, payload))
			if err != nil {
				client.sendError("Trade settled; delivery is safely retained or its save is pending. Free bag space or retry shortly.")
			}
		}
		if world != nil {
			sendInventoryForPlayer(participant.PlayerID)
		}
	}
	return errors.Join(failures...)
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

func cancelDisconnectedDirectTradeLocked(client *Client) error {
	if err := recoverAccountDirectTradesLocked(client.username); err != nil {
		return err
	}
	trade := world.GetActiveDirectTrade(client.playerID)
	if trade == nil {
		return nil
	}
	_, op, err := world.PrepareDurableDirectTradeCancellation(client.playerID, trade.ID)
	if err != nil {
		return err
	}
	completed, err := prepareAndCompleteDirectTradeLocked(*op)
	if err != nil {
		sendDirectTradeUpdate(trade, "recovering")
		return err
	}
	return finishDirectTradeDeliveryLocked(*completed)
}

// A retained delivery must not block ordinary play or prevent freeing a full
// bag. Retry after relevant successful/failed bag actions, never on every move.
func retryLiveDirectTradeDeliveryAfterBagChangeLocked(client *Client, action string) {
	switch action {
	case MsgSell, MsgStashDeposit, MsgInventoryDrop, MsgEquip, MsgInventoryMove, MsgInventorySort:
	default:
		return
	}
	if world == nil || directTradeOperations == nil {
		return
	}
	player := world.GetEntityCopy(client.playerID)
	if player == nil {
		return
	}
	state, err := database.DecodeDirectTradeState(player.DirectTradeState)
	if err != nil || state.Delivery == nil {
		return
	}
	claimed, err := claimAndSaveDirectTradeDeliveryLocked(client.username, directTradeOperations)
	if err != nil && !errors.Is(err, game.ErrDirectTradeDeliveryFull) {
		client.sendError("Your trade delivery is retained or its save is pending; retry shortly.")
	}
	if claimed {
		client.sendSystemChat("Your retained trade delivery has arrived and been saved.")
		sendInventoryForPlayer(client.playerID)
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
