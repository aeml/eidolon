package game

import "time"

func (w *World) PerformRespawn(playerID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return
	}

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

	// Add back to grid in the new location/instance
	w.Grid.Add(player)
}

func (w *World) PerformRecall(playerID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()

	player, ok := w.Entities[playerID]
	if !ok {
		return
	}

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
	w.Grid.Add(player)
}
