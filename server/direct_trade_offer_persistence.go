package main

import (
	"errors"

	"eidolon-server/internal/game"
)

// Prepared coordinator primitive; the current legacy message handlers do NOT
// call it yet. Caller owns both sorted account work locks and has proved there
// is no frozen shared decision. Offer acknowledgement is allowed only on nil
// error. Never undo an unknown save by refunding/removing its private escrow.
func setAndSaveDirectTradeOfferLocked(username, playerID, tradeID string, itemIDs []string, gold int) (*game.DirectTrade, error) {
	if username == "" || playerID != "player-"+username || world == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return nil, errors.New("direct trade character persistence unavailable")
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return nil, err
	}
	player := world.GetEntityCopy(playerID)
	if player == nil || player.Name != username || player.Type != game.TypePlayer {
		return nil, errors.New("direct trade character binding unavailable")
	}
	trade, err := world.SetDurableDirectTradeOffer(playerID, tradeID, itemIDs, gold)
	if err != nil {
		return nil, err
	}
	player = world.GetEntityCopy(playerID)
	if player == nil {
		return nil, errors.New("pinned direct trade character disappeared")
	}
	if err := persistCharacterSnapshot(username, characterSnapshotForSave(username, player)); err != nil {
		return nil, err // The complete outbox/debit is journaled or the actor pinned.
	}
	return trade, nil
}
