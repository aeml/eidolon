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
			return 0, 0, 104
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
	approachZ := 100.0
	if !finiteCoordinate(p.X) || !finiteCoordinate(p.Z) || math.Hypot(p.X, p.Z-approachZ) > 7 {
		return errors.New("approach the casino stairs first")
	}
	oldX, oldZ := p.X, p.Z
	resetSceneMovementLocked(p)
	p.CasinoVIPFloor = upstairs
	p.X, p.Y, p.Z = 0, 0, 104
	if upstairs {
		p.Y = 8
	}
	p.State = "IDLE"
	p.TargetX, p.TargetZ = p.X, p.Z
	setRecoveryMovementContextLocked(p, fmt.Sprintf("casino-floor:%d:%t", now.UnixNano(), upstairs))
	if w.Grid != nil {
		w.Grid.Update(p, oldX, oldZ)
	}
	return nil
}

// Both floors have the same complete footprint. Floor membership remains
// server-owned; the client displays exactly one floor at a time.
func constrainCasinoVIPInterior(x, z, oldX, oldZ float64) (float64, float64) {
	return constrainCasinoInterior(x, z)
}

// Shared footprint only; ChangeCasinoFloor owns authorization and floor height.
func constrainCasinoInterior(x, z float64) (float64, float64) {
	x = math.Max(-54, math.Min(54, x))
	z = math.Max(98, math.Min(206, z))
	return x, z
}
