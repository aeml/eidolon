package game

import (
	"errors"
	"time"
)

func (w *World) PerformRespawn(playerID string, contexts ...string) error {
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
	context := ""
	if len(contexts) > 0 {
		context = contexts[0]
	}
	if len(context) > 64 || (context != "" && context == player.MovementContext) {
		player.Mu.Unlock()
		return errors.New("request a fresh recovery context")
	}
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
	setRecoveryMovementContextLocked(player, context)

	// Add back to grid in the new location/instance
	w.Grid.Add(player)
	return nil
}

func (w *World) PerformRecall(playerID string, contexts ...string) error {
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
	context := ""
	if len(contexts) > 0 {
		context = contexts[0]
	}
	if len(context) > 64 || (context != "" && context == player.MovementContext) {
		player.Mu.Unlock()
		return errors.New("request a fresh recovery context")
	}
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
	setRecoveryMovementContextLocked(player, context)
	w.Grid.Add(player)
	return nil
}

// Scene changes invalidate destinations and motion from the departed instance.
// Keep cooldowns and buffs intact; changing scenes is not an ability reset.
func resetSceneMovementLocked(player *Entity) {
	player.RecoveryContextReady = false
	clearWhirlwindLocked(player)
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

func setRecoveryMovementContextLocked(player *Entity, context string) {
	player.MovementContext = context
	player.RecoveryContextReady = context != ""
	if player.RecoveryContextReady {
		// The context rejects departed packets, so no timed scene lock is needed.
		// Subsequent ability locks still apply normally.
		player.MoveLockUntil = time.Time{}
	}
}
