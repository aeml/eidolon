package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
)

// Candidate surface for the Earth elevation integration. Worlds keep the field
// nil until movement, placement and effects share the contract. Do not enable
// it by raising the client mesh alone.
//
//go:embed content/world-elevation.json
var worldElevationJSON []byte

func (w *World) TerrainProfile() string {
	if w != nil && w.terrainElevation != nil {
		if len(w.rockSolids) > 0 {
			return "earth-elevation-rocks-v1"
		}
		return "earth-elevation-v1"
	}
	return "flat-v1"
}

type elevationBounds struct {
	MinX float64 `json:"minX"`
	MaxX float64 `json:"maxX"`
	MinZ float64 `json:"minZ"`
	MaxZ float64 `json:"maxZ"`
}

type elevationHill struct {
	X       float64 `json:"x"`
	Z       float64 `json:"z"`
	RadiusX float64 `json:"radiusX"`
	RadiusZ float64 `json:"radiusZ"`
	Height  float64 `json:"height"`
}

type elevationPad struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Radius float64 `json:"radius"`
}

type elevationDefinition struct {
	SchemaVersion int             `json:"schemaVersion"`
	Region        string          `json:"region"`
	Spacing       float64         `json:"spacing"`
	EdgeFade      float64         `json:"edgeFade"`
	PadFade       float64         `json:"padFade"`
	MaxGrade      float64         `json:"maxGrade"`
	Bounds        elevationBounds `json:"bounds"`
	FlatTown      elevationBounds `json:"flatTown"`
	Hills         []elevationHill `json:"hills"`
	Pads          []elevationPad  `json:"pads"`
}

type worldElevationField struct {
	Bounds              elevationBounds
	Columns, Rows       int
	StepX, StepZ        float64
	MaxHeight, MaxGrade float64
	heights             []float64
}

func (w *World) overworldGroundHeight(instanceID string, x, z float64) (float64, bool) {
	if w.terrainElevation == nil || instanceID != "" {
		return 0, false
	}
	return w.terrainElevation.sample(x, z, ""), true
}

// Ability constructors supply a height above the local floor. Convert once,
// before publishing; ordinary AddEntity still accepts absolute world positions.
// Caller holds the world lock and owns the newly constructed projectile.
func (w *World) addProjectileLocked(e *Entity) {
	if ground, active := w.overworldGroundHeight(e.InstanceID, e.X, e.Z); active {
		e.Y += ground
	}
	w.Entities[e.ID] = e
	w.Grid.Add(e)
}

// Caller owns the entity lock (or the entity has not yet been published).
// Projectiles, static NPC offsets and instance-owned floors have separate
// placement contracts. Do not silently reinterpret their Y values here.
func (w *World) groundActorLocked(e *Entity) {
	if (e.Type != TypePlayer && e.Type != TypeEnemy && !(e.Type == TypeNPC && e.SubType == "AvengingSeraph")) || e.State == "JUMPING" {
		return
	}
	if height, ok := w.overworldGroundHeight(e.InstanceID, e.X, e.Z); ok {
		e.Y = height
	}
}

// Loot has a stable authored half-unit presentation offset. Apply at every
// publication path, including async death drops that do not call AddEntity.
func (w *World) groundLootLocked(e *Entity) {
	if e.Type != TypeLoot {
		return
	}
	if e.InstanceID == "" && len(w.rockSolids) > 0 {
		point := recoverRockPosition(w.rockSolids, rockPoint{e.X, e.Z}, .5)
		e.X, e.Z = point.X, point.Z
	}
	if height, active := w.overworldGroundHeight(e.InstanceID, e.X, e.Z); active {
		e.Y = height + .5
	}
}

func elevationSmooth(value float64) float64 {
	t := math.Max(0, math.Min(1, value))
	return t * t * (3 - 2*t)
}

func readWorldElevationCandidate() (*worldElevationField, error) {
	var data elevationDefinition
	if err := json.Unmarshal(worldElevationJSON, &data); err != nil {
		return nil, err
	}
	return newWorldElevationField(data)
}

