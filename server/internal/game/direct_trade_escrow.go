package game

import (
	"encoding/json"
	"errors"
	"math"

	"eidolon-server/internal/database"
)

func directTradeUsesPrivateState(players ...*Entity) bool {
	for _, player := range players {
		if player != nil && len(player.DirectTradeState) != 0 {
			return true
		}
	}
	return false
}

// Caller owns all supplied actor locks. A newly hydrated, unresolved escrow or
// owned delivery cannot be reused as another trade's apparent available funds.
func directTradeReadyForNewOffer(players ...*Entity) error {
	for _, player := range players {
		state, err := database.DecodeDirectTradeState(player.DirectTradeState)
		if err != nil {
			return err
		}
		if state.Escrow != nil || state.Delivery != nil {
			return errors.New("a previous direct trade is awaiting recovery or delivery")
		}
	}
	return nil
}

// Build private escrow BEFORE any live bag/Gold/confirmation mutation. The
// existing planner supplies exact server-owned items; client item payloads are
// never accepted. This producer, not a snapshot projection, owns the debit.
func prepareDirectTradeEscrow(player, peer *Entity, tradeID string, previous, next DirectTradeOffer) ([]byte, bool, error) {
	state, err := database.DecodeDirectTradeState(player.DirectTradeState)
	if err != nil {
		return nil, false, err
	}
	if state.Delivery != nil {
		return nil, false, database.ErrDirectTradeConflict
	}
	previousBytes, err := json.Marshal(previous)
	if err != nil {
		return nil, false, err
	}
	nextBytes, err := json.Marshal(next)
	if err != nil {
		return nil, false, err
	}
	if state.Escrow == nil {
		if previous.Gold != 0 || len(previous.Items) != 0 {
			return nil, false, database.ErrDirectTradeConflict
		}
	} else {
		if state.Escrow.TradeID != tradeID || state.Escrow.OfferPayload != string(previousBytes) {
			return nil, false, database.ErrDirectTradeConflict
		}
		if state.Escrow.PeerUsername != "" && (state.Escrow.PeerUsername != peer.Name || state.Escrow.PeerPlayerID != peer.ID || state.Escrow.PeerCharacterName != peer.Name) {
			return nil, false, database.ErrDirectTradeConflict
		}
		if state.Escrow.PeerUsername != "" && state.Escrow.OfferPayload == string(nextBytes) {
			return database.CloneDirectTradeState(player.DirectTradeState), true, nil
		}
	}
	if state.Revision == math.MaxInt64 {
		return nil, false, database.ErrDirectTradeConflict
	}
	state.Revision++
	state.Escrow = &database.DirectTradeEscrowState{TradeID: tradeID, OfferPayload: string(nextBytes),
		PeerUsername: peer.Name, PeerPlayerID: peer.ID, PeerCharacterName: peer.Name}
	encoded, err := database.EncodeDirectTradeState(*state)
	if err != nil {
		return nil, false, err
	}
	return encoded, false, nil
}
