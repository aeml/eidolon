package main

import (
	"errors"
	"strings"

	"eidolon-server/internal/database"
)

// Caller owns this account's character-work lock, then the table lock, in that
// order. Never acquire another player's account lock while holding a table lock.
// Background recovery takes the same locks; a pending intent blocks table moves.
func applyCasinoGoldTransferLocked(op database.BlackjackTransfer) error {
	if err := op.Validate(); err != nil {
		return err
	}
	username := strings.TrimPrefix(op.PlayerID, "player-")
	if op.Amount > 0 {
		// Reuse the existing full-save/receipt credit path, not a second wallet.
		return deliverAuctionRefundLocked(database.AuctionRefund{ID: op.ID, PlayerID: op.PlayerID, CharacterName: username, Amount: op.Amount})
	}
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	if world != nil {
		live, err := world.ApplyDurablePlayerGoldDebit(op.PlayerID, op.ID, -op.Amount)
		if err != nil {
			return err
		}
		if live {
			entity := world.GetEntityCopy(op.PlayerID)
			if entity == nil {
				return errors.New("pinned casino player disappeared")
			}
			return persistCharacterSnapshot(username, characterSnapshotForSave(username, entity))
		}
	}
	if db == nil {
		return errors.New("casino account database unavailable")
	}
	character, err := db.GetCharacter(username, username)
	if err != nil {
		return err
	}
	_, replay := character.GoldCreditReceipts[op.ID]
	if err := database.ApplyGoldDebit(&character.Gold, &character.GoldCreditReceipts, op.ID, -op.Amount); err != nil {
		return err
	}
	if !replay && world != nil {
		world.Economy.RecordSink("casino_wagers", -op.Amount)
	}
	return persistCharacterSnapshot(username, character)
}

// Resolve only after the Gold+receipt full snapshot is durably confirmed. An
// ambiguous database acknowledgement leaves the intent recoverable; replay sees
// the same character receipt and never charges/pays again.
func recoverBlackjackTransferLocked(record database.BlackjackTableRecord) (*database.BlackjackTableRecord, error) {
	current, err := db.GetBlackjackTable(record.TableID)
	if err != nil {
		return nil, err
	}
	if current.Pending == nil {
		return current, nil
	}
	if record.Pending == nil || current.Pending.ID != record.Pending.ID {
		return nil, database.ErrBlackjackTableConflict
	}
	record = *current
	err = applyCasinoGoldTransferLocked(*record.Pending)
	if err != nil && !errors.Is(err, database.ErrInsufficientGold) {
		return nil, err
	}
	next, resolveErr := db.ResolveBlackjackTransfer(record, err == nil)
	if resolveErr != nil {
		return nil, resolveErr
	}
	return next, err
}