func newWorldElevationField(data elevationDefinition) (*worldElevationField, error) {
	b := data.Bounds
	for _, value := range []float64{b.MinX, b.MaxX, b.MinZ, b.MaxZ, data.Spacing, data.EdgeFade,
		data.PadFade, data.MaxGrade, data.FlatTown.MinX, data.FlatTown.MaxX, data.FlatTown.MinZ, data.FlatTown.MaxZ} {
		if !finiteCoordinate(value) {
			return nil, fmt.Errorf("non-finite world elevation definition")
		}
	}
	if data.SchemaVersion != 1 || data.Region != "earth" || data.Spacing != 16 ||
		b.MaxX <= b.MinX || b.MaxZ <= b.MinZ || b.MaxX-b.MinX > 10000 || b.MaxZ-b.MinZ > 10000 ||
		data.EdgeFade <= 0 || data.PadFade <= 0 || data.MaxGrade <= 0 || data.MaxGrade > .5 ||
		len(data.Hills) > 32 || len(data.Pads) > 64 {
		return nil, fmt.Errorf("invalid world elevation definition")
	}
	f := &worldElevationField{Bounds: b,
		Columns: int(math.Ceil((b.MaxX - b.MinX) / data.Spacing)),
		Rows:    int(math.Ceil((b.MaxZ - b.MinZ) / data.Spacing)),
	}
	f.StepX, f.StepZ = (b.MaxX-b.MinX)/float64(f.Columns), (b.MaxZ-b.MinZ)/float64(f.Rows)
	f.heights = make([]float64, (f.Columns+1)*(f.Rows+1))
	for _, hill := range data.Hills {
		if !finiteCoordinate(hill.X) || !finiteCoordinate(hill.Z) || !finiteCoordinate(hill.RadiusX) ||
			!finiteCoordinate(hill.RadiusZ) || !finiteCoordinate(hill.Height) ||
			hill.RadiusX < 32 || hill.RadiusZ < 32 || hill.Height < 0 || hill.Height > 32 {
			return nil, fmt.Errorf("invalid world elevation hill")
		}
	}
	for _, pad := range data.Pads {
		if !finiteCoordinate(pad.X) || !finiteCoordinate(pad.Z) || !finiteCoordinate(pad.Radius) || pad.Radius < 0 {
			return nil, fmt.Errorf("invalid world elevation pad")
		}
	}
	for row := 0; row <= f.Rows; row++ {
		for column := 0; column <= f.Columns; column++ {
			x, z := b.MinX+float64(column)*f.StepX, b.MinZ+float64(row)*f.StepZ
			height := 0.0
			for _, hill := range data.Hills {
				dx, dz := (x-hill.X)/hill.RadiusX, (z-hill.Z)/hill.RadiusZ
				radiusSquared := dx*dx + dz*dz
				if radiusSquared < 1 {
					t := 1 - radiusSquared
					height += hill.Height * t * t * t
				}
			}
			mask := elevationSmooth(math.Min(math.Min(x-b.MinX, b.MaxX-x), math.Min(z-b.MinZ, b.MaxZ-z)) / data.EdgeFade)
			town := data.FlatTown
			townDistance := math.Hypot(math.Max(math.Max(town.MinX-x, 0), x-town.MaxX), math.Max(math.Max(town.MinZ-z, 0), z-town.MaxZ))
			mask *= elevationSmooth(townDistance / data.PadFade)
			for _, pad := range data.Pads {
				mask *= elevationSmooth((math.Hypot(x-pad.X, z-pad.Z) - pad.Radius) / data.PadFade)
			}
			height = math.Round(height*mask*1000) / 1000
			f.heights[row*(f.Columns+1)+column] = height
			f.MaxHeight = math.Max(f.MaxHeight, height)
		}
	}
	for row := 0; row < f.Rows; row++ {
		for column := 0; column < f.Columns; column++ {
			a, b := f.vertexHeight(column, row), f.vertexHeight(column+1, row)
			c, d := f.vertexHeight(column, row+1), f.vertexHeight(column+1, row+1)
			f.MaxGrade = math.Max(f.MaxGrade, math.Max(math.Hypot((b-a)/f.StepX, (c-a)/f.StepZ), math.Hypot((d-c)/f.StepX, (d-b)/f.StepZ)))
		}
	}
	if f.MaxGrade > data.MaxGrade {
		return nil, fmt.Errorf("world elevation grade %f exceeds %f", f.MaxGrade, data.MaxGrade)
	}
	return f, nil
}

func (f *worldElevationField) vertexHeight(column, row int) float64 {
	return f.heights[row*(f.Columns+1)+column]
}

func (f *worldElevationField) sample(x, z float64, instanceID string) float64 {
	bounds := f.Bounds
	if instanceID != "" || !finiteCoordinate(x) || !finiteCoordinate(z) ||
		x < bounds.MinX || x > bounds.MaxX || z < bounds.MinZ || z > bounds.MaxZ {
		return 0
	}
	gx, gz := (x-bounds.MinX)/f.StepX, (z-bounds.MinZ)/f.StepZ
	column, row := min(f.Columns-1, int(math.Floor(gx))), min(f.Rows-1, int(math.Floor(gz)))
	u, v := gx-float64(column), gz-float64(row)
	a, b := f.vertexHeight(column, row), f.vertexHeight(column+1, row)
	c, d := f.vertexHeight(column, row+1), f.vertexHeight(column+1, row+1)
	if u+v <= 1 {
		return a + u*(b-a) + v*(c-a)
	}
	return d + (1-u)*(c-d) + (1-v)*(b-d)
}
