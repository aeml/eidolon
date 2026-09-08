package game

import (
	"fmt"
	"math"
	"strings"
	"sync"
)

type SafeZone struct {
	ID, Name, InstanceID   string
	MinX, MaxX, MinZ, MaxZ float64
}

var initialSafeZones = []SafeZone{
	{ID: "lanternhold", Name: "Lanternhold", MinX: -100, MaxX: 100, MinZ: 100, MaxZ: 300},
}

// Separate locking lets callers query zones while holding World/Entity locks.
// Registration never acquires either of those locks or calls back into gameplay.
type SafeZoneRegistry struct {
	mu    sync.RWMutex
	zones []SafeZone
}

func NewSafeZoneRegistry() *SafeZoneRegistry {
	return &SafeZoneRegistry{zones: append([]SafeZone(nil), initialSafeZones...)}
}

func finiteCoordinate(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func (r *SafeZoneRegistry) Register(zone SafeZone) error {
	if r == nil || strings.TrimSpace(zone.ID) == "" || zone.MinX >= zone.MaxX || zone.MinZ >= zone.MaxZ ||
		!finiteCoordinate(zone.MinX) || !finiteCoordinate(zone.MaxX) || !finiteCoordinate(zone.MinZ) || !finiteCoordinate(zone.MaxZ) {
		return fmt.Errorf("invalid safe zone")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, existing := range r.zones {
		if existing.ID == zone.ID {
			return fmt.Errorf("safe zone %q already registered", zone.ID)
		}
	}
	r.zones = append(r.zones, zone)
	return nil
}

func safeZoneAt(zones []SafeZone, instanceID string, x, z float64) string {
	if !finiteCoordinate(x) || !finiteCoordinate(z) {
		return ""
	}
	for _, zone := range zones {
		if zone.InstanceID == instanceID && x >= zone.MinX && x <= zone.MaxX && z >= zone.MinZ && z <= zone.MaxZ {
			return zone.ID
		}
	}
	return ""
}

func (w *World) SafeZoneAt(instanceID string, x, z float64) string {
	if w == nil || w.SafeZones == nil {
		return safeZoneAt(initialSafeZones, instanceID, x, z)
	}
	w.SafeZones.mu.RLock()
	defer w.SafeZones.mu.RUnlock()
	return safeZoneAt(w.SafeZones.zones, instanceID, x, z)
}

// Entity must be a detached snapshot or locked by the caller.
func (w *World) inSafeZone(entity *Entity) bool {
	return entity != nil && w.SafeZoneAt(entity.InstanceID, entity.X, entity.Z) != ""
}
