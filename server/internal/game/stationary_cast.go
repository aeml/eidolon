package game

import (
	"errors"
	"time"
)

const StationaryCastDuration = 3 * time.Second

// Session-only action ownership. Completion checks and the effect run under
// the same world/entity locks; a delayed callback cannot act after movement.
type stationaryCast struct {
	id                     uint64
	kind, target, instance string
	x, y, z                float64
	readyAt                time.Time
}

func (w *World) BeginStationaryCast(playerID, kind, target string, now time.Time) (uint64, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if kind == "recall" && w.HasPvPMatch(playerID) {
		return 0, errors.New("use Forfeit in Duels & Arena to leave the PvP match before recalling")
	}
	p := w.Entities[playerID]
	if p == nil {
		return 0, errors.New("player unavailable")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if kind == "recall" && (p.State == "DEAD" || p.Health <= 0) {
		return 0, errors.New("use Respawn to recover in Lanternhold before recalling")
	}
	if kind == "recall" && (len(target) > 64 || target != "" && target == p.MovementContext) {
		return 0, errors.New("request a fresh recovery context")
	}
	if p.Type != TypePlayer || p.Health <= 0 || p.Disconnected || p.State == "DEAD" || p.State == "JUMPING" || p.IsCharging || p.Stunned || p.CasinoSeat != nil {
		return 0, errors.New("Stand still before starting this cast")
	}
	if kind != "recall" && kind != "chronicle_inspect" && kind != "quest_pickup" {
		return 0, errors.New("Unknown interaction cast")
	}
	if stationaryCastValidLocked(p, p.stationaryCast.id) {
		return 0, errors.New("Already casting. Move to cancel")
	}
	w.stationaryCastGeneration++
	p.stationaryCast = stationaryCast{id: w.stationaryCastGeneration, kind: kind, target: target, instance: p.InstanceID, x: p.X, y: p.Y, z: p.Z, readyAt: now.Add(StationaryCastDuration)}
	return p.stationaryCast.id, nil
}

func stationaryCastValidLocked(p *Entity, id uint64) bool {
	c := p.stationaryCast
	return id != 0 && c.id == id && p.Health > 0 && !p.Disconnected && p.State != "DEAD" && p.State != "JUMPING" && !p.IsCharging && !p.Stunned && p.CasinoSeat == nil &&
		p.InstanceID == c.instance && p.X == c.x && p.Y == c.y && p.Z == c.z
}

func (w *World) StationaryCastActive(playerID string, id uint64) bool {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	p := w.Entities[playerID]
	if p == nil {
		return false
	}
	p.Mu.RLock()
	defer p.Mu.RUnlock()
	return stationaryCastValidLocked(p, id)
}

func consumeStationaryCastLocked(p *Entity, id uint64, kind, target string, now time.Time) error {
	if !stationaryCastValidLocked(p, id) || p.stationaryCast.kind != kind || p.stationaryCast.target != target {
		return errors.New("Cast cancelled")
	}
	if now.Before(p.stationaryCast.readyAt) {
		return errors.New("Cast is not finished")
	}
	p.stationaryCast = stationaryCast{}
	return nil
}

func cancelStationaryCastLocked(p *Entity) { p.stationaryCast = stationaryCast{} }

func (w *World) CancelStationaryCast(playerID string, id uint64) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	if p := w.Entities[playerID]; p != nil {
		p.Mu.Lock()
		defer p.Mu.Unlock()
		if p.stationaryCast.id == id {
			cancelStationaryCastLocked(p)
		}
	}
}
