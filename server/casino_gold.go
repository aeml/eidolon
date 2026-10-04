package main

import (
	"errors"
	"strings"

	"eidolon-server/internal/database"
)

// Caller owns this account's character-work lock, then the table lock, in that
// order. Never acquire another player's account lock while holding a table lock.
// Background recovery takes the same locks; a pending intent blocks table moves.
func applyCasinoTransferLocked(tableID string, op database.BlackjackTransfer) error {
	if err := op.ValidateForTable(tableID); err != nil {
		return err
	}
	if op.Currency == "ep" {
		return applyCasinoEPTransferLocked(op)
	}
	return applyCasinoGoldTransferLocked(op)
}

func applyCasinoGoldTransferLocked(op database.BlackjackTransfer) (resultErr error) {
	finish := beginOperationalCall(boundaryCasinoGold)
	defer func() { finish(resultErr) }()
	if err := op.Validate(); err != nil {
		return err
	}
	if op.Currency != "gold" {
		return errors.New("non-Gold transfer cannot enter the Gold wallet")
	}
	if op.TableVersion != 0 {
		return applyCasinoCheckpointTransferLocked(op)
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

func applyCasinoEPTransferLocked(op database.BlackjackTransfer) (resultErr error) {
	finish := beginOperationalCall(boundaryCasinoEP)
	defer func() { finish(resultErr) }()
	if err := op.Validate(); err != nil {
		return err
	}
	if op.Currency != "ep" {
		return errors.New("non-EP transfer cannot enter the EP wallet")
	}
	if op.TableVersion != 0 {
		return applyCasinoCheckpointTransferLocked(op)
	}
	username := strings.TrimPrefix(op.PlayerID, "player-")
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	if world != nil {
		live, err := world.ApplyDurablePlayerEPTransfer(op.PlayerID, op.ID, op.Amount)
		if err != nil {
			return err
		}
		if live {
			entity := world.GetEntityCopy(op.PlayerID)
			if entity == nil {
				return errors.New("pinned casino EP player disappeared")
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
	if err := database.ApplyEPTransfer(&character.EP, &character.EPCasinoReceipts, op.ID, op.Amount); err != nil {
		return err
	}
	return persistCharacterSnapshot(username, character)
}

func applyCasinoCheckpointTransferLocked(op database.BlackjackTransfer) error {
	if err := op.ValidateForTable(op.TableID); err != nil {
		return err
	}
	username := strings.TrimPrefix(op.PlayerID, "player-")
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	if world != nil {
		live, err := world.ApplyDurableCasinoWalletCheckpoint(op)
		if err != nil {
			return err
		}
		if live {
			entity := world.GetEntityCopy(op.PlayerID)
			if entity == nil {
				return errors.New("pinned casino checkpoint owner disappeared")
			}
			return persistCharacterSnapshot(username, characterSnapshotForSave(username, entity))
		}
	}
	if db == nil {
		return errors.New("casino checkpoint database unavailable")
	}
	character, err := db.GetDirectTradeCharacter(username, username)
	if err != nil {
		return err
	}
	changed, err := database.ApplyCasinoWalletCheckpoint(&character.Gold, &character.EP, character.GoldCreditReceipts, character.EPCasinoReceipts, &character.CasinoWalletCheckpoints, op)
	if err != nil {
		return err
	}
	if changed && op.Currency == "gold" && world != nil {
		if op.Amount < 0 {
			world.Economy.RecordSink("casino_wagers", -op.Amount)
		} else {
			world.Economy.RecordSource("casino_returns", op.Amount)
		}
	}
	return persistCharacterSnapshot(username, character)
}

func casinoInsufficientFunds(err error) bool {
	return errors.Is(err, database.ErrInsufficientGold) || errors.Is(err, database.ErrInsufficientEP)
}

// Resolve only after the currency+receipt full snapshot is durably confirmed. An
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
	err = applyCasinoTransferLocked(record.TableID, *record.Pending)
	if err != nil && !casinoInsufficientFunds(err) {
		return nil, err
	}
	next, resolveErr := db.ResolveBlackjackTransfer(record, err == nil)
	if resolveErr != nil {
		return nil, resolveErr
	}
	return next, err
}
