package game

import (
	_ "embed"
	"encoding/json"
	"math"
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

func worldPopulationSpawnAllowed(x, z float64) bool {
	for _, f := range worldPopulationFootprints {
		if math.Abs(x-f.X) <= f.Width/2+2 && math.Abs(z-f.Z) <= f.Depth/2+2 {
			return false
		}
	}
	return true
}
