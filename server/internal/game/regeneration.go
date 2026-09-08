package game

import (
	"math"
	"time"
)

// Resource points per second, per Vitality/Wisdom point. Keep the offline
// constant in src/core/Regeneration.js and stat descriptions in agreement.
const PassiveRegenPerStat = 0.01

// Resource state is integer-valued, so retain sub-point regeneration between
// ticks. Truncating every tick would prevent early characters regenerating at
// all. Fractions are transient, never banked while full, dead, or disabled.
func regenerateResource(current, maximum int, rate float64, remainder *float64) int {
	if current >= maximum || rate <= 0 || math.IsNaN(rate) || math.IsInf(rate, 0) {
		*remainder = 0
		return current
	}
	amount := rate + *remainder
	if amount >= float64(maximum-current) {
		*remainder = 0
		return maximum
	}
	whole := math.Floor(amount + 1e-9)
	*remainder = math.Max(0, amount-whole)
	return current + int(whole)
}

// Caller holds the entity lock; this represents one existing one-second tick.
func (e *Entity) regenerateLocked(now time.Time) {
	if e.Disconnected || e.State == "DEAD" || e.Health <= 0 {
		e.hpRegenRemainder, e.manaRegenRemainder = 0, 0
		return
	}
	if now.Before(e.QAHealthRegenPausedUntil) {
		e.hpRegenRemainder = 0
	} else {
		e.Health = regenerateResource(e.Health, e.MaxHealth, e.HpRegen, &e.hpRegenRemainder)
	}
	e.Mana = regenerateResource(e.Mana, e.MaxMana, e.ManaRegen, &e.manaRegenRemainder)
}
