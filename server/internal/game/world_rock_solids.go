package game

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
)

// Installed only by the opt-in terrain constructor. Ordinary worlds remain flat
// with no outcrop solids; negotiated terrain profiles prevent mixed clients.
//
//go:embed content/earth-outcrops.json
var earthOutcropJSON []byte

type rockPoint struct{ X, Z float64 }
type rockPlane struct{ X, Z, Limit float64 }
type worldRockSolid struct {
	ID     string
	Planes []rockPlane
}

func readEarthOutcropSolids() ([]worldRockSolid, error) {
	var data struct {
		SchemaVersion int `json:"schemaVersion"`
		Solids        []struct {
			ID      string       `json:"id"`
			Outline [][2]float64 `json:"outline"`
		} `json:"solids"`
	}
	if err := json.Unmarshal(earthOutcropJSON, &data); err != nil {
		return nil, err
	}
	if data.SchemaVersion != 1 || len(data.Solids) == 0 {
		return nil, fmt.Errorf("invalid outcrop manifest")
	}
	result := make([]worldRockSolid, 0, len(data.Solids))
	seen := make(map[string]bool)
	for _, entry := range data.Solids {
		if entry.ID == "" || seen[entry.ID] || len(entry.Outline) < 3 {
			return nil, fmt.Errorf("invalid outcrop %q", entry.ID)
		}
		seen[entry.ID] = true
		solid := worldRockSolid{ID: entry.ID}
		for i, a := range entry.Outline {
			b := entry.Outline[(i+1)%len(entry.Outline)]
			dx, dz := b[0]-a[0], b[1]-a[1]
			length := math.Hypot(dx, dz)
			if !finiteCoordinate(a[0]) || !finiteCoordinate(a[1]) || length < 1e-6 {
				return nil, fmt.Errorf("invalid outcrop edge %q", entry.ID)
			}
			plane := rockPlane{X: dz / length, Z: -dx / length}
			plane.Limit = plane.X*a[0] + plane.Z*a[1]
			for _, point := range entry.Outline {
				if plane.X*point[0]+plane.Z*point[1] > plane.Limit+1e-7 {
					return nil, fmt.Errorf("outcrop must be convex and counterclockwise: %q", entry.ID)
				}
			}
			solid.Planes = append(solid.Planes, plane)
		}
		result = append(result, solid)
	}
	return result, nil
}

func insideRockSolids(solids []worldRockSolid, p rockPoint, radius float64) bool {
	for _, solid := range solids {
		inside := true
		for _, plane := range solid.Planes {
			if plane.X*p.X+plane.Z*p.Z >= plane.Limit+radius-1e-7 {
				inside = false
				break
			}
		}
		if inside {
			return true
		}
	}
	return false
}

// Only used for invalid saved/admission positions, not ordinary walking. Search
// the entire union so escaping one shoulder cannot leave the actor in another.
func recoverRockPosition(solids []worldRockSolid, p rockPoint, radius float64) rockPoint {
	if !insideRockSolids(solids, p, radius) {
		return p
	}
	// Dynamic separation can push a hero only millimetres into a face. Prefer
	// the closest clear projection instead of snapping to a radial search ring.
	best, bestDistance, found := rockPoint{}, 64.0, false
	for _, solid := range solids {
		for _, plane := range solid.Planes {
			step := plane.Limit + radius + .001 - plane.X*p.X - plane.Z*p.Z
			if step <= 0 || step >= bestDistance {
				continue
			}
			candidate := rockPoint{p.X + plane.X*step, p.Z + plane.Z*step}
			if !insideRockSolids(solids, candidate, radius) {
				best, bestDistance, found = candidate, step, true
			}
		}
	}
	if found {
		return best
	}
	for distance := .5; distance <= 64; distance += .5 {
		for direction := 0; direction < 32; direction++ {
			angle := float64(direction) * math.Pi / 16
			candidate := rockPoint{p.X + math.Cos(angle)*distance, p.Z + math.Sin(angle)*distance}
			if !insideRockSolids(solids, candidate, radius+.001) {
				return candidate
			}
		}
	}
	return p
}

