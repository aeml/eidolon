package game

import "time"

// tickBleedLocked is shared by player and enemy/NPC updates. The caller holds
// the target lock; receiving reactions and source lookup temporarily release
// it. No tick may run for an already-dead actor.
func (w *World) tickBleedLocked(e *Entity, now time.Time, deferred *deferredActions) {
	if !e.Bleeding || e.State == "DEAD" {
		return
	}
	if now.After(e.BleedEndTime) {
		e.Bleeding = false
		e.BleedSourceID = ""
		return
	}
	if now.Sub(e.LastBleedTick) < time.Second {
		return
	}
	e.LastBleedTick = now
	w.applyDamageOverTimeLocked(e, e.BleedSourceID, e.BleedDamage, "bleed", "physical", now, deferred)
}

// Shared damage/death handling keeps poison and bleed attribution, threat and
// lethal-damage protection identical without duplicating the lock transition.
func (w *World) applyDamageOverTimeLocked(e *Entity, ownerID string, damage int, kind, damageType string, now time.Time, deferred *deferredActions) {
	impacts := &abilityImpactContext{world: w}
	damage = impacts.receiveDamageLocked(ownerID, e, damage, damageType, now)
	sourceID := ownerID
	if sourceID == "" {
		sourceID = kind
	}
	if e.Type == TypeEnemy && ownerID != "" {
		addThreatLocked(e, ownerID, float64(damage))
	}
	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: sourceID, Amount: damage, Kind: kind, InstanceID: e.InstanceID})
	}
	if len(impacts.reactions) > 0 {
		e.Mu.Unlock()
		func() {
			defer e.Mu.Lock() // Restore the caller's receiver-lock contract.
			impacts.flush()
		}()
	}
	if e.Health <= 0 {
		e.Mu.Unlock()
		attacker := w.GetEntity(ownerID)
		e.Mu.Lock()
		if e.Health <= 0 && e.State != "DEAD" {
			w.handleDeath(e, attacker, deferred)
		}
	}
}
