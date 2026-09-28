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

func TestWorldPopulationReadingsSpawnAsNoncombatObjects(t *testing.T) {
	w := NewWorld(nil)
	for _, id := range []string{"world-reading-bellkeepers-cairn", "world-reading-unbound-milestone"} {
		entity := w.Entities[id]
		if entity == nil || entity.Type != TypeNPC || entity.SubType != "WorldReading" || entity.InstanceID != "" || entity.Health != 0 {
			t.Fatalf("missing/non-passive optional reading: %s", id)
		}
		if entity.X != entity.SpawnX || entity.Z != entity.SpawnZ {
			t.Fatalf("reading position drift: %s", id)
		}
	}
}

func TestWorldPopulationEliteSceneryRecovery(t *testing.T) {
	w := &World{}
	for _, f := range worldPopulationFootprints {
		// Test each solid with the real elite type/sector that can reach it.
		kind, minX, maxX := "Skeleton", -200.0, 200.0
		switch {
		case f.X < -200:
			kind, minX, maxX = "Imp", -600, -200
		case f.X > 600:
			kind, minX, maxX = "InfernoTitan", 600, 1000
		case f.X > 200:
			kind, minX, maxX = "DemonOrc", 200, 600
		}
		// Starter protection would move these sites before scenery recovery.
		if kind == "Skeleton" && lanternholdSkeletonLevel(f.X, f.Z) < 10 {
			continue
		}
		x, z, ok := w.clearEliteScenerySpawn(kind, f.X, f.Z, minX, maxX, -600, 1000)
		if !ok || !worldPopulationSpawnAllowed(x, z) || !lanternholdAdvancedSpawnAllowed(kind, x, z) || x < minX || x > maxX {
			t.Fatalf("could not preserve elite at %s: %v %v %v", f.SiteID, x, z, ok)
		}
	}
	x, z, ok := w.clearEliteScenerySpawn("Skeleton", 0, -400, -200, 200, -600, 1000)
	if !ok || x != 0 || z != -400 {
		t.Fatal("unaffected elite was moved")
	}
	_, _, ok = w.clearEliteScenerySpawn("InfernoTitan", 742, 212, 741.9, 742.1, 211.9, 212.1)
	if ok {
		t.Fatal("accepted an impossible fully obstructed spawn sector")
	}
}
