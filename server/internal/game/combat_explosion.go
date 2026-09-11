package game

// Runs with no corpse or attacker lock held. A chained death follows the same
// contract, so its explosion never recursively holds an ancestor's actor lock.
func (w *World) applyOnKillExplosion(attacker *Entity, corpseID, instanceID string, x, z float64, damage int, deferred *deferredActions, worldLocked bool) {
	for _, nearby := range w.Grid.Nearby(x, z, 5.0, instanceID) {
		// IDs/types are immutable; skip the corpse before touching its mutex.
		if nearby.ID == corpseID || nearby.Type != TypeEnemy {
			continue
		}
		nearby.Mu.Lock()
		if nearby.InstanceID != instanceID || nearby.State == "DEAD" || nearby.Health <= 0 {
			nearby.Mu.Unlock()
			continue
		}
		// Preserve this release line's damage formula. The separate Dark King
		// phase-boundary pass is not part of the party-recipient backport.
		applied := damage
		nearby.Health -= applied
		nearby.LastDamageType = "physical"
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
