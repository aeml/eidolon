package game

import (
	"errors"
	"math"
)

// A permanent shared social scene, never a party-owned dungeon or raid.
const CasinoInstanceID = "lanternhold-casino"
const CasinoInstanceType = "casino"

// Old saves may be inside what is now the closed town facade. Recover only
// that footprint; preserve inventory, wagers and unrelated town positions.
func RestoreCasinoPosition(instanceID string, x, y, z float64) (float64, float64, float64) {
	if instanceID == "" && x >= -13 && x <= 13 && z >= 162 && z <= 178.5 {
		return 0, 0, 181.5
	}
	if instanceID == CasinoInstanceID {
		if !finiteCoordinate(x) || !finiteCoordinate(z) {
			return 0, 0, 200
		}
		x, z = constrainCasinoInterior(x, z)
		return x, 0, z
	}
	return x, y, z
}

func (w *World) EnterCasino(playerID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return errors.New("player unavailable")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if p.InstanceID == CasinoInstanceID {
		return nil
	}
	if p.InstanceID != "" || p.Health <= 0 || p.State == "DEAD" || p.Disconnected || p.CasinoSeat != nil ||
		p.IsCharging || p.Stunned || p.Rooted || w.TradeByPlayer[playerID] != "" {
		return errors.New("finish your current action before entering the casino")
	}
	if !finiteCoordinate(p.X) || !finiteCoordinate(p.Z) || math.Hypot(p.X, p.Z-180) > 8 {
		return errors.New("approach the casino door in Lanternhold first")
	}
	w.Grid.Remove(p)
	p.InstanceID, p.X, p.Y, p.Z = CasinoInstanceID, 0, 0, 200
	p.TargetX, p.TargetZ, p.State = p.X, p.Z, "IDLE"
	resetSceneMovementLocked(p)
	setRecoveryMovementContextLocked(p, "")
	w.Grid.Add(p)
	return nil
}

// Ground-floor bounds include a solid stair barrier. No client-supplied height
// or jump can grant VIP access while the guard denies entry.
func constrainCasinoInterior(x, z float64) (float64, float64) {
	x = math.Max(-33, math.Min(33, x))
	z = math.Max(130, math.Min(203, z))
	if math.Abs(x) < 6 && z < 148 {
		z = 148
	}
	return x, z
}
