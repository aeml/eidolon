package game

import "time"

func clearRenewalLocked(target *Entity) {
	target.HealingLightHoTActive = false
	target.HealingLightHoTAmount = 0
	target.HealingLightHoTSourceID = ""
	target.HealingLightHoTTicksRemaining = 0
	target.HealingLightHoTEndTime = time.Time{}
	target.LastHealingLightHoTTick = time.Time{}
}

// Caller owns the recipient lock. Renewal is applied to friendly NPCs as well
// as players. Keep its cast snapshot, one-second cadence and finite tick budget
// independent of recipient AI or stun; never heal a corpse or expired effect.
func (w *World) tickRenewalLocked(target *Entity, now time.Time) {
	if !target.HealingLightHoTActive {
		return
	}
	if target.State == "DEAD" || target.Health <= 0 || target.HealingLightHoTTicksRemaining <= 0 || now.After(target.HealingLightHoTEndTime) {
		clearRenewalLocked(target)
		return
	}
	if now.Sub(target.LastHealingLightHoTTick) < time.Second {
		return
	}
	target.LastHealingLightHoTTick = now
	before := target.Health
	target.Health += applyHealingReceived(target, target.HealingLightHoTAmount)
	if target.Health > target.MaxHealth {
		target.Health = target.MaxHealth
	}
	target.HealingLightHoTTicksRemaining--
	if actual := target.Health - before; actual > 0 && w.OnEvent != nil {
		sourceID := target.HealingLightHoTSourceID
		if sourceID == "" {
			sourceID = "healinglight_hot"
		}
		w.OnEvent("heal", HealEvent{TargetID: target.ID, SourceID: sourceID, Amount: actual, Kind: "healing_light_hot", InstanceID: target.InstanceID})
	}
	if target.HealingLightHoTTicksRemaining <= 0 {
		clearRenewalLocked(target)
	}
}
