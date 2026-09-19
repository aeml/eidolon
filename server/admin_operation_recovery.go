package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type adminOperationStore interface {
	GetAdminOperation(string) (*database.AdminOperation, error)
	PrepareAdminOperation(database.AdminOperation) (*database.AdminOperation, error)
	FinishAdminOperation(string, string, database.AdminActivity) (*database.AdminOperation, error)
	PendingAdminOperations(string, int) ([]database.AdminOperation, error)
	GetCharacter(string, string) (*database.Character, error)
}

var adminOperations adminOperationStore

// Only unresolved saves need replay. In particular an already-saved operation
// whose audit reply was lost must not cause another full-character save.
func reconcileAdminCharacterLocked(username string) error {
	if characterSaveJournal == nil || characterSaveCommitter == nil {
		return errors.New("administration character persistence unavailable")
	}
	pending, err := characterSaveJournal.Read(username)
	if err != nil {
		return err
	}
	failedCharacterSaves.Lock()
	failed := failedCharacterSaves.users[username]
	failedCharacterSaves.Unlock()
	if pending != nil || failed {
		return retryPendingCharacterSaveLocked(username)
	}
	return nil
}

// Caller holds the target work lock. Admission/recovery wiring prevents target
// commands and stale hydration while its operation remains unresolved.
func completeAdminOperationLocked(op database.AdminOperation) (*database.AdminOperation, error) {
	if adminOperations == nil {
		return nil, errors.New("administration operation store unavailable")
	}
	// Never execute a caller-supplied plan or stale captured status: recover the
	// current durable decision, including the first committed random item rolls.
	stored, err := adminOperations.GetAdminOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if stored == nil || stored.Fingerprint != op.Fingerprint || stored.Target != op.Target || stored.Actor != op.Actor || stored.Action != op.Action {
		return nil, database.ErrAdminOperationConflict
	}
	op = *stored
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if op.State == database.AdminOperationComplete {
		return &op, nil
	}
	if op.State == database.AdminOperationAuditing {
		return adminOperations.FinishAdminOperation(op.ID, op.Fingerprint, op.Audit)
	}
	if op.Action != MsgAdminGrantGold && op.Action != MsgAdminGrantItem && op.Action != MsgAdminTeleport {
		return nil, errors.New("administration operation executor unavailable")
	}
	if err := reconcileAdminCharacterLocked(op.Target); err != nil {
		return nil, err
	}
	var grant game.AdminGrant
	var teleport game.AdminTeleportPlan
	var plan any = &grant
	if op.Action == MsgAdminTeleport {
		plan = &teleport
	}
	decoder := json.NewDecoder(bytes.NewReader(op.Payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(plan); err != nil || op.Action != MsgAdminTeleport && grant.Action != op.Action {
		return nil, errors.New("invalid stored administration execution plan")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return nil, errors.New("trailing administration grant plan data")
	}
	if op.Action == MsgAdminTeleport {
		err = applyAndSaveAdminTeleportLocked(op, teleport)
	} else {
		err = applyAndSaveAdminGrantLocked(op, grant)
	}
	if err != nil && !errors.Is(err, game.ErrAdminGrantRejected) && !errors.Is(err, game.ErrAdminTeleportRejected) {
		return nil, err // Storage/unknown-result failures remain pending, not denied.
	}
	audit := op.Audit
	if err != nil {
		audit.Result = "denied"
		audit.Summary = "Grant not applied: recipient state, balance or inventory no longer permits this operation."
		if op.Action == MsgAdminTeleport {
			audit.Summary = "Teleport not applied: recipient, destination or landing state changed."
		}
	}
	return adminOperations.FinishAdminOperation(op.ID, op.Fingerprint, audit)
}

func applyAndSaveAdminGrantLocked(op database.AdminOperation, grant game.AdminGrant) error {
	if world != nil {
		found, changed, err := world.ApplyDurableAdminGrant("player-"+op.Target, op.ID, op.Fingerprint, grant)
		if err != nil {
			return err
		}
		if found {
			if changed {
				entity := world.GetEntityCopy("player-" + op.Target)
				if entity == nil {
					return errors.New("pinned administration recipient disappeared")
				}
				if err := persistCharacterSnapshot(op.Target, characterSnapshotForSave(op.Target, entity)); err != nil {
					return err
				}
			}
			sendInventoryForPlayer("player-" + op.Target)
			return nil
		}
	}
	character, err := adminOperations.GetCharacter(op.Target, op.Target)
	if err != nil {
		return err
	}
	if character == nil || character.Name != op.Target {
		return errors.New("administration target character unavailable")
	}
	entity := adminGrantEntityFromCharacter(character)
	changed, err := entity.ApplyAdminGrant(op.ID, op.Fingerprint, grant)
	if err != nil || !changed {
		return err
	}
	character.Gold = entity.Gold
	if grant.Action == MsgAdminGrantItem {
		character.Inventory = databaseItems(entity.Inventory, true)
		character.ItemDeliveryReceipts = cloneItemDeliveryReceipts(entity.ItemDeliveryReceipts)
	}
	character.AdminOperationReceipts = cloneItemDeliveryReceipts(entity.AdminOperationReceipts)
	return persistCharacterSnapshot(op.Target, character)
}

func adminGrantEntityFromCharacter(character *database.Character) *game.Entity {
	entity := &game.Entity{Type: game.TypePlayer, Health: 1, State: "IDLE", Gold: character.Gold,
		AdminOperationReceipts: cloneItemDeliveryReceipts(character.AdminOperationReceipts),
		ItemDeliveryReceipts:   cloneItemDeliveryReceipts(character.ItemDeliveryReceipts)}
	if character.Resources != nil {
		entity.Health = character.Resources.Health
		if character.Resources.Dead {
			entity.State = "DEAD"
		}
	}
	for _, item := range character.Inventory {
		entity.Inventory = append(entity.Inventory, gameItemFromDatabaseExact(item))
	}
	return entity
}
