package game

import (
	"math"
	"time"
)

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
	return w.snapshotEnemyTargetLocked(player)
}

// Caller holds World.Mu for the complete candidate scan and no enemy lock.
// Keep each player's live state under its actor lock: nothing is cached across
// candidates/frames, and detached or replaced world membership remains invalid.
// An optional scene rejects out-of-scene actors before membership/cast reads,
// but still reads their current scene under the same player lock.
func (w *World) snapshotEnemyTargetLocked(player *Entity, scene ...string) enemyTargetSnapshot {
	if player == nil {
		return enemyTargetSnapshot{}
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	if len(scene) > 0 && player.InstanceID != scene[0] {
		return enemyTargetSnapshot{}
	}
	return w.snapshotEnemyTargetPlayerLocked(player)
}

// Caller owns World.Mu; read current actor coordinates/scene under its lock.
// A nonthreatening player outside sight cannot affect this enemy's pursuit or
// attack: the final consumer already requires minDist <= sightRange. Positive
// threat MUST bypass this shortcut, including distant high-priority targets.
// No position, membership, stealth or safe-zone state is cached across frames.
func (w *World) snapshotEnemyTargetForScanLocked(player *Entity, scene string, x, z, sightRange float64, threat map[string]float64) enemyTargetSnapshot {
	if player == nil {
		return enemyTargetSnapshot{}
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	if player.InstanceID != scene {
		return enemyTargetSnapshot{}
	}
	dx, dz := player.X-x, player.Z-z
	if threat[player.ID] <= 0 && math.Sqrt(dx*dx+dz*dz) > sightRange {
		return enemyTargetSnapshot{}
	}
	return w.snapshotEnemyTargetPlayerLocked(player)
}

// Caller holds both World.Mu and the player's actor lock. Both target paths
// share the same live authority checks; the scan shortcut never grants a hit.
func (w *World) snapshotEnemyTargetPlayerLocked(player *Entity) enemyTargetSnapshot {
	return enemyTargetSnapshot{id: player.ID, instanceID: player.InstanceID, x: player.X, z: player.Z,
		active: w.Entities[player.ID] == player && !player.Disconnected && player.State != "DEAD",
		hidden: player.StealthActive && time.Now().Before(player.StealthEndTime)}
}
