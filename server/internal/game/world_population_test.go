package game

import "testing"

func TestWorldPopulationSpawnSolids(t *testing.T) {
	for _, f := range worldPopulationFootprints {
		if worldPopulationSpawnAllowed(f.X, f.Z) {
			t.Fatalf("enemy may spawn inside %s", f.SiteID)
		}
	}
	// These are road/camp/optional-reading meeting points, not protected zones.
	for _, point := range [][2]float64{{0, -260}, {-180, 430}, {-480, 530}, {-320, -180}, {520, 440}, {-750, 200}} {
		if !worldPopulationSpawnAllowed(point[0], point[1]) {
			t.Fatalf("open approach incorrectly excludes enemies: %v", point)
		}
	}
}
