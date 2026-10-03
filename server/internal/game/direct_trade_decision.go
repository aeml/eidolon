package game

import (
	"encoding/json"
	"fmt"
	"math"

	"eidolon-server/internal/database"
)

// The server coordinator holds both account work locks across this capture and
// durable preparation. No economic effect occurs here, and no client-provided
// item/participant/receipt data is accepted as a settlement plan.
func (w *World) PrepareDurableDirectTradeConfirmation(playerID, tradeID string) (*DirectTrade, *database.DirectTradeOperation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, _, _, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, nil, err
	}
	a, b := w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID]
	unlock := lockDirectTradePlayers(a, b)
	defer unlock()
	if a == nil || b == nil || a.Disconnected || b.Disconnected || a.InstanceID != b.InstanceID || a.CasinoSeat != nil || b.CasinoSeat != nil || !directTradeNearby(a, b) {
		trade.ConfirmedA, trade.ConfirmedB = false, false
		return trade.copy(), nil, fmt.Errorf("trade players are no longer available in the same nearby scene")
	}
	op, err := durableDirectTradePlanLocked(trade, a, b, database.DirectTradeSettle)
	if err != nil {
		trade.ConfirmedA, trade.ConfirmedB = false, false
		return trade.copy(), nil, err
	}
	// Preserve ordinary full-recipient rejection before freeze. If asynchronous
	// rewards later fill the bag, the owned delivery still cannot be lost.
	for index, receiver := range []*Entity{a, b} {
		incoming := trade.OfferB
		if index == 1 {
			incoming = trade.OfferA
		}
		if receiver.Gold < 0 || receiver.Gold > math.MaxInt-incoming.Gold {
			trade.ConfirmedA, trade.ConfirmedB = false, false
			return trade.copy(), nil, fmt.Errorf("recipient Gold wallet cannot receive this trade")
		}
		if _, err := placeDirectTradeItemsExactly(receiver.Inventory, incoming.Items); err != nil {
			trade.ConfirmedA, trade.ConfirmedB = false, false
			return trade.copy(), nil, err
		}
	}
	if playerID == trade.PlayerAID {
		trade.ConfirmedA = true
	} else {
		trade.ConfirmedB = true
	}
	if !trade.ConfirmedA || !trade.ConfirmedB {
		return trade.copy(), nil, nil
	}
	return trade.copy(), &op, nil
}

// Invalid authoritative coordinates must not pass proximity via NaN comparisons.
// Cancellation intentionally has no distance requirement so custody stays recoverable.
func directTradeNearby(a, b *Entity) bool {
	distance := math.Hypot(a.X-b.X, a.Z-b.Z)
	return !math.IsNaN(distance) && !math.IsInf(distance, 0) && distance <= 8
}

// Cancellation deliberately does not require nearby/connected players or bag
// space. Both own refunds become retained deliveries; never overflow to loot.
func (w *World) PrepareDurableDirectTradeCancellation(playerID, tradeID string) (*DirectTrade, *database.DirectTradeOperation, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, _, _, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, nil, err
	}
	a, b := w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID]
	unlock := lockDirectTradePlayers(a, b)
	defer unlock()
	op, err := durableDirectTradePlanLocked(trade, a, b, database.DirectTradeCancel)
	if err != nil {
		return nil, nil, err
	}
	return trade.copy(), &op, nil
}

func durableDirectTradePlanLocked(trade *DirectTrade, a, b *Entity, decision string) (database.DirectTradeOperation, error) {
	op := database.DirectTradeOperation{Version: 1, ID: database.DirectTradeOperationID(trade.ID), TradeID: trade.ID,
		Decision: decision, State: database.DirectTradePending, CreatedAt: trade.CreatedAt}
	for index, player := range []*Entity{a, b} {
		if player == nil || player.Type != TypePlayer || player.ID != "player-"+player.Name {
			return op, database.ErrDirectTradeConflict
		}
		peer := b
		offer := trade.OfferA
		if index == 1 {
			peer, offer = a, trade.OfferB
		}
		if peer == nil || peer.Type != TypePlayer || peer.ID != "player-"+peer.Name || peer.Name == player.Name {
			return op, database.ErrDirectTradeConflict
		}
		state, err := database.DecodeDirectTradeState(player.DirectTradeState)
		if err != nil {
			return op, err
		}
		if state.Delivery != nil {
			return op, database.ErrDirectTradeConflict
		}
		payload, err := json.Marshal(offer)
		if err != nil {
			return op, err
		}
		if state.Escrow == nil {
			if len(offer.Items) != 0 || offer.Gold != 0 {
				return op, database.ErrDirectTradeConflict
			}
		} else if state.Escrow.TradeID != trade.ID || state.Escrow.OfferPayload != string(payload) ||
			state.Escrow.PeerUsername != peer.Name || state.Escrow.PeerPlayerID != peer.ID || state.Escrow.PeerCharacterName != peer.Name {
			return op, database.ErrDirectTradeConflict
		}
		owned := map[string]bool{}
		for _, slots := range [][]Item{player.Inventory, player.Stash, player.Buyback} {
			for _, item := range slots {
				if item.ID != "" {
					owned[item.ID] = true
				}
			}
		}
		for _, item := range player.Equipment {
			if item.ID != "" {
				owned[item.ID] = true
			}
		}
		for _, item := range offer.Items {
			if owned[item.ID] || IsChronicleQuestItem(item) {
				return op, database.ErrDirectTradeConflict
			}
		}
		op.Participants[index] = database.DirectTradeParticipant{Username: player.Name, PlayerID: player.ID, CharacterName: player.Name,
			ExpectedRevision: state.Revision, OfferPayload: string(payload)}
	}
	var err error
	op.Fingerprint, err = database.DirectTradeOperationFingerprint(op)
	if err != nil {
		return op, err
	}
	return op, op.Validate()
}
