package game

import "math"

// Player fallback attacks only; enemies retain their existing profiles.
// Keep the client BasicAttackCadence formula and Dexterity tooltip in sync.
func playerBasicAttackInterval(dexterity int) float64 {
	return math.Max(1, 2/(1+float64(max(0, dexterity))*.005))
}
