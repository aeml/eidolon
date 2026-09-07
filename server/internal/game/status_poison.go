package game

import "time"

// Caller holds the actor lock, as for tickBleedLocked. A lethal bleed processed
// earlier this frame must not allow poison to damage/credit the corpse again.
func (w *World) tickPoisonLocked(e *Entity, now time.Time, deferred *deferredActions) {
	if !e.Poisoned || e.State == "DEAD" {
		return
	}
	if now.After(e.PoisonEndTime) {
		e.Poisoned = false
		e.PoisonSourceID = ""
		return
	}
	if now.Sub(e.LastPoisonTick) < time.Second {
		return
	}
	e.LastPoisonTick = now
	w.applyDamageOverTimeLocked(e, e.PoisonSourceID, e.PoisonDamage, "poison", "poison", deferred)
}
