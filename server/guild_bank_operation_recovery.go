package main

import (
	"errors"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type guildBankOperationStore interface {
	GetGuildBankOperation(string) (*database.GuildBankOperation, error)
	PrepareGuildBankOperation(database.GuildBankOperation) (*database.GuildBankOperation, error)
	ReserveGuildBankOperation(string, string) (*database.Guild, error)
	ApplyGuildBankOperation(string, string) (*database.Guild, error)
	FinishGuildBankOperation(string, string, string) (*database.GuildBankOperation, error)
	ReleaseGuildBankOperation(string, string) error
	PendingGuildBankOperations(string, int) ([]database.GuildBankOperation, error)
	ReservedGuildBankOperationIDs(int) ([]string, error)
	GetCharacter(string, string) (*database.Character, error)
	GetGuildByID(string) (*database.Guild, error)
}

var guildBankOperations guildBankOperationStore

// Caller owns the exact account work lock. Always execute the durable first
// plan, not caller-supplied item data, balances, timestamps or captured status.
// The reservation freezes permissions and bank capacity before the character
// effect; no compensating financial writes are used at any failure boundary.
func completeGuildBankOperationLocked(captured database.GuildBankOperation) (*database.GuildBankOperation, error) {
	if guildBankOperations == nil {
		return nil, errors.New("guild bank recovery storage unavailable")
	}
	stored, err := guildBankOperations.GetGuildBankOperation(captured.ID)
	if err != nil {
		return nil, err
	}
	if stored == nil || stored.Username != captured.Username || stored.Fingerprint != captured.Fingerprint {
		return nil, database.ErrGuildBankOperationConflict
	}
	op := *stored
	if err := op.Validate(); err != nil {
		return nil, err
	}
	// Eidolon's current live character and complete-save identity is the account
	// name. Never attach an alternate offline character's intent to that actor.
	if op.CharacterName != op.Username {
		return nil, errors.New("guild bank intent does not match the active character identity")
	}
	if op.State != database.GuildBankPending {
		if err := guildBankOperations.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
			return nil, err
		}
		return &op, nil // Old terminal receipts remain valid after later transfers.
	}
	if err := reconcilePendingCharacterSaveLocked(op.Username); err != nil {
		return nil, err
	}
	if _, err := guildBankOperations.ReserveGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		if errors.Is(err, database.ErrGuildBankOperationRejected) || errors.Is(err, database.ErrGuildBankOperationStale) {
			return rejectUnappliedGuildBankOperationLocked(op)
		}
		return nil, err // Busy or unknown storage acknowledgement stays pending.
	}
	if err := applyAndSaveGuildBankCharacterLocked(op, guildBankOperations); err != nil {
		if errors.Is(err, game.ErrGuildBankCharacterRejected) {
			return rejectUnappliedGuildBankOperationLocked(op)
		}
		return nil, err // Complete character journal/receipt will reconcile this.
	}
	if _, err := guildBankOperations.ApplyGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		// The character receipt is already durable. Do not refund, reject or
		// release a partly settled transfer, even for an unexpected stale result.
		return nil, err
	}
	return finishAndReleaseGuildBankOperationLocked(op, database.GuildBankComplete)
}

func finishAndReleaseGuildBankOperationLocked(op database.GuildBankOperation, outcome string) (*database.GuildBankOperation, error) {
	finished, err := guildBankOperations.FinishGuildBankOperation(op.ID, op.Fingerprint, outcome)
	if err != nil {
		return nil, err
	}
	if finished == nil || finished.ID != op.ID || finished.Fingerprint != op.Fingerprint || finished.State != outcome {
		return nil, errors.New("guild bank outcome remains unconfirmed")
	}
	if err := guildBankOperations.ReleaseGuildBankOperation(op.ID, op.Fingerprint); err != nil {
		return nil, err // Terminal hold discovery recovers a stop or lost reply.
	}
	return finished, nil
}

// Rejection is a terminal receipt, not rollback. Confirm neither side changed
// before releasing the guild. Any partial/conflicting receipt stays recoverable
// instead of hiding a lost item or silently overwriting newer bank activity.
func rejectUnappliedGuildBankOperationLocked(op database.GuildBankOperation) (*database.GuildBankOperation, error) {
	if world != nil {
		if player := world.GetEntityCopy(op.PlayerID); player != nil &&
			(player.GuildBankOpID == op.ID || player.GuildBankRevision != op.CharacterBankRevision) {
			return nil, errors.New("guild bank character effect requires recovery before rejection")
		}
	}
	character, err := guildBankOperations.GetCharacter(op.Username, op.CharacterName)
	if err != nil {
		return nil, err
	}
	if character == nil || character.Name != op.CharacterName || character.GuildBankOpID == op.ID ||
		character.GuildBankRevision != op.CharacterBankRevision {
		return nil, errors.New("guild bank character receipt prevents rejection")
	}
	guild, err := guildBankOperations.GetGuildByID(op.GuildID)
	if err != nil {
		return nil, err
	}
	if guild != nil && guild.LastBankOperationID == op.ID {
		return nil, errors.New("guild bank effect requires recovery before rejection")
	}
	return finishAndReleaseGuildBankOperationLocked(op, database.GuildBankRejected)
}
