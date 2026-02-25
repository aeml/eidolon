package game

import "time"

// fireAbilityEvent emits an "ability" event if a listener is registered.
// This replaces the repeated `if w.OnEvent != nil { w.OnEvent("ability", ...) }` pattern.
func (w *World) fireAbilityEvent(sourceID, targetID, skillName string, targetX, targetZ float64) {
	if w.OnEvent != nil {
		w.OnEvent("ability", AbilityEvent{
			SourceID:  sourceID,
			TargetID:  targetID,
			SkillName: skillName,
			TargetX:   targetX,
			TargetZ:   targetZ,
		})
	}
}

// fireDamageEvent emits a "damage" event if a listener is registered.
func (w *World) fireDamageEvent(sourceID, targetID string, amount int) {
	if w.OnEvent != nil {
		w.OnEvent("damage", DamageEvent{
			TargetID: targetID,
			SourceID: sourceID,
			Amount:   amount,
		})
	}
}

// fireHealEvent emits a "heal" event if a listener is registered.
func (w *World) fireHealEvent(sourceID, targetID string, amount int) {
	if w.OnEvent != nil {
		w.OnEvent("heal", HealEvent{
			TargetID: targetID,
			SourceID: sourceID,
			Amount:   amount,
		})
	}
}

// delayedIdleReset schedules a goroutine that resets the given entity's state
// from "ATTACKING" back to "IDLE" after 1 second. Used by Wizard cast animations.
func (w *World) delayedIdleReset(playerID string) {
	go func(pid string) {
		time.Sleep(1 * time.Second)
		w.Mu.Lock()
		if p, ok := w.Entities[pid]; ok && p.State == "ATTACKING" {
			p.State = "IDLE"
		}
		w.Mu.Unlock()
	}(playerID)
}
