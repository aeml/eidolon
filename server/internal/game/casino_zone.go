package game

import (
	"errors"
	"fmt"
	"math"
	"time"
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
		// Floor access is process-local authorization. A saved upstairs position
		// restores by the public guard; it cannot grant entry after expiry.
		if y > 1 {
			return 0, 0, 153
		}
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
	p.CasinoVIPFloor = false
	p.TargetX, p.TargetZ, p.State = p.X, p.Z, "IDLE"
	resetSceneMovementLocked(p)
	setRecoveryMovementContextLocked(p, "")
	w.Grid.Add(p)
	return nil
}

func (w *World) ChangeCasinoFloor(playerID string, upstairs bool, now time.Time) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return errors.New("player unavailable")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if p.InstanceID != CasinoInstanceID || p.Type != TypePlayer || p.Disconnected || p.Health <= 0 || p.CasinoSeat != nil ||
		p.IsCharging || p.Stunned || p.Rooted || w.TradeByPlayer[playerID] != "" || (p.State != "IDLE" && p.State != "MOVING") {
		return errors.New("finish your current action before taking the stairs")
	}
	if upstairs && !now.Before(p.VIPUntil) {
		return errors.New("You must be a VIP to enter")
	}
	if upstairs == p.CasinoVIPFloor {
		return nil
	}
	approachZ := 150.0
	if !upstairs {
		approachZ = 140
	}
	if !finiteCoordinate(p.X) || !finiteCoordinate(p.Z) || math.Hypot(p.X, p.Z-approachZ) > 7 {
		return errors.New("approach the casino stairs first")
	}
	oldX, oldZ := p.X, p.Z
	resetSceneMovementLocked(p)
	p.CasinoVIPFloor = upstairs
	p.X, p.Y, p.Z = 0, 0, 153
	if upstairs {
		p.Y, p.Z = 8, 140
	}
	p.State = "IDLE"
	p.TargetX, p.TargetZ = p.X, p.Z
	setRecoveryMovementContextLocked(p, fmt.Sprintf("casino-floor:%d:%t", now.UnixNano(), upstairs))
	if w.Grid != nil {
		w.Grid.Update(p, oldX, oldZ)
	}
	return nil
}

// Upper walkable space matches the rear balcony and two side galleries atY8.
// Keep a move on its previous edge instead of teleporting across the atrium.
func constrainCasinoVIPInterior(x, z, oldX, oldZ float64) (float64, float64) {
	x = math.Max(-32, math.Min(32, x))
	z = math.Max(130, math.Min(201, z))
	if z > 141 && math.Abs(x) < 26 {
		if oldZ > 141 {
			x = math.Copysign(26, oldX)
		} else {
			z = 141
		}
	}
	return x, z
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
