package game

import (
	"math"
	"time"
)

const (
	MaxWellRestedSeconds       = 7200.0
	WellRestedStatMultiplier   = 1.10
	WellRestedKillXPMultiplier = 1.25
	SafeZoneRecoveryPerSecond  = 0.10
)

func (e *Entity) IsWellRested() bool {
	return e != nil && e.Type == TypePlayer && e.WellRestedSeconds > 0 && finiteCoordinate(e.WellRestedSeconds)
}

// Called last by RecalculateStats, after all un-rested derived values exist.
// Crit chance is handled at its single final equipment+talent probability roll.
func (e *Entity) applyWellRestedStats() {
	if !e.IsWellRested() {
		return
	}
	boost := func(value int) int { return int(math.Floor(float64(value)*WellRestedStatMultiplier + 1e-9)) }
	e.Stats = Stats{Strength: boost(e.Stats.Strength), Dexterity: boost(e.Stats.Dexterity),
		Intelligence: boost(e.Stats.Intelligence), Wisdom: boost(e.Stats.Wisdom), Vitality: boost(e.Stats.Vitality)}
	e.MaxHealth, e.MaxMana = boost(e.MaxHealth), boost(e.MaxMana)
	e.Damage, e.Defense = boost(e.Damage), boost(e.Defense)
	e.Speed *= WellRestedStatMultiplier
	e.CastSpeed *= WellRestedStatMultiplier
	e.HpRegen *= WellRestedStatMultiplier
	e.ManaRegen *= WellRestedStatMultiplier
	e.AttackSpeed /= WellRestedStatMultiplier
	e.AttackCooldown = time.Duration(e.AttackSpeed * float64(time.Second))
	cdrCap := 0.5
	if e.TimeWarpActive {
		cdrCap = 0.8
	}
	e.CooldownReduction = math.Min(cdrCap, e.CooldownReduction*WellRestedStatMultiplier)
	e.FireDamageBonus *= WellRestedStatMultiplier
	e.PoisonDamageBonus *= WellRestedStatMultiplier
	e.HolyDamageBonus *= WellRestedStatMultiplier
	e.HealingDoneBonus *= WellRestedStatMultiplier
	e.LifestealBonus *= WellRestedStatMultiplier
	e.AllResistBonus *= WellRestedStatMultiplier
}

func wellRestedKillXP(player *Entity, xp int) int {
	if xp <= 0 || !player.IsWellRested() {
		return xp
	}
	return int(math.Floor(float64(xp) * WellRestedKillXPMultiplier))
}

// Caller holds Entity.Mu. Time comes from the server simulation, never a client
// timestamp. Split expiry ticks so a long update cannot extend boosted regen.
func (e *Entity) updateSafeZoneRestLocked(dt float64, zoneID string, now time.Time) {
	if e.Type != TypePlayer || dt <= 0 || !finiteCoordinate(dt) {
		return
	}
	e.SafeZoneID = zoneID
	if e.Disconnected {
		e.hpRegenRemainder, e.manaRegenRemainder = 0, 0
		return
	}
	wasRested := e.IsWellRested()
	if !finiteCoordinate(e.WellRestedSeconds) || e.WellRestedSeconds < 0 {
		e.WellRestedSeconds = 0
	}
	e.WellRestedSeconds = math.Min(MaxWellRestedSeconds, e.WellRestedSeconds)
	if zoneID != "" {
		if e.State == "DEAD" || e.Health <= 0 {
			e.hpRegenRemainder, e.manaRegenRemainder = 0, 0
			return
		}
		e.WellRestedSeconds = math.Min(MaxWellRestedSeconds, e.WellRestedSeconds+dt)
		if !wasRested {
			e.RecalculateStats()
		}
		if !now.Before(e.QAHealthRegenPausedUntil) {
			e.Health = regenerateResource(e.Health, e.MaxHealth, float64(e.MaxHealth)*SafeZoneRecoveryPerSecond*dt, &e.hpRegenRemainder)
		} else {
			e.hpRegenRemainder = 0
		}
		e.Mana = regenerateResource(e.Mana, e.MaxMana, float64(e.MaxMana)*SafeZoneRecoveryPerSecond*dt, &e.manaRegenRemainder)
		return
	}
	boostedTime := math.Min(dt, e.WellRestedSeconds)
	if boostedTime > 0 {
		e.regenerateForDurationLocked(now, boostedTime)
	}
	e.WellRestedSeconds = math.Max(0, e.WellRestedSeconds-dt)
	if wasRested && !e.IsWellRested() {
		e.RecalculateStats()
		e.Health = min(e.Health, max(0, e.MaxHealth))
		e.Mana = min(e.Mana, max(0, e.MaxMana))
	}
	if dt > boostedTime {
		e.regenerateForDurationLocked(now, dt-boostedTime)
	}
}
