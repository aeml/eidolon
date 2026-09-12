package game

import "time"

// Caller owns the actor lock. Travel immunity belongs to the accepted Charge
// rune, not the current loadout. Cancel it before discarding that identity.
// Already-earned armor, unrelated immunity, cooldowns and resources survive.
func clearChargeStateLocked(player *Entity) {
	if player.ChargeRuneID == "charge_unstoppable" {
		player.CCImmune = false
		player.CCImmuneEndTime = time.Time{}
	}
	player.IsCharging = false
	player.ChargeStartX, player.ChargeStartZ = player.X, player.Z
	player.ChargeTargetX, player.ChargeTargetZ = player.X, player.Z
	player.ChargeRuneID, player.ChargeSkillName = "", ""
	player.ChargeEffectDurationBonus = 0
}
