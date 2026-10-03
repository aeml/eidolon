package game

// These are in-flight combat effects, not durable reward claims. Register while
// the caller owns the enemy mutex, before publishing DEAD. Keep the spawn room
// even if the transient corpse disappears before its reward worker finishes.
// Public events share this guard for their own physical wave enemy IDs.
type pendingDungeonCombatReward struct {
	instanceID string
	x, z       float64
}

func (w *World) beginDungeonCombatRewardLocked(enemy *Entity) {
	if enemy.Type != TypeEnemy || (enemy.InstanceID == "" && enemy.WorldEventID == "") {
		return
	}
	x, z := enemy.SpawnX, enemy.SpawnZ
	if x == 0 && z == 0 && (enemy.X != 0 || enemy.Z != 0) {
		x, z = enemy.X, enemy.Z
	}
	w.dungeonCombatRewardMu.Lock()
	if w.dungeonCombatRewards == nil {
		w.dungeonCombatRewards = make(map[string]pendingDungeonCombatReward)
	}
	w.dungeonCombatRewards[enemy.ID] = pendingDungeonCombatReward{enemy.InstanceID, x, z}
	w.dungeonCombatRewardMu.Unlock()
}

func (w *World) endDungeonCombatReward(enemyID string) {
	w.dungeonCombatRewardMu.Lock()
	delete(w.dungeonCombatRewards, enemyID)
	w.dungeonCombatRewardMu.Unlock()
}

// Independent of entity/corpse lifetime. Call after observing the enemy's
// state, since registration happens under that same mutex before DEAD.
func (w *World) enemyHasPendingCombatReward(enemyID string) bool {
	w.dungeonCombatRewardMu.Lock()
	defer w.dungeonCombatRewardMu.Unlock()
	_, pending := w.dungeonCombatRewards[enemyID]
	return pending
}

func (w *World) dungeonRoomHasPendingCombatRewards(instanceID string, room DungeonRoom) bool {
	w.dungeonCombatRewardMu.Lock()
	defer w.dungeonCombatRewardMu.Unlock()
	for _, pending := range w.dungeonCombatRewards {
		if pending.instanceID == instanceID && pending.x >= room.X-room.Width/2 && pending.x <= room.X+room.Width/2 &&
			pending.z >= room.Z-room.Height/2 && pending.z <= room.Z+room.Height/2 {
			return true
		}
	}
	return false
}
