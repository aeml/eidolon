package main

import (
	"math"
	"sort"

	"eidolon-server/internal/game"
)

type dungeonPoint struct{ x, z float64 }

// Immutable, bounded geometry taken only from the authoritative entry scene.
// Portal-overlap paths keep every straight segment inside canonical floors;
// actual movement still uses the ordinary server speed/context/sequence rules.
type dungeonRoute struct {
	rects []game.DungeonWalkRect
	edges [][]int
}

func newDungeonRoute(layout game.DungeonLayout) (*dungeonRoute, bool) {
	if len(layout.Rooms) < 2 || len(layout.Rooms) > 128 || len(layout.WalkRects) > 512 || len(layout.Corridors) > 256 {
		return nil, false
	}
	for _, rect := range layout.WalkRects {
		for _, value := range []float64{rect.X, rect.Z, rect.Width, rect.Height} {
			if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > math.MaxFloat32 {
				return nil, false
			}
		}
		if rect.Width <= 0 || rect.Height <= 0 {
			return nil, false
		}
	}
	if game.ValidateDungeonLayout(layout) != nil {
		return nil, false
	}
	r := &dungeonRoute{rects: append([]game.DungeonWalkRect(nil), layout.WalkRects...), edges: make([][]int, len(layout.WalkRects))}
	for i := range r.rects {
		for j := i + 1; j < len(r.rects); j++ {
			if _, ok := dungeonPortal(r.rects[i], r.rects[j]); ok {
				r.edges[i], r.edges[j] = append(r.edges[i], j), append(r.edges[j], i)
			}
		}
	}
	return r, true
}

func dungeonPortal(a, b game.DungeonWalkRect) (dungeonPoint, bool) {
	x0, x1 := math.Max(a.X-a.Width/2, b.X-b.Width/2), math.Min(a.X+a.Width/2, b.X+b.Width/2)
	z0, z1 := math.Max(a.Z-a.Height/2, b.Z-b.Height/2), math.Min(a.Z+a.Height/2, b.Z+b.Height/2)
	return dungeonPoint{(x0 + x1) / 2, (z0 + z1) / 2}, x1-x0 > .01 && z1-z0 > .01
}

func dungeonContains(rect game.DungeonWalkRect, p dungeonPoint) bool {
	return math.Abs(p.x-rect.X) <= rect.Width/2 && math.Abs(p.z-rect.Z) <= rect.Height/2
}

// Slab clipping plus interval union proves the complete segment, not just its
// endpoints. L-shaped hallways cannot become wall-cutting diagonal shortcuts.
func (r *dungeonRoute) direct(from, to dungeonPoint) bool {
	for _, v := range []float64{from.x, from.z, to.x, to.z} {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return false
		}
	}
	intervals := make([][2]float64, 0, len(r.rects))
	for _, rect := range r.rects {
		lo, hi, valid := 0.0, 1.0, true
		for _, axis := range [][4]float64{{from.x, to.x - from.x, rect.X - rect.Width/2, rect.X + rect.Width/2}, {from.z, to.z - from.z, rect.Z - rect.Height/2, rect.Z + rect.Height/2}} {
			if axis[1] == 0 {
				valid = valid && axis[0] >= axis[2] && axis[0] <= axis[3]
				continue
			}
			a, b := (axis[2]-axis[0])/axis[1], (axis[3]-axis[0])/axis[1]
			if a > b {
				a, b = b, a
			}
			lo, hi = math.Max(lo, a), math.Min(hi, b)
		}
		if valid && lo <= hi {
			intervals = append(intervals, [2]float64{lo, hi})
		}
	}
	sort.Slice(intervals, func(i, j int) bool { return intervals[i][0] < intervals[j][0] })
	covered := 0.0
	for _, interval := range intervals {
		if interval[0] > covered+1e-12 {
			return false
		}
		covered = math.Max(covered, interval[1])
		if covered >= 1 {
			return true
		}
	}
	return false
}

func (r *dungeonRoute) next(from, to dungeonPoint) (dungeonPoint, bool) {
	if r.direct(from, to) {
		return to, true
	}
	parent := make([]int, len(r.rects))
	queue := make([]int, 0, len(parent))
	for i, rect := range r.rects {
		parent[i] = -2
		if dungeonContains(rect, from) {
			parent[i] = -1
			queue = append(queue, i)
		}
	}
	for head := 0; head < len(queue); head++ {
		i := queue[head]
		if dungeonContains(r.rects[i], to) {
			for parent[i] >= 0 && parent[parent[i]] >= 0 {
				i = parent[i]
			}
			if parent[i] < 0 {
				return to, r.direct(from, to)
			}
			point, ok := dungeonPortal(r.rects[parent[i]], r.rects[i])
			return point, ok && r.direct(from, point)
		}
		for _, next := range r.edges[i] {
			if parent[next] == -2 {
				parent[next] = i
				queue = append(queue, next)
			}
		}
	}
	return dungeonPoint{}, false
}
