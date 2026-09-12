package game

import (
	"math"
	"time"
)

// Caller holds the recipient lock. Rune armor changes effective mitigation,
// never equipment-derived Defense. Read the deadline at impact so an expired
// buff cannot keep helping until the recipient's next update.
func effectiveCombatArmorLocked(target *Entity, now time.Time) int {
	armor := max(0, target.Defense)
	if target.RuneArmorBuff == .2 && now.Before(target.RuneArmorBuffEndTime) {
		armor = int(math.Floor(float64(armor) * 1.2))
	}
	return max(0, armor-target.ArmorReduction)
}
