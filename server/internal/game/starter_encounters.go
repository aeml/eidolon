package game

import (
	"fmt"
	"math"
	"strings"
)

// These are ordinary world enemies, shared by all players, with normal kills,
// drops and respawns. Their level never adapts to the approaching player.
var lanternholdStarterSpawns = [...]struct{ x, z float64 }{
	{125, 180}, {130, 215}, {125, 250},
}

func starterSkeletonID(index int) string {
	return fmt.Sprintf("Skeleton-lanternhold-%d", index)
}

// Authored starter awareness, never scaled to the approaching player.
// Provoked enemies retain the normal retaliation range.
func unprovokedEnemySightRange(enemy *Entity) float64 {
	if enemy.InstanceID == "" && enemy.SubType == "Skeleton" && enemy.Level >= 1 && enemy.Level < 10 {
		return float64(12 + 3*enemy.Level)
	}
	return EnemySightRange
}

// Starter road enemies defend a local encounter instead of following a retreat
// through every neighboring sector. This is independent of the player's level.
// Higher-level enemies, elites, summons and instances retain their own behavior.
func starterPursuitRadius(enemy *Entity) float64 {
	if enemy.Type == TypeEnemy && enemy.InstanceID == "" && enemy.OwnerID == "" &&
		enemy.SubType == "Skeleton" && enemy.Level >= 1 && enemy.Level < 10 &&
		enemy.Scale < 4 && !strings.HasPrefix(enemy.ID, "elite-") {
		return 60
	}
	return 0
}

// Keep advanced initial spawns beyond the level-three roads plus their normal
// sight/idle-roam reach. This is not a pursuit leash or player immunity.
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
