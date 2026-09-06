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
