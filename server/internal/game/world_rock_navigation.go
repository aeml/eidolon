package game

import (
	"math"
	"time"
)

func (w *World) rockLineBlocked(instanceID string, start, end rockPoint) bool {
	if instanceID != "" || len(w.rockSolids) == 0 {
		return false
	}
	_, _, hit := firstRockHit(w.rockSolids, start, end, 0)
	return hit
}

// A small visibility graph around nearby outcrops. Offset-plane intersections
// supply corners with body clearance; corners buried in another shoulder are
// discarded. Edges always test the whole union, not just the nearest rock.
func rockNavigationPath(solids []worldRockSolid, start, goal rockPoint, radius float64) []rockPoint {
	nodes := []rockPoint{start, goal}
	for _, solid := range solids {
		for i, a := range solid.Planes {
			b := solid.Planes[(i+1)%len(solid.Planes)]
			det := a.X*b.Z - a.Z*b.X
			if math.Abs(det) < 1e-9 {
				continue
			}
			al, bl := a.Limit+radius+.02, b.Limit+radius+.02
			p := rockPoint{(al*b.Z - a.Z*bl) / det, (a.X*bl - al*b.X) / det}
			if p.X < math.Min(start.X, goal.X)-64 || p.X > math.Max(start.X, goal.X)+64 ||
				p.Z < math.Min(start.Z, goal.Z)-64 || p.Z > math.Max(start.Z, goal.Z)+64 ||
				insideRockSolids(solids, p, radius+.005) {
				continue
			}
			nodes = append(nodes, p)
		}
	}
	distance, parent, visited := make([]float64, len(nodes)), make([]int, len(nodes)), make([]bool, len(nodes))
	for i := range nodes {
		distance[i], parent[i] = math.Inf(1), -1
	}
	distance[0] = 0
	for range nodes {
		current := -1
		for i := range nodes {
			if !visited[i] && (current < 0 || distance[i] < distance[current]) {
				current = i
			}
		}
		if current < 0 || math.IsInf(distance[current], 1) {
			return nil
		}
		if current == 1 {
			var path []rockPoint
			for i := 1; i != 0; i = parent[i] {
				path = append(path, nodes[i])
			}
			for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
				path[i], path[j] = path[j], path[i]
			}
			return path
		}
		visited[current] = true
		for next := range nodes {
			if visited[next] {
				continue
			}
			cost := distance[current] + math.Hypot(nodes[next].X-nodes[current].X, nodes[next].Z-nodes[current].Z)
			if cost >= distance[next] {
				continue
			}
			if _, _, blocked := firstRockHit(solids, nodes[current], nodes[next], radius); !blocked {
				distance[next], parent[next] = cost, current
			}
		}
	}
	return nil
}

// Called with the actor lock held. Reuse a route until its destination moves
// materially, its next segment is obstructed, or body size changes. Unreachable
// destinations retry at most twice a second rather than pathfinding every tick.
func (w *World) rockNavigationTarget(e *Entity, goal rockPoint, now time.Time) rockPoint {
	if e.InstanceID != "" || len(w.rockSolids) == 0 {
		e.rockRoute = nil
		return goal
	}
	radius := e.ReplicatedBodyRadius()
	start := rockPoint{e.X, e.Z}
	goal = recoverRockPosition(w.rockSolids, goal, radius)
	if _, _, blocked := firstRockHit(w.rockSolids, start, goal, radius); !blocked {
		e.rockRoute = nil
		return goal
	}
	changed := math.Hypot(goal.X-e.rockRouteGoal.X, goal.Z-e.rockRouteGoal.Z) > 2 || e.rockRouteRadius != radius
	if len(e.rockRoute) > 0 {
		_, _, blocked := firstRockHit(w.rockSolids, start, e.rockRoute[0], radius)
		changed = changed || blocked
	}
	if changed || (len(e.rockRoute) == 0 && !now.Before(e.rockRouteRetry)) {
		e.rockRoute = rockNavigationPath(w.rockSolids, start, goal, radius)
		e.rockRouteGoal, e.rockRouteRadius = goal, radius
		e.rockRouteRetry = now.Add(500 * time.Millisecond)
	}
	// Skip reached corners only when the next segment is actually clear.
	for len(e.rockRoute) > 1 {
		if _, _, blocked := firstRockHit(w.rockSolids, start, e.rockRoute[1], radius); blocked {
			break
		}
		e.rockRoute = e.rockRoute[1:]
	}
	if len(e.rockRoute) == 0 {
		return start
	}
	return e.rockRoute[0]
}

func (w *World) constrainRockStep(e *Entity, x, z float64) (float64, float64) {
	if e.InstanceID != "" || len(w.rockSolids) == 0 {
		return x, z
	}
	p := moveAroundRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, rockPoint{x, z}, e.ReplicatedBodyRadius())
	return p.X, p.Z
}
