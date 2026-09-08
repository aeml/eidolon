package main

import (
	"errors"
	"strings"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Caller holds the actor's account work lock, including ordinary bid handlers.
// Recovery acquires that same lock outside trading/world/entity locks.
func completePendingAuctionBidLocked(op database.AuctionBidOperation) error {
	if !op.Valid() {
		return errors.New("invalid pending auction bid")
	}
	if err := world.Trading.EnsureBidDecision(op); err != nil {
		return err
	}
	var err error
	if op.Kind == database.AuctionOperationSellerPayout {
		err = deliverAuctionRefundLocked(database.AuctionRefund{ID: "seller-payout:" + op.ID,
			PlayerID: op.PlayerID, CharacterName: op.CharacterName, Amount: op.Amount})
	} else if op.Kind == database.AuctionOperationItemClaim {
		err = deliverAuctionItemLocked(op)
	} else {
		err = debitAuctionBidLocked(op)
	}
	if err != nil {
		if errors.Is(err, database.ErrInsufficientGold) || errors.Is(err, game.ErrAuctionStorageFull) {
			if abortErr := world.Trading.AbortUnfundedAuctionBid(op); abortErr != nil {
				return abortErr
			}
		}
		return err
	}
	return world.Trading.CompleteAuctionBid(op)
}

func debitAuctionBidLocked(op database.AuctionBidOperation) error {
	username := op.CharacterName
	if op.PlayerID != "player-"+username {
		return errors.New("auction bid account mismatch")
	}
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	operationID := "bid:" + op.ID
	live, err := world.ApplyDurablePlayerGoldDebit(op.PlayerID, operationID, op.Amount)
	if err != nil {
		return err
	}
	if live {
		entity := world.GetEntityCopy(op.PlayerID)
		if entity == nil {
			return errors.New("pinned auction bidder disappeared")
		}
		return persistCharacterSnapshot(username, characterSnapshotForSave(username, entity))
	}
	if db == nil {
		return errors.New("auction bidder database unavailable")
	}
	character, err := db.GetCharacter(username, username)
	if err != nil {
		return err
	}
	if err := database.ApplyGoldDebit(&character.Gold, &character.GoldCreditReceipts, operationID, op.Amount); err != nil {
		return err
	}
	return persistCharacterSnapshot(username, character)
}

func recoverAccountAuctionBidsLocked(username string) error {
	if world == nil || world.Trading == nil {
		return nil
	}
	for _, op := range world.Trading.PendingBidOperations("player-" + username) {
		if err := completePendingAuctionBidLocked(op); err != nil && !errors.Is(err, database.ErrInsufficientGold) && !errors.Is(err, game.ErrAuctionStorageFull) {
			return err
		}
	}
	return nil
}

func recoverPendingAuctionBids() error {
	if world == nil || world.Trading == nil {
		return nil
	}
	for _, op := range world.Trading.PendingBidOperations("") {
		if serverStopping.Load() {
			return nil
		}
		username := strings.TrimPrefix(op.PlayerID, "player-")
		unlock := lockCharacterWork(username)
		err := recoverAccountAuctionBidsLocked(username)
		unlock()
		if err != nil {
			return err
		}
	}
	return nil
}
