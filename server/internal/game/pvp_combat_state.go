package game

import (
	"maps"
	"time"
)

func clonePvPOrigin(origin *PvPOrigin) *PvPOrigin {
	if origin == nil {
		return nil
	}
	copy := *origin
	return &copy
}

type pvpCooldownState struct {
	skills          map[string]time.Time
	attack, ability time.Time
}

func capturePvPCooldowns(player *Entity) pvpCooldownState {
	return pvpCooldownState{maps.Clone(player.Cooldowns), player.LastAttackTime, player.LastAbilityTime}
}

func restorePvPCooldowns(player *Entity, state pvpCooldownState) {
	player.Cooldowns = maps.Clone(state.skills)
	player.LastAttackTime, player.LastAbilityTime = state.attack, state.ability
}

// World.Mu is held and no player lock is held. Arena instances contain only
// participants and combat-created entities; remove only this match's nonplayers.
func (w *World) clearPvPEphemeraLocked(matchID string) {
	for id, entity := range w.Entities {
		entity.Mu.Lock()
		if entity.InstanceID == matchID && entity.Type != TypePlayer {
			w.Grid.Remove(entity)
			delete(w.Entities, id)
		}
		entity.Mu.Unlock()
	}
}

// Each round is a fresh combat state. Equipment, talents, persistent rest bank,
// quests and currencies are intentionally untouched. Actor lock is held.
func clearPvPCombatStateLocked(p *Entity) {
	recalculate := p.BerserkerModeActive || p.LastStandActive || p.ZealActive || p.IronFortressActive || p.TimeWarpActive || p.SwiftActive || p.BlessingResolveActive || p.CloakSwiftSpeedBonus || p.CloakBurstSpeedBonus || p.Slowed
	p.Cooldowns = nil
	p.LastAttackTime, p.LastAbilityTime = time.Time{}, time.Time{}
	p.BerserkerModeActive, p.LastStandActive, p.StealthActive, p.ZealActive = false, false, false, false
	p.BerserkerModeEndTime, p.LastStandEndTime, p.StealthEndTime, p.ZealEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.BerserkerModeMultiplier, p.LastStandMultiplier, p.ZealPower = 0, 0, 0
	p.IronFortressActive, p.GuardianRoarActive, p.SerratedEdgesActive, p.PoisonCoatingActive = false, false, false, false
	p.IronFortressEndTime, p.GuardianRoarEndTime, p.SerratedEdgesEndTime, p.PoisonCoatingEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.SpellFocusActive, p.ArcaneShieldActive, p.TimeWarpActive, p.DivineInterventionActive = false, false, false, false
	p.SpellFocusEndTime, p.ArcaneShieldEndTime, p.TimeWarpEndTime, p.DivineInterventionEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.SpellFocusMultiplier, p.ArcaneShieldHP, p.ArcaneShieldAbsorbed = 0, 0, 0
	p.BlessingResolveActive, p.GuardianEmbraceActive = false, false
	p.BlessingResolveEndTime, p.GuardianEmbraceEndTime, p.LastGuardianEmbraceTick = time.Time{}, time.Time{}, time.Time{}
	p.BlessingResolvePower, p.GuardianEmbraceRadius = 0, 0
	p.Stunned, p.Slowed, p.Rooted, p.WeakPointMarked, p.MarkWeakness = false, false, false, false, false
	p.StunEndTime, p.SlowEndTime, p.RootEndTime, p.WeakPointEndTime, p.MarkWeaknessEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.SlowFactor, p.MarkWeaknessFactor, p.ArmorReduction = 0, 0, 0
	p.ArmorReductionEndTime = time.Time{}
	p.Bleeding, p.Poisoned = false, false
	p.BleedDamage, p.PoisonDamage = 0, 0
	p.BleedSourceID, p.PoisonSourceID = "", ""
	p.BleedEndTime, p.PoisonEndTime, p.LastBleedTick, p.LastPoisonTick = time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.SpiritsActive = false
	p.SpiritsBoosted, p.CCImmune, p.SwiftActive = false, false, false
	p.SpiritRadius, p.RuneArmorBuff = 0, 0
	p.SpiritEndTime, p.LastSpiritTick, p.CCImmuneEndTime, p.SwiftEndTime, p.RuneArmorBuffEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.IronFortressThorns, p.IronFortressImmovable, p.CloakSwiftSpeedBonus, p.CloakBurstSpeedBonus = false, false, false, false
	p.IronFortressRuneID, p.ArcaneShieldRuneID, p.SpiritGuardiansRuneID = "", "", ""
	p.CloakBurstSpeedEndTime, p.AccuracyReductionEndTime = time.Time{}, time.Time{}
	p.AccuracyReduction = 0
	p.SanctuaryDamageReduction, p.HealingLightHoTActive, p.DivineInterventionGuardian, p.ConsecratedGroundSanctuary = false, false, false, false
	p.SanctuaryEndTime, p.ConsecratedSanctuaryEndTime, p.HealingLightHoTEndTime, p.LastHealingLightHoTTick, p.DivineInterventionGuardTime, p.ConsecratedGroundEndTime = time.Time{}, time.Time{}, time.Time{}, time.Time{}, time.Time{}, time.Time{}
	p.HealingLightHoTAmount, p.HealingLightHoTTicksRemaining = 0, 0
	p.HealingLightHoTSourceID, p.ConsecratedGroundRuneID = "", ""
	p.LastSkillUsed, p.ActiveCombo = "", ""
	p.LastSkillTime, p.ActiveComboEndTime = time.Time{}, time.Time{}
	clearWhirlwindLocked(p)
	clearChargeStateLocked(p)
	if recalculate {
		p.RecalculateStats()
	}
}
