package game

import (
	"slices"
	"time"

	"eidolon-server/internal/database"
)

// Never derive a replay's guild, season or duration from the current party.
func BossVictoryDungeonCompletion(op database.BossVictoryOperation) (DungeonCompletionEvent, bool, error) {
	if err := op.Validate(); err != nil {
		return DungeonCompletionEvent{}, false, err
	}
	if op.DungeonClear == nil {
		return DungeonCompletionEvent{}, false, nil
	}
	event := DungeonCompletionEvent{InstanceID: op.InstanceID, DungeonType: op.DungeonType, Difficulty: DungeonDifficulty(op.Difficulty),
		RunLevel: op.RunLevel, Duration: time.Duration(op.DungeonClear.DurationMS) * time.Millisecond, CompletedAt: op.CreatedAt,
		GuildRuns: slices.Clone(op.DungeonClear.GuildRuns)}
	for _, participant := range op.Participants {
		event.Participants = append(event.Participants, participant.PlayerID)
	}
	return event, true, nil
}

// Boss victory opens the crystal chamber, NOT the completed repair objective.
// A missing scene is safe: every saved original recipient has the guardian's
// cleared checkpoint, and ordinary re-entry restarts an unfinished full vigil.
func (w *World) StartBossVictoryFinale(op database.BossVictoryOperation) error {
	if err := op.Validate(); err != nil {
		return err
	}
	if !IsElementalRaidBoss(op.DungeonType, op.BossType) {
		return nil
	}
	if !w.BossVictoryPlanConfirmed(op.ID) {
		return ErrBossVictoryEffectConflict
	}
	instance, exists := w.getDungeonInstance(op.InstanceID)
	if !exists {
		return nil
	}
	instance.Mu.RLock()
	valid := instance.DungeonType == op.DungeonType && instance.RunLevel == op.RunLevel &&
		(string(instance.Difficulty) == op.Difficulty || (instance.Difficulty == "" && op.Difficulty == "normal")) &&
		op.RoomIndex == len(instance.Layout.Rooms)-1 && instance.RoomState != nil && op.RoomIndex < len(instance.RoomState.Rooms) &&
		instance.Layout.Rooms[op.RoomIndex].Type == "boss" && instance.RoomState.Rooms[op.RoomIndex].Cleared && instance.RoomState.Rooms[op.RoomIndex].Rewarded
	var x, z float64
	if valid {
		x, z = instance.Layout.Rooms[op.RoomIndex].X, instance.Layout.Rooms[op.RoomIndex].Z
	}
	instance.Mu.RUnlock()
	if !valid {
		return ErrBossVictoryEffectConflict
	}
	participants := make([]string, 0, len(op.Participants))
	definition, _ := ElementalRaidDefinitionForType(op.DungeonType)
	allRepaired := true
	for _, participant := range op.Participants {
		participants = append(participants, participant.PlayerID)
		player := w.GetEntity(participant.PlayerID)
		if player == nil {
			allRepaired = false
			continue
		}
		player.Mu.RLock()
		repaired := hasFinishedCrystalVigil(player, definition)
		player.Mu.RUnlock()
		allRepaired = allRepaired && repaired
	}
	if allRepaired {
		return nil // A terminal victory replay must not start another vigil.
	}
	w.StartCrystalRepair(op.InstanceID, op.DungeonType, participants, x, z)
	return nil
}
