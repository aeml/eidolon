package game

import "time"

// Runs with no corpse or attacker lock held. A chained death follows the same
// contract, so its explosion never recursively holds an ancestor's actor lock.
func (w *World) applyOnKillExplosion(attacker *Entity, corpseID, instanceID string, x, z float64, damage int, deferred *deferredActions, worldLocked bool) {
	const radius = 5.0
	// Grid cells are only a broad-phase query. Capture canonical geometry before
	// locking any receiver; the actual blast is circular and cannot cross walls.
	walkRects := w.dungeonWalkRectsSnapshot(instanceID)
	impacts := &abilityImpactContext{world: w, worldLocked: worldLocked}
	defer impacts.flush()
	for _, nearby := range w.Grid.Nearby(x, z, expandedAbilityRadius("", radius), instanceID) {
		// IDs/types are immutable; skip the corpse before touching its mutex.
		if nearby.ID == corpseID || nearby.Type != TypeEnemy {
			continue
		}
		nearby.Mu.Lock()
		if nearby.InstanceID != instanceID || nearby.State == "DEAD" || nearby.Health <= 0 ||
			!withinDungeonAbilityRadius(walkRects, "", x, z, nearby, radius) {
			nearby.Mu.Unlock()
			continue
		}
		// The gear proc stores 50% attack damage at death. It is not a new
		// attack/critical roll; receiving defenses and retaliation still apply.
		applied := impacts.receiveDamageLocked(attacker.ID, nearby, damage, "physical", time.Now())
		addThreatLocked(nearby, attacker.ID, float64(applied))
		if nearby.Health <= 0 {
			w.handleDeathWithWorldLock(nearby, attacker, deferred, worldLocked)
		}
		nearby.Mu.Unlock()
		if w.OnEvent != nil {
			w.OnEvent("damage", DamageEvent{TargetID: nearby.ID, SourceID: attacker.ID,
				Amount: applied, Kind: "physical", InstanceID: instanceID})
		}
	}
}
