package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
)

// Boundaries describe existing overworld geometry only. Dungeon interiors,
// discovery state, enemy bands and entry requirements retain their own owners.
type worldWall struct {
	Side string    `json:"side"`
	Gap  []float64 `json:"gap,omitempty"`
}

type worldRegion struct {
	ID    string      `json:"id"`
	Name  string      `json:"name"`
	MinX  float64     `json:"minX"`
	MaxX  float64     `json:"maxX"`
	MinZ  float64     `json:"minZ"`
	MaxZ  float64     `json:"maxZ"`
	Walls []worldWall `json:"walls"`
}

type worldGeographyDefinition struct {
	FenceStep float64       `json:"fenceStep"`
	Regions   []worldRegion `json:"regions"`
}

//go:embed content/world-geography.json
var worldGeographyJSON []byte

var worldGeography = func() worldGeographyDefinition {
	var data worldGeographyDefinition
	if err := json.Unmarshal(worldGeographyJSON, &data); err != nil {
		panic(err)
	}
	if err := validateWorldGeography(data); err != nil {
		panic(err)
	}
	return data
}()

func validateWorldGeography(data worldGeographyDefinition) error {
	if !finiteCoordinate(data.FenceStep) || data.FenceStep < 1 || data.FenceStep > 100 {
		return fmt.Errorf("invalid world fence step")
	}
	ids := map[string]bool{}
	for _, r := range data.Regions {
		if r.ID == "" || ids[r.ID] || r.Name == "" ||
			!finiteCoordinate(r.MinX) || !finiteCoordinate(r.MaxX) || !finiteCoordinate(r.MinZ) || !finiteCoordinate(r.MaxZ) ||
			r.MinX >= r.MaxX || r.MinZ >= r.MaxZ || r.MaxX-r.MinX > 10000 || r.MaxZ-r.MinZ > 10000 {
			return fmt.Errorf("invalid world region %q", r.ID)
		}
		ids[r.ID] = true
		sides := map[string]bool{}
		for _, wall := range r.Walls {
			if sides[wall.Side] || (wall.Side != "north" && wall.Side != "south" && wall.Side != "west" && wall.Side != "east") {
				return fmt.Errorf("invalid world wall %q", wall.Side)
			}
			sides[wall.Side] = true
			min, max := r.MinX, r.MaxX
			if wall.Side == "west" || wall.Side == "east" {
				min, max = r.MinZ, r.MaxZ
			}
			if wall.Gap != nil && (len(wall.Gap) != 2 || !finiteCoordinate(wall.Gap[0]) || !finiteCoordinate(wall.Gap[1]) ||
				wall.Gap[0] <= min || wall.Gap[1] >= max || wall.Gap[0] >= wall.Gap[1]) {
				return fmt.Errorf("invalid world gate in %q", r.ID)
			}
		}
	}
	if len(ids) != 5 || !ids["earth"] || !ids["town"] || !ids["water"] || !ids["fire"] || !ids["air"] {
		return fmt.Errorf("missing overworld region")
	}
	return nil
}

func overworldRegion(id string) worldRegion {
	for _, r := range worldGeography.Regions {
		if r.ID == id {
			return r
		}
	}
	panic("missing overworld region: " + id)
}

func lanternholdSafeZone() SafeZone {
	r := overworldRegion("town")
	return SafeZone{ID: "lanternhold", Name: r.Name, MinX: r.MinX, MaxX: r.MaxX, MinZ: r.MinZ, MaxZ: r.MaxZ}
}

func (w *World) spawnFence() {
	for _, r := range worldGeography.Regions {
		for _, wall := range r.Walls {
			vertical := wall.Side == "west" || wall.Side == "east"
			min, max, fixed, rotation := r.MinX, r.MaxX, r.MinZ, 0.0
			if wall.Side == "south" {
				fixed = r.MaxZ
			}
			if vertical {
				min, max, fixed, rotation = r.MinZ, r.MaxZ, r.MinX, math.Pi/2
				if wall.Side == "east" {
					fixed = r.MaxX
				}
			}
			// Keep the original grid origin across gates: restarting at the far
			// gate edge would shift town posts because its gap is not step-aligned.
			for p := min; p <= max; p += worldGeography.FenceStep {
				if len(wall.Gap) == 2 && p > wall.Gap[0] && p < wall.Gap[1] {
					continue
				}
				x, z := p, fixed
				if vertical {
					x, z = fixed, p
				}
				w.AddEntity(&Entity{ID: fmt.Sprintf("fence-%d-%d", int(x), int(z)), Type: TypeFence,
					X: x, Z: z, Rotation: rotation, State: "IDLE", Scale: 1})
			}
		}
	}
}
