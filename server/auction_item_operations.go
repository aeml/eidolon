package main

import (
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Caller owns the recipient account lock. Flush its newest pending snapshot
// before granting anything, and journal item plus receipt as one full save.
func deliverAuctionItemLocked(op database.AuctionBidOperation) error {
	username := op.CharacterName
	if err := retryPendingCharacterSaveLocked(username); err != nil {
		return err
	}
	var live bool
	var err error
	if op.Kind == database.AuctionOperationBuyout {
		live, err = world.ApplyDurablePlayerAuctionPurchase(op.PlayerID, op.ID, op.ItemPayload, op.Amount)
	} else {
		live, err = world.ApplyDurablePlayerItemDelivery(op.PlayerID, op.ID, op.ItemPayload)
	}
	if err != nil {
		return err
	}
	if live {
		entity := world.GetEntityCopy(op.PlayerID)
		if entity == nil {
			return errors.New("pinned item recipient disappeared")
		}
		return persistCharacterSnapshot(username, characterSnapshotForSave(username, entity))
	}
	if db == nil {
		return errors.New("offline item recipient database unavailable")
	}
	character, err := db.GetCharacter(username, username)
	if err != nil {
		return err
	}
	entity := &game.Entity{Gold: character.Gold, GoldCreditReceipts: cloneGoldCreditReceipts(character.GoldCreditReceipts), ItemDeliveryReceipts: cloneItemDeliveryReceipts(character.ItemDeliveryReceipts)}
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Stash {
		entity.Stash = append(entity.Stash, gameItemFromDatabaseExact(item))
	}
	if op.Kind == database.AuctionOperationBuyout {
		err = entity.ApplyAuctionPurchase(op.ID, op.ItemPayload, op.Amount)
	} else {
		err = entity.ApplyAuctionItemDelivery(op.ID, op.ItemPayload)
	}
	if err != nil {
		return err
	}
	character.Gold = entity.Gold
	character.GoldCreditReceipts = cloneGoldCreditReceipts(entity.GoldCreditReceipts)
	character.Inventory = databaseItems(entity.Inventory, true)
	character.Stash = databaseItems(entity.Stash, false)
	character.ItemDeliveryReceipts = cloneItemDeliveryReceipts(entity.ItemDeliveryReceipts)
	return persistCharacterSnapshot(username, character)
}
