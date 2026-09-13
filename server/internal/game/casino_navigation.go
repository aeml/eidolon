package game

import "math"

// The casino alone has stacked floors. Walking is swept in short segments so a
// large movement packet cannot cross a stair rail or walk out an upstairs wall.
func inCasinoVenue(x, z float64) bool {
	return x >= -14 && x <= 14 && z >= 161 && z <= 179
}

func constrainCasinoWalk(oldX, oldY, oldZ, x, z float64) (float64, float64, float64) {
	if !finiteCoordinate(x) || !finiteCoordinate(z) {
		return oldX, oldY, oldZ
	}
	if !inCasinoVenue(oldX, oldZ) && !inCasinoVenue(x, z) {
		return x, 0, z
	}
	px, py, pz := oldX, oldY, oldZ
	if !inCasinoVenue(oldX, oldZ) {
		py = 0
	}
	steps := max(1, int(math.Ceil(math.Hypot(x-oldX, z-oldZ)/0.25)))
	if steps > 800 { // Never turn malformed coordinates into an unbounded loop.
		return oldX, oldY, oldZ
	}
	for i := 1; i <= steps; i++ {
		nx, nz := oldX+(x-oldX)*float64(i)/float64(steps), oldZ+(z-oldZ)*float64(i)/float64(steps)
		ny := 0.0
		ramp := nx >= 9.2 && nx <= 11.8 && nz > 164 && nz < 176
		onRamp := px >= 9.2 && px <= 11.8 && pz > 164 && pz < 176 && py > 0 && py < 6
		if onRamp {
			if ramp {
				ny = (176 - nz) / 2
			} else if nx >= 9.2 && nx <= 11.8 && nz >= 176 && nz <= 177.1 {
				ny = 0
			} else if nx >= 9.2 && nx <= 11.8 && nz <= 164 && nz >= 162.9 {
				ny = 6
			} else {
				break
			}
		} else if py >= 5.99 {
			if nx < -12.1 || nx > 11.8 || nz < 162.9 || nz > 177.1 {
				break
			}
			ny = 6
			if nx > 8.5 && nz > 164 {
				if ramp && pz <= 164 {
					ny = (176 - nz) / 2
				} else {
					break
				}
			}
		} else if ramp {
			if pz < 176 {
				break
			}
			ny = (176 - nz) / 2
		}
		px, py, pz = nx, ny, nz
	}
	return px, py, pz
}
