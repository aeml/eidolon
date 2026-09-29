package game

import (
	"math"
	"math/rand"
	"strings"
	"testing"
)

func linearWorldPopulationSpawnAllowed(x, z float64) bool {
	for _, f := range worldPopulationFootprints {
		if math.Abs(x-f.X) <= f.Width/2+2 && math.Abs(z-f.Z) <= f.Depth/2+2 {
			return false
		}
	}
	return true
}

func TestWorldPopulationIndexMatchesAllPaddedEdgesAndRealms(t *testing.T) {
	check := func(x, z float64) {
		t.Helper()
		if worldPopulationSpawnAllowed(x, z) != linearWorldPopulationSpawnAllowed(x, z) {
			t.Fatalf("index changes scenery exclusion at (%v,%v)", x, z)
		}
	}
	for _, f := range worldPopulationFootprints {
		for _, side := range []float64{-1, 0, 1} {
			for _, epsilon := range []float64{-.00001, 0, .00001} {
				for _, corner := range []float64{-1, 0, 1} {
					check(f.X+side*(f.Width/2+2+epsilon), f.Z+corner*(f.Depth/2+2+epsilon))
				}
			}
		}
	}
	random := rand.New(rand.NewSource(118))
	for i := 0; i < 20000; i++ {
		check(random.Float64()*7000-3500, random.Float64()*5000-3000)
	}
	for x := -28; x < 28; x++ {
		for z := -24; z < 16; z++ {
			for _, epsilon := range []float64{-.00001, 0, .00001} {
				check(float64(x)*worldPopulationCellSize+epsilon, float64(z)*worldPopulationCellSize+epsilon)
			}
		}
	}
	for _, value := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		check(value, 0)
		check(0, value)
	}
}

func BenchmarkWorldPopulationSpawnLookup(b *testing.B) {
	points := make([][2]float64, 1024)
	random := rand.New(rand.NewSource(118))
	for i := range points {
		points[i] = [2]float64{random.Float64()*6000 - 3000, random.Float64()*3500 - 2000}
	}
	for _, method := range []struct {
		name    string
		allowed func(float64, float64) bool
	}{{"linear", linearWorldPopulationSpawnAllowed}, {"indexed", worldPopulationSpawnAllowed}} {
		b.Run(method.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				point := points[i%len(points)]
				method.allowed(point[0], point[1])
			}
		})
	}
}

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

func TestDarkRealmPopulationKeepsAuthoredActorsAndSpawnPositionsClear(t *testing.T) {
	w := NewWorld(nil)
	for _, entity := range w.Entities {
		if entity.InstanceID != DarkRealmInstanceID || (entity.Type != TypeEnemy && entity.SubType != "ChronicleWitness" && entity.SubType != "StoryWizard") {
			continue
		}
		if !adminShapesClear(adminLandingColliders.DarkRealm, entity.SpawnX, 0, entity.SpawnZ) {
			t.Fatalf("Dark Realm actor spawns inside scene solids: %s", entity.ID)
		}
	}
}

func TestWorldPopulationReadingsSpawnAsNoncombatObjects(t *testing.T) {
	w := NewWorld(nil)
	for _, id := range []string{"world-reading-bellkeepers-cairn", "world-reading-unbound-milestone",
		"world-reading-soundings-stone", "world-reading-unclaimed-names", "world-reading-commons-register", "world-reading-counterseal-stone",
		"world-reading-unsent-dispatch", "world-reading-unmeasured-sky"} {
		entity := w.Entities[id]
		if entity == nil || entity.Type != TypeNPC || entity.SubType != "WorldReading" || entity.InstanceID != "" || entity.Health != 0 {
			t.Fatalf("missing/non-passive optional reading: %s", id)
		}
		if entity.X != entity.SpawnX || entity.Z != entity.SpawnZ {
			t.Fatalf("reading position drift: %s", id)
		}
	}
}

func TestWorldPopulationRegionalEnemiesKeepCountsAndClearSolids(t *testing.T) {
	w := NewWorld(nil)
	counts := map[string]int{}
	for _, entity := range w.Entities {
		if entity.Type != TypeEnemy || entity.InstanceID != "" {
			continue
		}
		if entity.Z >= -600 && entity.X >= -1000 && entity.X <= 1000 {
			continue
		}
		// Story combat anchors are separate authored encounters, not one of
		// the ordinary regional rolls whose density this test protects.
		if !strings.HasPrefix(entity.ID, entity.SubType+"-") {
			continue
		}
		if !worldPopulationSpawnAllowed(entity.SpawnX, entity.SpawnZ) {
			t.Fatalf("regional enemy spawned in scenery: %s", entity.SubType)
		}
		counts[entity.SubType]++
	}
	for _, kind := range []string{"MountainTroll", "AquaGolem", "Siren", "FrostGuardian"} {
		if counts[kind] != 300 {
			t.Fatalf("changed Water count %s: %d", kind, counts[kind])
		}
	}
	for _, kind := range []string{"SandstormDjinn", "MagmaGolem", "ScorchedWraith", "InfernalBehemoth", "PhoenixSentinel"} {
		if counts[kind] != 200 {
			t.Fatalf("changed Fire count %s: %d", kind, counts[kind])
		}
	}
	for _, kind := range []string{"StormHarpy", "CloudElemental", "ThunderRoc", "TempestGiant", "CycloneAvatar"} {
		if counts[kind] != 200 {
			t.Fatalf("changed Air count %s: %d", kind, counts[kind])
		}
	}
	f := worldPopulationFootprints[0]
	if _, _, ok := rollWorldPopulationSpawn(f.X-.01, f.X+.01, f.Z-.01, f.Z+.01); ok {
		t.Fatal("accepted an obstructed region")
	}
}

func TestWorldPopulationEliteSceneryRecovery(t *testing.T) {
	w := &World{}
	for _, f := range worldPopulationFootprints {
		// Test each solid with the real elite type/sector that can reach it.
		// Only Earth currently has randomly spawned rectangular-sector elites.
		if f.Z < -600 || f.X < -1000 || f.X > 1000 {
			continue
		}
		kind, minX, maxX := "Skeleton", -200.0, 200.0
		minZ, maxZ := -600.0, 1000.0
		switch {
		case f.X < -600:
			kind, minX, maxX = "Construct", -1000, -600
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
		x, z, ok := w.clearEliteScenerySpawn(kind, f.X, f.Z, minX, maxX, minZ, maxZ)
		if !ok || !worldPopulationSpawnAllowed(x, z) || !lanternholdAdvancedSpawnAllowed(kind, x, z) || x < minX || x > maxX || z < minZ || z > maxZ {
			t.Fatalf("could not preserve elite at %s: %v %v %v", f.SiteID, x, z, ok)
		}
	}
	x, z, ok := w.clearEliteScenerySpawn("Skeleton", 0, -400, -200, 200, -600, 1000)
	if !ok || x != 0 || z != -400 {
		t.Fatal("unaffected elite was moved")
	}
	var pier worldPopulationFootprint
	for _, footprint := range worldPopulationFootprints {
		if footprint.SiteID == "verdant-approach" {
			pier = footprint
			break
		}
	}
	if pier.SiteID == "" {
		t.Fatal("missing Bastion scenery fixture")
	}
	_, _, ok = w.clearEliteScenerySpawn("InfernoTitan", pier.X, pier.Z, pier.X-.1, pier.X+.1, pier.Z-.1, pier.Z+.1)
	if ok {
		t.Fatal("accepted an impossible fully obstructed spawn sector")
	}
}
