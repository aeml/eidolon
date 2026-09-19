package main

import (
	"encoding/json"
	"errors"
	"fmt"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func applyAndSaveAdminTeleportLocked(op database.AdminOperation, plan game.AdminTeleportPlan) error {
	if world != nil {
		found, changed, err := world.ApplyDurableAdminTeleport("player-"+op.Target, op.ID, op.Fingerprint, plan)
		if err != nil {
			return err
		}
		if found {
			if changed {
				entity := world.GetEntityCopy("player-" + op.Target)
				if entity == nil {
					return errors.New("pinned teleport recipient disappeared")
				}
				if err := persistCharacterSnapshot(op.Target, characterSnapshotForSave(op.Target, entity)); err != nil {
					return err
				}
			}
			syncAdminTeleportRecipient(op.Target)
			return nil
		}
	}
	// Startup first flushes the character journal. An already-saved teleport is
	// acknowledged offline, but an unapplied intent never moves an offline player
	// or recreates an expired dungeon just to finish an administrative request.
	character, err := adminOperations.GetCharacter(op.Target, op.Target)
	if err != nil {
		return err
	}
	if character == nil {
		return errors.New("teleport character unavailable")
	}
	replayed, err := database.AdminOperationApplied(character.AdminOperationReceipts, op.ID, op.Fingerprint)
	if err != nil || replayed {
		return err
	}
	return fmt.Errorf("%w: recipient went offline before movement", game.ErrAdminTeleportRejected)
}

func syncAdminTeleportRecipient(username string) {
	sessionsMu.Lock()
	client := activeSessions[username]
	sessionsMu.Unlock()
	if client == nil || client.transportClosed.Load() || !currentCharacterConnection(client) || client.playerID != "player-"+username {
		return
	}
	entity := world.GetEntityCopy(client.playerID)
	if entity == nil {
		return
	}
	client.resetSnapshotHistory()
	sendMovementContext(client)
	payload := map[string]any{"instanceId": entity.InstanceID, "type": "overworld",
		"spawn": map[string]float64{"x": entity.X, "y": entity.Y, "z": entity.Z}}
	if entity.InstanceID != "" {
		layout, exists := world.GetInstanceLayout(entity.InstanceID)
		if !exists {
			return
		}
		payload["type"], payload["layout"] = world.GetInstanceType(entity.InstanceID), layout
		if roomState, exists := world.GetDungeonRoomSummary(entity.InstanceID, client.playerID); exists {
			payload["roomState"] = roomState
		}
	}
	encoded, _ := json.Marshal(payload)
	client.sendSafe(createMessage(MsgEnterInstance, encoded))
	sendCasinoState(client)
}
