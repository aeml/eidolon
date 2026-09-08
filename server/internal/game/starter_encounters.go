package game

import (
	"fmt"
	"math"
)

// These are ordinary world enemies, shared by all players, with normal kills,
// drops and respawns. Their level never adapts to the approaching player.
var lanternholdStarterSpawns = [...]struct{ x, z float64 }{
	{125, 180}, {130, 215}, {125, 250},
}

func starterSkeletonID(index int) string {
	return fmt.Sprintf("Skeleton-lanternhold-%d", index)
}

// Starter road wardens should not acquire a new traveler from the same distance
// as endgame enemies. A provoked enemy still uses the full retaliation range.
// This depends on the enemy's authored level, never the approaching player's.
func unprovokedEnemySightRange(enemy *Entity) float64 {
	if enemy.InstanceID == "" && enemy.SubType == "Skeleton" &&
		enemy.Level >= 1 && enemy.Level < 10 {
		return float64(12 + 3*enemy.Level)
	}
	return EnemySightRange
}

// Level-three roads extend 85 units past the town edge. Reserve enough space
// for a higher-level neighbor's 45-unit sight and 10-unit idle roam, plus a
// reaction margin. This affects initial spawns, not combat pursuit or immunity.
const lanternholdAdvancedSpawnDistance = 160.0

func lanternholdAdvancedSpawnAllowed(subType string, x, z float64) bool {
	if subType != "Imp" && subType != "DemonOrc" {
		return true
	}
	dx := math.Max(0, math.Abs(x)-100)
	dz := math.Max(0, math.Abs(z-200)-100)
	return math.Hypot(dx, dz) >= lanternholdAdvancedSpawnDistance
}

func lanternholdSkeletonLevel(x, z float64) int {
	// Distance outside the town rectangle, not distance from its center: all
	// gates start gently, and the existing level-ten profile resumes farther out.
	dx := math.Max(0, math.Abs(x)-100)
	dz := math.Max(0, math.Abs(z-200)-100)
	distance := math.Hypot(dx, dz)
	return min(10, 1+max(0, int(math.Ceil((distance-45)/20))))
}

func nearAuthoredStarterEncounter(x, z float64) bool {
	for _, point := range lanternholdStarterSpawns {
		if math.Hypot(x-point.x, z-point.z) < 16 {
			return true
		}
	}
	return false
}

func lanternholdElitePosition(x, z float64) (float64, float64) {
	if lanternholdSkeletonLevel(x, z) < 10 {
		// The central elite sector extends from z=-600 to z=1000. Preserve
		// elite strength while keeping its spawn beyond the starter wards.
		if z >= 200 {
			z = 525
		} else {
			z = -125
		}
	}
	return x, z
}
