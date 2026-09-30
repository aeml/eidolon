package main

import (
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type guildBankCharacterStore interface {
	GetCharacter(string, string) (*database.Character, error)
}

// Caller holds the account work lock and has re-read this exact pending intent
// from durable storage. This commits ONLY its character side; guild settlement,
// admission fencing and terminal intent acknowledgement remain the coordinator's
// responsibility. Never invoke this with a client-supplied execution plan.
func applyAndSaveGuildBankCharacterLocked(op database.GuildBankOperation, characters guildBankCharacterStore) error {
	if err := op.Validate(); err != nil {
		return err
	}
	if op.State != database.GuildBankPending || characters == nil {
		return errors.New("pending guild bank character recovery is unavailable")
	}
	if err := reconcilePendingCharacterSaveLocked(op.Username); err != nil {
		return err
	}
	if world != nil {
		found, changed, err := world.ApplyDurableGuildBankCharacterOperation(op)
		if err != nil {
			return err
		}
		if found {
			if !changed {
				// A process can stop between the in-memory effect and journal
				// write. A volatile replay marker alone cannot acknowledge that
				// effect; require its durable receipt or persist the live copy.
				saved, err := characters.GetCharacter(op.Username, op.CharacterName)
				if err != nil {
					return err
				}
				if guildBankCharacterReceiptMatches(saved, op) {
					return nil
				}
			}
			entity := world.GetEntityCopy(op.PlayerID)
			if entity == nil {
				return errors.New("pinned guild bank character disappeared")
			}
			return persistCharacterSnapshot(op.Username, characterSnapshotForSave(op.Username, entity))
		}
	}
	character, err := characters.GetCharacter(op.Username, op.CharacterName)
	if err != nil {
		return err
	}
	if character == nil || character.Name != op.CharacterName {
		return errors.New("guild bank character is unavailable")
	}
	entity := &game.Entity{ID: op.PlayerID, Type: game.TypePlayer, Gold: character.Gold,
		GuildBankRevision: character.GuildBankRevision, GuildBankOpID: character.GuildBankOpID,
		GuildBankOpFingerprint: character.GuildBankOpFingerprint}
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	changed, err := entity.ApplyGuildBankCharacterOperation(op)
	if err != nil || !changed {
		return err
	}
	character.Gold = entity.Gold
	character.GuildBankRevision, character.GuildBankOpID, character.GuildBankOpFingerprint =
		entity.GuildBankRevision, entity.GuildBankOpID, entity.GuildBankOpFingerprint
	if op.Action == database.GuildBankDepositItem || op.Action == database.GuildBankWithdrawItem {
		character.Inventory = databaseItems(entity.Inventory, false)
	}
	// Preserve all unrelated resources, progression, cosmetics, quests, rest,
	// stash and other receipts. In particular do not rescale legacy equipment.
	return persistCharacterSnapshot(op.Username, character)
}

func guildBankCharacterReceiptMatches(character *database.Character, op database.GuildBankOperation) bool {
	return character != nil && character.Name == op.CharacterName &&
		character.GuildBankRevision == op.CharacterBankRevision+1 &&
		character.GuildBankOpID == op.ID && character.GuildBankOpFingerprint == op.Fingerprint
}
