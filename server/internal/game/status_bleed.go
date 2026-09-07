package game

import "time"

// tickBleedLocked is shared by player and enemy/NPC updates. The caller holds
// the target lock; only source lookup during death handling releases it, as in
// the original player tick path. No tick may run for an already-dead actor.
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
	e.Health -= e.BleedDamage
	e.LastDamageType = "physical"
	sourceID := e.BleedSourceID
	if sourceID == "" {
		sourceID = "bleed"
	}
	if e.Type == TypeEnemy && e.BleedSourceID != "" {
		addThreatLocked(e, e.BleedSourceID, float64(e.BleedDamage))
	}
	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{TargetID: e.ID, SourceID: sourceID, Amount: e.BleedDamage, Kind: "bleed", InstanceID: e.InstanceID})
	}
	if e.Health <= 0 {
		ownerID := e.BleedSourceID
		e.Mu.Unlock()
		attacker := w.GetEntity(ownerID)
		e.Mu.Lock()
		if e.Health <= 0 && e.State != "DEAD" {
			w.handleDeath(e, attacker, deferred)
		}
	}
}
