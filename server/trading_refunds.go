package main

import (
	"errors"
	"maps"
	"strings"

	"eidolon-server/internal/database"
)

func cloneGoldCreditReceipts(receipts map[string]int) map[string]int { return maps.Clone(receipts) }
func cloneItemDeliveryReceipts(receipts map[string]string) map[string]string {
	return maps.Clone(receipts)
}

// Auction outbox owns retry. A returned error retains its intent; a committed
// receipt makes repeated delivery harmless even after expiry or process restart.
func deliverAuctionRefund(refund database.AuctionRefund) error {
	if !strings.HasPrefix(refund.PlayerID, "player-") || refund.CharacterName == "" {
		return errors.New("invalid auction refund recipient")
	}
	username := strings.TrimPrefix(refund.PlayerID, "player-")
	if username == "" || username != refund.CharacterName {
		return errors.New("auction refund account mismatch")
	}
	unlock := lockCharacterWork(username)
	defer unlock()
	return deliverAuctionRefundLocked(refund)
}

// The caller already owns account ordering (ordinary auction commands do).
func deliverAuctionRefundLocked(refund database.AuctionRefund) error {
	username := refund.CharacterName
	if username == "" || refund.PlayerID != "player-"+username {
		return errors.New("auction credit account mismatch")
	}
	// Flush/replay the newest full snapshot before applying a new credit. Never
	// increment an older Mongo document beneath an uncommitted pending snapshot.
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	if world != nil {
		live, err := world.ApplyDurablePlayerGoldCredit(refund.PlayerID, refund.ID, refund.Amount)
		if err != nil {
			return err
		}
		if live {
			entity := world.GetEntityCopy(refund.PlayerID)
			if entity == nil {
				return errors.New("pinned refund recipient disappeared")
			}
			return persistCharacterSnapshot(username, characterSnapshotForSave(username, entity))
		}
	}
	if db == nil {
		return errors.New("offline refund database is unavailable")
	}
	character, err := db.GetCharacter(username, refund.CharacterName)
	if err != nil {
		return err
	}
	if err := database.ApplyGoldCredit(&character.Gold, &character.GoldCreditReceipts, refund.ID, refund.Amount); err != nil {
		return err
	}
	return persistCharacterSnapshot(username, character)
}
