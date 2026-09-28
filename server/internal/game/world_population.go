package game

import (
	_ "embed"
	"encoding/json"
	"math"
	"math/rand"
)

// Generated from the exact solid scenery footprints, not a circular exclusion
// around an entire location. Roads and gathering spaces remain combat territory.
//
//go:embed content/world-population-footprints.json
var worldPopulationContent []byte

type worldPopulationFootprint struct {
	SiteID string  `json:"siteId"`
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Width  float64 `json:"width"`
	Depth  float64 `json:"depth"`
}

type worldReading struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	X    float64 `json:"x"`
	Z    float64 `json:"z"`
}

func (w *World) spawnWorldReadings() {
	var data struct {
		Readings []worldReading `json:"readings"`
	}
	if err := json.Unmarshal(worldPopulationContent, &data); err != nil {
		panic(err)
	}
	seen := map[string]bool{}
	for _, reading := range data.Readings {
		if reading.ID == "" || seen[reading.ID] || reading.Name == "" || !finiteCoordinate(reading.X) || !finiteCoordinate(reading.Z) {
			panic("invalid world reading")
		}
		seen[reading.ID] = true
		w.AddEntity(&Entity{ID: reading.ID, Name: reading.Name, Type: TypeNPC, SubType: "WorldReading",
			X: reading.X, Z: reading.Z, SpawnX: reading.X, SpawnZ: reading.Z, State: "IDLE", Scale: 1})
	}
}

var worldPopulationFootprints = func() []worldPopulationFootprint {
	var data struct {
		SchemaVersion int                        `json:"schemaVersion"`
		Footprints    []worldPopulationFootprint `json:"footprints"`
	}
	if err := json.Unmarshal(worldPopulationContent, &data); err != nil || data.SchemaVersion != 1 || len(data.Footprints) == 0 {
		panic("invalid world population footprints")
	}
	for _, f := range data.Footprints {
		if f.SiteID == "" || !finiteCoordinate(f.X) || !finiteCoordinate(f.Z) || !finiteCoordinate(f.Width) || !finiteCoordinate(f.Depth) || f.Width <= 0 || f.Depth <= 0 {
			panic("invalid world population solid")
		}
	}
	return data.Footprints
}()

const worldPopulationCellSize = 128.0

// Built once from immutable authored solids. A spawn roll used to scan every
// realm's scenery, even when nowhere near it. World construction repeats this
// thousands of times; race instrumentation made that full scan particularly
// expensive across the whole game test package. Index padded bounds, retaining
// the exact narrow-phase predicate and random roll sequence.
var worldPopulationCells = func() map[[2]int][]worldPopulationFootprint {
	cells := make(map[[2]int][]worldPopulationFootprint)
	for _, f := range worldPopulationFootprints {
		minX, maxX := int(math.Floor((f.X-f.Width/2-2)/worldPopulationCellSize)), int(math.Floor((f.X+f.Width/2+2)/worldPopulationCellSize))
		minZ, maxZ := int(math.Floor((f.Z-f.Depth/2-2)/worldPopulationCellSize)), int(math.Floor((f.Z+f.Depth/2+2)/worldPopulationCellSize))
		for x := minX; x <= maxX; x++ {
			for z := minZ; z <= maxZ; z++ {
				key := [2]int{x, z}
				cells[key] = append(cells[key], f)
			}
		}
	}
	return cells
}()

func worldPopulationSpawnAllowed(x, z float64) bool {
	// Preserve the previous predicate for nonfinite diagnostic input, without
	// converting NaN/infinity into an implementation-dependent integer key.
	if !finiteCoordinate(x) || !finiteCoordinate(z) {
		return true
	}
	key := [2]int{int(math.Floor(x / worldPopulationCellSize)), int(math.Floor(z / worldPopulationCellSize))}
	for _, f := range worldPopulationCells[key] {
		if math.Abs(x-f.X) <= f.Width/2+2 && math.Abs(z-f.Z) <= f.Depth/2+2 {
			return false
		}
	}
	return true
}

// Elite count/strength stays unchanged when a roll lands in scenery. Search a
// small bounded neighborhood, retaining its sector and beginner-protection rules.
func (w *World) clearEliteScenerySpawn(subType string, x, z, minX, maxX, minZ, maxZ float64) (float64, float64, bool) {
	if worldPopulationSpawnAllowed(x, z) {
		return x, z, true
	}
	for radius := 3.0; radius <= 48; radius += 3 {
		for i := 0; i < 8; i++ {
			angle := float64(i) * math.Pi / 4
			px, pz := x+math.Cos(angle)*radius, z+math.Sin(angle)*radius
			if px < minX || px > maxX || pz < minZ || pz > maxZ || w.SafeZoneAt("", px, pz) != "" ||
				!worldPopulationSpawnAllowed(px, pz) || !lanternholdAdvancedSpawnAllowed(subType, px, pz) {
				continue
			}
			if subType == "Skeleton" && lanternholdSkeletonLevel(px, pz) < 10 {
				continue
			}
			return px, pz, true
		}
	}
	return x, z, false
}

// Regional spawners do not use the Earth rectangular-spawn helper. Keep their
// rolls inside their original sector and exclude only authored solid scenery.
func rollWorldPopulationSpawn(minX, maxX, minZ, maxZ float64) (float64, float64, bool) {
	for attempt := 0; attempt < 16; attempt++ {
		x := minX + rand.Float64()*(maxX-minX)
		z := minZ + rand.Float64()*(maxZ-minZ)
		if worldPopulationSpawnAllowed(x, z) {
			return x, z, true
		}
	}
	return 0, 0, false
}
