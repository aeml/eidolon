package game

import (
	"errors"
	"time"
)

func (w *World) PerformRespawn(playerID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if w.HasPvPMatch(playerID) {
		return errors.New("wait for the PvP round to finish, or use Forfeit in Duels & Arena to leave the match")
	}

	player, ok := w.Entities[playerID]
	if !ok {
		return errors.New("player unavailable")
	}
	player.Mu.Lock()
	oldInstanceID := player.InstanceID
	defer func() {
		player.Mu.Unlock()
		if w.isDungeonInstance(oldInstanceID) {
			w.checkAndResetDungeonLocked(oldInstanceID)
		}
	}()

	// Allow respawn even if not dead (unstuck)
	player.State = "IDLE"
	player.LastRespawnTime = time.Now()
	player.Health = player.MaxHealth
	player.QAHealthRegenPausedUntil = time.Time{}
	player.QAHazardInspectionEndTime = time.Time{}
	delete(w.PlayerHazardTicks, playerID)

	// Remove from current grid location (which might be in an instance)
	w.Grid.Remove(player)

	player.X = -1.25
	player.Z = 200
	player.TargetX = -1.25
	player.TargetZ = 200
	player.InstanceID = "" // Reset to overworld
	resetSceneMovementLocked(player)

	// Add back to grid in the new location/instance
	w.Grid.Add(player)
	return nil
}

func (w *World) PerformRecall(playerID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if w.HasPvPMatch(playerID) {
		return errors.New("use Forfeit in Duels & Arena to leave the PvP match before recalling")
	}

	player, ok := w.Entities[playerID]
	if !ok {
		return errors.New("player unavailable")
	}
	player.Mu.Lock()
	if player.State == "DEAD" || player.Health <= 0 {
		player.Mu.Unlock()
		return errors.New("use Respawn to recover in Lanternhold before recalling")
	}
	oldInstanceID := player.InstanceID
	defer func() {
		player.Mu.Unlock()
		if w.isDungeonInstance(oldInstanceID) {
			w.checkAndResetDungeonLocked(oldInstanceID)
		}
	}()

	// Teleport to town
	player.State = "IDLE"
	player.QAHazardInspectionEndTime = time.Time{}
	player.QAHealthRegenPausedUntil = time.Time{}
	delete(w.PlayerHazardTicks, playerID)

	w.Grid.Remove(player)
	player.X = -1.25
	player.Z = 200
	player.TargetX = -1.25
	player.TargetZ = 200
	// Reset InstanceID to Overworld if respawning in town
	// Note: If we want them to respawn inside the dungeon, we shouldn't clear InstanceID here.
	// For now, let's assume death sends you to town (Overworld).
	// We need to handle the Grid update carefully if InstanceID changes.
	player.InstanceID = ""
	resetSceneMovementLocked(player)
	w.Grid.Add(player)
	return nil
}

// Scene changes invalidate destinations and motion from the departed instance.
// Keep cooldowns and buffs intact; changing scenes is not an ability reset.
func resetSceneMovementLocked(player *Entity) {
	player.State = "IDLE"
	player.Y = 0
	player.TargetID = ""
	player.VelX, player.VelZ = 0, 0
	player.IsCharging = false
	player.ChargeStartX, player.ChargeStartZ = player.X, player.Z
	player.ChargeTargetX, player.ChargeTargetZ = player.X, player.Z
	player.ChargeSkillName, player.ChargeRuneID = "", ""
	player.JumpStartX, player.JumpStartY, player.JumpStartZ = player.X, 0, player.Z
	player.JumpTargetX, player.JumpTargetY, player.JumpTargetZ = player.X, 0, player.Z
	player.JumpDuration, player.JumpElapsed, player.JumpHeight, player.JumpProgress = 0, 0, 0, 0
	player.LastRespawnTime = time.Now() // Existing move admission rejects old-context samples for one second.
	player.MoveLockUntil = time.Now().Add(AbilityMovementLockDuration)
}
