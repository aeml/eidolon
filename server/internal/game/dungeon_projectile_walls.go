package game

import (
	"math"
	"sort"
)

type dungeonSegmentInterval struct{ enter, leave float64 }

// firstDungeonWallHit clips the whole travel segment against the union of the
// canonical floors. Testing only its endpoint permits tunnelling across a wall
// into another room during a long frame. Room/corridor overlaps are not walls.
// Overworld/PvP and legacy instances without canonical geometry stay unchanged.
func (w *World) firstDungeonWallHit(instanceID string, fromX, fromZ, toX, toZ float64) (float64, float64, bool) {
	instance, exists := w.getDungeonInstance(instanceID)
	if !exists {
		return toX, toZ, false
	}
	instance.Mu.RLock()
	defer instance.Mu.RUnlock()
	return firstDungeonWalkRectWallHit(instance.Layout.WalkRects, fromX, fromZ, toX, toZ)
}

// Delayed attacks retain their own floor snapshot so impact validation never
// acquires an instance lock while holding an actor lock. Layout changes or
// instance removal cannot mutate this attack's geometry underneath it.
func (w *World) dungeonWalkRectsSnapshot(instanceID string) []DungeonWalkRect {
	instance, exists := w.getDungeonInstance(instanceID)
	if !exists {
		return nil
	}
	instance.Mu.RLock()
	defer instance.Mu.RUnlock()
	return append([]DungeonWalkRect(nil), instance.Layout.WalkRects...)
}

func firstDungeonWalkRectWallHit(rects []DungeonWalkRect, fromX, fromZ, toX, toZ float64) (float64, float64, bool) {
	if len(rects) == 0 {
		return toX, toZ, false
	}
	dx, dz := toX-fromX, toZ-fromZ
	var intervals []dungeonSegmentInterval
	for _, rect := range rects {
		enter, leave, intersects := dungeonRectSegmentInterval(rect, fromX, fromZ, dx, dz)
		if intersects && enter <= 0 && leave >= 1 {
			return toX, toZ, false // Common case: the whole step stays in one convex room.
		}
		if intersects {
			intervals = append(intervals, dungeonSegmentInterval{enter, leave})
		}
	}
	sort.Slice(intervals, func(i, j int) bool { return intervals[i].enter < intervals[j].enter })
	covered := 0.0
	for _, interval := range intervals {
		if interval.enter > covered+1e-10 {
			break
		}
		covered = math.Max(covered, interval.leave)
		if covered >= 1-1e-10 {
			return toX, toZ, false
		}
	}
	return fromX + dx*covered, fromZ + dz*covered, true
}

func dungeonRectSegmentInterval(rect DungeonWalkRect, x, z, dx, dz float64) (float64, float64, bool) {
	enter, leave := 0.0, 1.0
	for _, axis := range [][4]float64{{x, dx, rect.X - rect.Width/2, rect.X + rect.Width/2}, {z, dz, rect.Z - rect.Height/2, rect.Z + rect.Height/2}} {
		position, delta, minimum, maximum := axis[0], axis[1], axis[2], axis[3]
		if math.Abs(delta) < 1e-12 {
			if position < minimum || position > maximum {
				return 0, 0, false
			}
			continue
		}
		near, far := (minimum-position)/delta, (maximum-position)/delta
		if near > far {
			near, far = far, near
		}
		enter, leave = math.Max(enter, near), math.Min(leave, far)
		if enter > leave {
			return 0, 0, false
		}
	}
	return enter, leave, true
}
