package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"

	"eidolon-server/internal/database"
)

//go:embed content/town-roofs.json
var townRoofJSON []byte

type roofCell struct{ x, z int }
type roofTriangle [9]float64
type roofFamily struct {
	triangles []roofTriangle
	cells     map[roofCell][]int
}
type roofPlacement struct {
	ID       string  `json:"id"`
	Family   string  `json:"family"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Rotation float64 `json:"rotation"`
	cos, sin float64
	mesh     *roofFamily
}
type townRoofField struct {
	placements []roofPlacement
	byID       map[string]int
}

var townRoofs = readTownRoofs()

// Reject an unavailable/changed persisted roof instead of silently publishing
// a retained item on another floor. Legacy operations keep their old projection.
func restoreGroundItemFloor(loot *Entity, op database.GroundItemOperation) error {
	if op.Version != 3 {
		return nil
	}
	id, height, ok := townRoofs.sample(op.X, op.Z, op.SupportSurface)
	if !ok || id != op.SupportSurface || math.Abs(op.Y-height-.5) > 1e-6 {
		return fmt.Errorf("retained ground item roof is unavailable")
	}
	loot.Y, loot.SupportSurface = op.Y, id
	return nil
}

func readTownRoofs() *townRoofField {
	var data struct {
		SchemaVersion int                       `json:"schemaVersion"`
		Families      map[string][]roofTriangle `json:"families"`
		Placements    []roofPlacement           `json:"placements"`
	}
	if err := json.Unmarshal(townRoofJSON, &data); err != nil {
		panic(err)
	}
	if data.SchemaVersion != 1 || len(data.Families) != 5 || len(data.Placements) != 19 {
		panic("invalid town roof catalog")
	}
	families := make(map[string]*roofFamily)
	for id, triangles := range data.Families {
		if len(triangles) == 0 || len(triangles) > 50000 {
			panic("invalid roof triangle count")
		}
		family := &roofFamily{triangles: triangles, cells: make(map[roofCell][]int)}
		for i, t := range triangles {
			for _, v := range t {
				if !finiteCoordinate(v) {
					panic("invalid roof coordinate")
				}
			}
			minX, maxX := math.Min(t[0], math.Min(t[3], t[6])), math.Max(t[0], math.Max(t[3], t[6]))
			minZ, maxZ := math.Min(t[2], math.Min(t[5], t[8])), math.Max(t[2], math.Max(t[5], t[8]))
			if maxX-minX > 100 || maxZ-minZ > 100 {
				panic("invalid roof bounds")
			}
			for x := int(math.Floor(minX / 2)); x <= int(math.Floor(maxX/2)); x++ {
				for z := int(math.Floor(minZ / 2)); z <= int(math.Floor(maxZ/2)); z++ {
					cell := roofCell{x, z}
					family.cells[cell] = append(family.cells[cell], i)
				}
			}
		}
		families[id] = family
	}
	field := &townRoofField{placements: data.Placements, byID: make(map[string]int)}
	for i := range field.placements {
		p := &field.placements[i]
		if p.ID == "" || families[p.Family] == nil || !finiteCoordinate(p.X) || !finiteCoordinate(p.Y) || !finiteCoordinate(p.Z) || !finiteCoordinate(p.Rotation) {
			panic("invalid roof placement")
		}
		if _, exists := field.byID[p.ID]; exists {
			panic(fmt.Sprintf("duplicate roof %s", p.ID))
		}
		p.cos, p.sin = math.Cos(p.Rotation), math.Sin(p.Rotation)
		p.mesh = families[p.Family]
		field.byID[p.ID] = i
	}
	return field
}

func (f *townRoofField) sample(x, z float64, id string) (string, float64, bool) {
	bestID, bestY := "", math.Inf(-1)
	for i := range f.placements {
		p := &f.placements[i]
		if id != "" && p.ID != id {
			continue
		}
		dx, dz := x-p.X, z-p.Z
		lx, lz := p.cos*dx-p.sin*dz, p.sin*dx+p.cos*dz
		for _, index := range p.mesh.cells[roofCell{int(math.Floor(lx / 2)), int(math.Floor(lz / 2))}] {
			t := p.mesh.triangles[index]
			d := (t[5]-t[8])*(t[0]-t[6]) + (t[6]-t[3])*(t[2]-t[8])
			if math.Abs(d) < 1e-6 {
				continue
			}
			a := ((t[5]-t[8])*(lx-t[6]) + (t[6]-t[3])*(lz-t[8])) / d
			b := ((t[8]-t[2])*(lx-t[6]) + (t[0]-t[6])*(lz-t[8])) / d
			c := 1 - a - b
			if a < -1e-6 || b < -1e-6 || c < -1e-6 {
				continue
			}
			y := p.Y + a*t[1] + b*t[4] + c*t[7]
			if y > bestY {
				bestID, bestY = p.ID, y
			}
		}
	}
	return bestID, bestY, bestID != ""
}

// Caller owns the player. Walking over an eave starts a real fall; only the
// authoritative crossing of a lower roof or ground establishes new support.
func (w *World) updateRoofFallLocked(e *Entity, dt float64) {
	if !e.roofFalling || e.InstanceID != "" || e.State == "JUMPING" {
		return
	}
	before := e.Y
	e.roofFallVelocity -= 30 * dt
	after := before + e.roofFallVelocity*dt
	ground, _ := w.overworldGroundHeight("", e.X, e.Z)
	if id, height, ok := townRoofs.sample(e.X, e.Z, ""); ok && height <= before+.001 && after <= height {
		e.SupportSurface = id
		e.Y = height
		e.roofFalling = false
		e.roofFallVelocity = 0
	} else if after <= ground {
		e.Y = ground
		e.roofFalling = false
		e.roofFallVelocity = 0
	} else {
		e.Y = after
	}
	cancelStationaryCastLocked(e)
}
