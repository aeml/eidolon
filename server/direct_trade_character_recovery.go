package main

import (
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type directTradeCharacterStore interface {
	GetDirectTradeCharacter(string, string) (*database.Character, error)
}

// Caller owns BOTH sorted account work locks and has re-read the exact frozen
// pending shared decision. Never derive a recovery effect from a client payload.
func applyAndSaveDirectTradeParticipantLocked(op database.DirectTradeOperation, participant database.DirectTradeParticipant, characters directTradeCharacterStore) error {
	if err := op.Validate(); err != nil {
		return err
	}
	if op.State != database.DirectTradePending || characters == nil || !directTradeContainsParticipant(op, participant) {
		return database.ErrDirectTradeConflict
	}
	if err := reconcilePendingCharacterSaveLocked(participant.Username); err != nil {
		return err
	}
	if world != nil {
		found, _, err := world.ApplyDurableDirectTradeDecision(participant.PlayerID, op)
		if err != nil {
			return err
		}
		if found {
			entity := world.GetEntityCopy(participant.PlayerID)
			if entity == nil || entity.Name != participant.CharacterName {
				return errors.New("pinned direct trade participant disappeared")
			}
			// A volatile idempotency marker is never proof of a saved effect.
			// Persist the current owned post-image even after an in-memory replay.
			return persistCharacterSnapshot(participant.Username, characterSnapshotForSave(participant.Username, entity))
		}
	}
	character, err := characters.GetDirectTradeCharacter(participant.Username, participant.CharacterName)
	if err != nil {
		return err
	}
	if character == nil || character.Name != participant.CharacterName {
		return database.ErrDirectTradeConflict
	}
	changed, err := database.ApplyDirectTradeCharacterDecision(participant.Username, character, op)
	if err != nil || !changed {
		return err // A replay here came from an actual durable character read.
	}
	// Only private custody changes. Preserve unrelated saved resources, quests,
	// progression, rest, stash and exact legacy equipment without rescaling.
	return persistCharacterSnapshot(participant.Username, character)
}

func directTradeContainsParticipant(op database.DirectTradeOperation, participant database.DirectTradeParticipant) bool {
	return op.Participants[0] == participant || op.Participants[1] == participant
}

func directTradeReceiptMatches(character *database.Character, op database.DirectTradeOperation, username string) bool {
	return database.DirectTradeCharacterReceiptMatches(username, character, op)
}

// Caller owns this account's work lock. Claim only a confirmed complete shared
// decision, then journal bag/Gold and emptied delivery in the SAME character
// snapshot before returning success. A full outbox is not a refund or lost item.
func claimAndSaveDirectTradeDeliveryLocked(username string, operations directTradeOperationStore) (bool, error) {
	if operations == nil || characterSaveJournal == nil || characterSaveCommitter == nil {
		return false, errors.New("direct trade delivery persistence unavailable")
	}
	if err := reconcilePendingCharacterSaveLocked(username); err != nil {
		return false, err
	}
	var character *database.Character
	if world != nil {
		if entity := world.GetEntityCopy("player-" + username); entity != nil {
			if entity.Name != username || entity.Type != game.TypePlayer {
				return false, database.ErrDirectTradeConflict
			}
			character = characterSnapshotForSave(username, entity)
		}
	}
	if character == nil {
		var err error
		character, err = operations.GetDirectTradeCharacter(username, username)
		if err != nil {
			return false, err
		}
	}
	if character == nil {
		return false, nil
	}
	state, err := database.DecodeDirectTradeState(character.DirectTradeState)
	if err != nil {
		return false, err
	}
	if state.Delivery == nil && (state.LastOperationID == "" || state.Revision > state.LastOperationRevision) {
		return false, nil
	}
	op, err := operations.GetDirectTradeOperation(state.LastOperationID)
	if err != nil {
		return false, err
	}
	if op == nil || op.State != database.DirectTradeComplete || !directTradeReceiptMatches(character, *op, username) {
		return false, database.ErrDirectTradeBusy
	}
	if state.Delivery == nil {
		return false, nil // The frozen plan proves this participant had no delivery.
	}
	if world != nil {
		found, changed, err := world.ClaimDurableDirectTradeDelivery("player-" + username)
		if err != nil {
			return false, err
		}
		if found {
			if !changed {
				return false, nil
			}
			entity := world.GetEntityCopy("player-" + username)
			if entity == nil {
				return false, errors.New("pinned direct trade delivery disappeared")
			}
			if err := persistCharacterSnapshot(username, characterSnapshotForSave(username, entity)); err != nil {
				return false, err // Retain the journal/pin; never re-grant a claim.
			}
			return true, nil
		}
	}
	// Re-read after loss/absence of the live actor. Its latest complete journal
	// was reconciled before the read; do not write the earlier captured snapshot.
	character, err = operations.GetDirectTradeCharacter(username, username)
	if err != nil || character == nil {
		return false, err
	}
	if !directTradeReceiptMatches(character, *op, username) {
		return false, database.ErrDirectTradeConflict
	}
	entity := &game.Entity{ID: "player-" + username, Name: username, Type: game.TypePlayer, Gold: character.Gold,
		DirectTradeState: database.CloneDirectTradeState(character.DirectTradeState), Equipment: make(map[string]game.Item)}
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Stash {
		entity.Stash = append(entity.Stash, gameItemFromDatabaseExact(item))
	}
	for _, item := range character.Buyback {
		entity.Buyback = append(entity.Buyback, gameItemFromDatabaseExact(item))
	}
	for slot, item := range character.Equipment {
		entity.Equipment[slot] = gameItemFromDatabaseExact(item)
	}
	changed, err := entity.ClaimDirectTradeDelivery()
	if err != nil || !changed {
		return false, err
	}
	character.Gold, character.Inventory, character.DirectTradeState = entity.Gold, databaseItems(entity.Inventory, true), database.CloneDirectTradeState(entity.DirectTradeState)
	if err := persistCharacterSnapshot(username, character); err != nil {
		return false, err
	}
	return true, nil
}
