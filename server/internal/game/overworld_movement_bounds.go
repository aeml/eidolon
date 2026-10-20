package game

import "math"

// The playable overworld is a union, not its enclosing rectangle. Shared realm
// edges remain connected; the ocean in the two northern corners is not a floor.
var overworldWalkRects = func() []DungeonWalkRect {
	var rects []DungeonWalkRect
	for _, r := range worldGeography.Regions {
		if r.ID == "town" {
			continue
		}
		rects = append(rects, DungeonWalkRect{X: (r.MinX + r.MaxX) / 2, Z: (r.MinZ + r.MaxZ) / 2, Width: r.MaxX - r.MinX, Height: r.MaxZ - r.MinZ})
	}
	return rects
}()

// Restore inside the fence thickness, rather than trapping a saved player in a post.
func nearestOverworldLand(x, z float64) (float64, float64) {
	cx, cz, _ := constrainPointToWalkRects(overworldWalkRects, x, z)
	if cx == x && cz == z {
		return x, z
	}
	inner := make([]DungeonWalkRect, len(overworldWalkRects))
	for i, r := range overworldWalkRects {
		r.Width -= 5
		r.Height -= 5
		inner[i] = r
	}
	cx, cz, _ = constrainPointToWalkRects(inner, x, z)
	return cx, cz
}

func constrainOverworldMovement(fromX, fromZ, x, z float64) (float64, float64) {
	startX, startZ := nearestOverworldLand(fromX, fromZ)
	// Already-stranded characters target land instead of accepting another
	// ocean destination. Normal join/restore recovery happens before publication.
	if startX != fromX || startZ != fromZ {
		return startX, startZ
	}
	endX, endZ, blocked := firstDungeonWalkRectWallHit(overworldWalkRects, startX, startZ, x, z)
	if blocked {
		distance := math.Hypot(endX-startX, endZ-startZ)
		if distance > 0 {
			fraction := math.Max(0, (distance-.05)/distance)
			endX, endZ = startX+(endX-startX)*fraction, startZ+(endZ-startZ)*fraction
		}
	}
	return endX, endZ
}

func recoverOverworldPlayer(e *Entity) {
	if e.Type != TypePlayer || e.InstanceID != "" {
		return
	}
	x, z := nearestOverworldLand(e.X, e.Z)
	if x == e.X && z == e.Z {
		return
	}
	e.X, e.Z, e.TargetX, e.TargetZ = x, z, x, z
	e.SupportSurface, e.jumpTargetSupport = "", ""
	e.roofFalling, e.roofFallVelocity = false, 0
	if e.State != "DEAD" {
		e.State = "IDLE"
	}
	e.JumpProgress, e.JumpElapsed = 1, 0
}
