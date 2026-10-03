package main

import (
	"encoding/json"
	"errors"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Called only after authentication, while the cold-discovered account/peer
// work locks are held. A pending shared decision wins over orphan cancellation.
func recoverColdAccountDirectTradeLocked(username string) error {
	if directTradeOperations == nil {
		return nil
	}
	pending, err := directTradeOperations.PendingDirectTradeOperations(username, 2)
	if err != nil {
		return err
	}
	if len(pending) > 1 {
		return database.ErrDirectTradeConflict
	}
	for _, op := range pending {
		if op.State != database.DirectTradePending || !directTradeOperationHasAccount(op, username) {
			return database.ErrDirectTradeConflict
		}
		if err := confirmDirectTradeOperationLocked(op); err != nil {
			return err
		}
	}
	if err := recoverAccountDirectTradesLocked(username); err != nil {
		return err
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return err
	}
	character, err := directTradeOperations.GetDirectTradeCharacter(username, username)
	if err != nil || character == nil {
		return err
	}
	state, err := database.DecodeDirectTradeState(character.DirectTradeState)
	if err != nil {
		return err
	}
	if state.Escrow != nil {
		// An intact live offer is cancelled by connection takeover/cleanup, not
		// arbitrarily by another player's cold discovery. Missing actors make
		// the persisted escrow an orphan even if a stale RAM table survived.
		live := false
		if world != nil {
			trade := world.GetActiveDirectTrade("player-" + username)
			live = trade != nil && trade.ID == state.Escrow.TradeID &&
				world.GetEntityCopy(trade.PlayerAID) != nil && world.GetEntityCopy(trade.PlayerBID) != nil
		}
		if !live {
			op, err := directTradeOperations.GetDirectTradeOperation(database.DirectTradeOperationID(state.Escrow.TradeID))
			if err != nil {
				return err
			}
			if op == nil {
				op, err = prepareOrphanDirectTradeCancellationLocked(username, character, state)
				if err != nil {
					return err
				}
			}
			if !directTradeOperationHasAccount(*op, username) {
				return database.ErrDirectTradeConflict
			}
			completed, err := prepareAndCompleteDirectTradeLocked(*op)
			if err != nil {
				return err
			}
			if err := finishDirectTradeDeliveryLocked(*completed); err != nil {
				return err
			}
		}
	}
	_, err = claimAndSaveDirectTradeDeliveryLocked(username, directTradeOperations)
	if errors.Is(err, game.ErrDirectTradeDeliveryFull) {
		return nil // Let the player enter and free bag/wallet room.
	}
	return err
}

// Both account work locks are already owned. Re-read the peer's exact saved
// custody after pending saves; absent/mispaired peers are not guessed/refunded.
func prepareOrphanDirectTradeCancellationLocked(username string, character *database.Character, state *database.DirectTradeCharacterState) (*database.DirectTradeOperation, error) {
	if character == nil || character.Name != username || state == nil || state.Escrow == nil {
		return nil, database.ErrDirectTradeConflict
	}
	escrow := state.Escrow
	peer := escrow.PeerUsername
	if peer == "" || peer == username || escrow.PeerCharacterName != peer || escrow.PeerPlayerID != "player-"+peer {
		return nil, database.ErrDirectTradeConflict
	}
	if err := reconcilePendingCharacterSaveLocked(peer); err != nil {
		return nil, err
	}
	peerCharacter, err := directTradeOperations.GetDirectTradeCharacter(peer, peer)
	if err != nil {
		return nil, err
	}
	if peerCharacter == nil || peerCharacter.Name != peer {
		return nil, database.ErrDirectTradeConflict
	}
	peerState, err := database.DecodeDirectTradeState(peerCharacter.DirectTradeState)
	if err != nil || peerState.Delivery != nil {
		return nil, database.ErrDirectTradeConflict
	}
	// Empty offer uses the same representation as an untouched live gift peer.
	empty, _ := json.Marshal(game.DirectTradeOffer{})
	peerOffer := string(empty)
	if peerState.Escrow != nil {
		if peerState.Escrow.TradeID != escrow.TradeID || peerState.Escrow.PeerUsername != username ||
			peerState.Escrow.PeerCharacterName != username || peerState.Escrow.PeerPlayerID != "player-"+username {
			return nil, database.ErrDirectTradeConflict
		}
		peerOffer = peerState.Escrow.OfferPayload
	} else if world != nil {
		if active := world.GetActiveDirectTrade("player-" + peer); active != nil && active.ID != escrow.TradeID {
			return nil, database.ErrDirectTradeBusy
		}
	}
	op := database.DirectTradeOperation{Version: 1, ID: database.DirectTradeOperationID(escrow.TradeID), TradeID: escrow.TradeID,
		Decision: database.DirectTradeCancel, State: database.DirectTradePending, CreatedAt: time.Now().UTC(),
		Participants: [2]database.DirectTradeParticipant{
			{Username: username, CharacterName: username, PlayerID: "player-" + username, ExpectedRevision: state.Revision, OfferPayload: escrow.OfferPayload},
			{Username: peer, CharacterName: peer, PlayerID: "player-" + peer, ExpectedRevision: peerState.Revision, OfferPayload: peerOffer},
		}}
	op.Fingerprint, err = database.DirectTradeOperationFingerprint(op)
	if err != nil {
		return nil, err
	}
	return &op, op.Validate()
}
