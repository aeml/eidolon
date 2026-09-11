package game

import "time"

// Caller holds the recipient lock. Support spells may affect NPCs as well as
// players; their deadlines must not depend on which actor owns the update.
func expireRecipientSupportBuffsLocked(target *Entity, now time.Time) {
	statsChanged := false
	if target.GuardianRoarActive && !now.Before(target.GuardianRoarEndTime) {
		target.GuardianRoarActive = false
		target.GuardianRoarEndTime = time.Time{}
		statsChanged = true
	}
	if target.TimeWarpActive && !now.Before(target.TimeWarpEndTime) {
		target.TimeWarpActive = false
		target.TimeWarpEndTime = time.Time{}
		statsChanged = true
	}
	if target.ZealActive && !now.Before(target.ZealEndTime) {
		target.ZealActive = false
		target.ZealEndTime = time.Time{}
		statsChanged = true
	}
	if target.BlessingResolveActive && !now.Before(target.BlessingResolveEndTime) {
		target.BlessingResolveActive = false
		target.BlessingResolveEndTime = time.Time{}
		statsChanged = true
	}
	if target.DivineInterventionActive && !now.Before(target.DivineInterventionEndTime) {
		target.DivineInterventionActive = false
		target.DivineInterventionEndTime = time.Time{}
	}
	if target.DivineInterventionGuardian && !now.Before(target.DivineInterventionGuardTime) {
		target.DivineInterventionGuardian = false
		target.DivineInterventionGuardTime = time.Time{}
	}
	if statsChanged {
		target.RecalculateStats()
	}
}
