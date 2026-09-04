package game

import (
	"math"
	"strings"
)

func (w *World) isDungeonInstance(instanceID string) bool {
	return strings.HasPrefix(instanceID, "dungeon_")
}

func (w *World) constrainPointToDungeon(instanceID string, x, z float64) (float64, float64, bool) {
	if !w.isDungeonInstance(instanceID) {
		return x, z, false
	}

	inst, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return x, z, false
	}
	inst.Mu.RLock()
	defer inst.Mu.RUnlock()
	if len(inst.Layout.WalkRects) == 0 {
		return x, z, false
	}

	bestX := x
	bestZ := z
	bestDistSq := math.Inf(1)
	found := false

	for _, rect := range inst.Layout.WalkRects {
		minX := rect.X - rect.Width/2
		maxX := rect.X + rect.Width/2
		minZ := rect.Z - rect.Height/2
		maxZ := rect.Z + rect.Height/2

		clampedX := math.Max(minX, math.Min(maxX, x))
		clampedZ := math.Max(minZ, math.Min(maxZ, z))
		dx := x - clampedX
		dz := z - clampedZ
		distSq := dx*dx + dz*dz
		if distSq < bestDistSq {
			bestDistSq = distSq
			bestX = clampedX
			bestZ = clampedZ
			found = true
		}
	}

	if !found {
		return x, z, false
	}
	return bestX, bestZ, true
}

func (w *World) constrainPlayerPointToDungeon(instanceID string, x, z float64) (float64, float64, bool) {
	return w.constrainPointToDungeon(instanceID, x, z)
}

func (w *World) constrainDungeonTargetPosition(entity *Entity, x, z float64) (float64, float64, bool) {
	if entity == nil {
		return x, z, false
	}
	return w.constrainPointToDungeon(entity.InstanceID, x, z)
}

func (w *World) moveEntityWithinDungeon(entity *Entity, targetX, targetZ float64) bool {
	if entity == nil {
		return false
	}
	constrainedX, constrainedZ, ok := w.constrainDungeonTargetPosition(entity, targetX, targetZ)
	if !ok {
		return false
	}
	oldX, oldZ := entity.X, entity.Z
	entity.X = constrainedX
	entity.Z = constrainedZ
	w.Grid.Update(entity, oldX, oldZ)
	return true
}
