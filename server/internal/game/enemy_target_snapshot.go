package game

import "time"

type enemyTargetSnapshot struct {
	id, instanceID string
	x, z           float64
	active, hidden bool
}

// Call without holding the enemy lock. Abilities own World.Mu, while movement
// and membership also use Entity.Mu; both are needed for a consistent target.
func (w *World) snapshotEnemyTarget(player *Entity) enemyTargetSnapshot {
	if player == nil {
		return enemyTargetSnapshot{}
	}
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	return enemyTargetSnapshot{id: player.ID, instanceID: player.InstanceID, x: player.X, z: player.Z,
		active: w.Entities[player.ID] == player && !player.Disconnected && player.State != "DEAD",
		hidden: player.StealthActive && time.Now().Before(player.StealthEndTime)}
}