// Sweep the complete segment against radius-expanded convex silhouettes.
// Endpoint-only tests permit tunnelling through a shelf into clear ground.
func firstRockHit(solids []worldRockSolid, start, end rockPoint, radius float64) (float64, rockPoint, bool) {
	if insideRockSolids(solids, start, radius) {
		return 0, rockPoint{}, true
	}
	delta := rockPoint{end.X - start.X, end.Z - start.Z}
	first, normal, hit := 1.0, rockPoint{}, false
	for _, solid := range solids {
		enter, leave, outward, valid := 0.0, 1.0, rockPoint{}, true
		for _, plane := range solid.Planes {
			signed := plane.X*start.X + plane.Z*start.Z - plane.Limit - radius
			speed := plane.X*delta.X + plane.Z*delta.Z
			if math.Abs(speed) < 1e-12 {
				if signed > 0 {
					valid = false
					break
				}
				continue
			}
			at := -signed / speed
			if speed < 0 && at >= enter {
				enter = at
				outward = rockPoint{plane.X, plane.Z}
			}
			if speed > 0 {
				leave = math.Min(leave, at)
			}
			if enter > leave {
				valid = false
				break
			}
		}
		if valid && enter >= 0 && enter <= first && leave >= 0 &&
			outward.X*delta.X+outward.Z*delta.Z < -1e-10 {
			first, normal, hit = enter, outward, true
		}
	}
	return first, normal, hit
}

func moveAroundRockSolids(solids []worldRockSolid, start, end rockPoint, radius float64) rockPoint {
	delta := rockPoint{end.X - start.X, end.Z - start.Z}
	p := recoverRockPosition(solids, start, radius)
	for contact := 0; contact < 4; contact++ {
		target := rockPoint{p.X + delta.X, p.Z + delta.Z}
		at, normal, hit := firstRockHit(solids, p, target, radius)
		if !hit {
			return target
		}
		// Back off along the already-clear segment. Pushing along one face's
		// normal could enter an overlapping shoulder at a shared corner.
		travel := math.Max(0, at-.001/math.Hypot(delta.X, delta.Z))
		p.X += delta.X * travel
		p.Z += delta.Z * travel
		delta.X *= 1 - travel
		delta.Z *= 1 - travel
		inward := math.Min(0, delta.X*normal.X+delta.Z*normal.Z)
		delta.X -= normal.X * inward
		delta.Z -= normal.Z * inward
	}
	return p
}

func (w *World) recoverActorFromRocks(e *Entity) {
	if len(w.rockSolids) == 0 || e.InstanceID != "" || (e.Type != TypePlayer && e.Type != TypeEnemy && !(e.Type == TypeNPC && e.SubType == "AvengingSeraph")) {
		return
	}
	radius := e.ReplicatedBodyRadius()
	p := recoverRockPosition(w.rockSolids, rockPoint{e.X, e.Z}, radius)
	e.X, e.Z = p.X, p.Z
}

// Entry/restore callers remove or update the spatial-grid entry after this
// correction. Do not hide XZ changes inside the height-only grounding helper.
func (w *World) recoverWorldEntryLocked(e *Entity) {
	w.recoverActorFromRocks(e)
	w.groundActorAtEntryLocked(e)
	e.rockRoute = nil
	e.TargetX, e.TargetZ = e.X, e.Z
}

func (w *World) clipRockSegment(instanceID string, startX, startZ, endX, endZ float64) (float64, float64, bool) {
	if instanceID != "" || len(w.rockSolids) == 0 {
		return endX, endZ, false
	}
	at, _, hit := firstRockHit(w.rockSolids, rockPoint{startX, startZ}, rockPoint{endX, endZ}, 0)
	if !hit {
		return endX, endZ, false
	}
	return startX + (endX-startX)*at, startZ + (endZ-startZ)*at, true
}

// Dashes/jumps interpolate a straight segment, unlike ordinary sliding walks.
// Keep the destination on that segment so interpolation cannot cut a corner.
func stopAtRockSolids(solids []worldRockSolid, start, end rockPoint, radius float64) rockPoint {
	at, _, hit := firstRockHit(solids, start, end, radius)
	if !hit {
		return end
	}
	dx, dz := end.X-start.X, end.Z-start.Z
	length := math.Hypot(dx, dz)
	if length == 0 {
		return start
	}
	travel := math.Max(0, at-.001/length)
	return rockPoint{start.X + dx*travel, start.Z + dz*travel}
}

func (w *World) stopRockMovement(e *Entity, x, z float64) (float64, float64) {
	if e == nil || e.InstanceID != "" || len(w.rockSolids) == 0 {
		return x, z
	}
	if !finiteCoordinate(x) || !finiteCoordinate(z) {
		return e.X, e.Z
	}
	p := stopAtRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, rockPoint{x, z}, e.ReplicatedBodyRadius())
	return p.X, p.Z
}
