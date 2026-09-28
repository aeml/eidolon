package game

import (
	_ "embed"
	"encoding/json"
)

// The registry begins with the town Chronicle route. Regional landmarks are
// added at their population milestones; this does not replace authoritative
// investigation definitions or reveal undiscovered story text.
type WorldLocation struct {
	ID         string  `json:"id"`
	EntityID   string  `json:"entityId"`
	Name       string  `json:"name"`
	Kind       string  `json:"kind"`
	InstanceID string  `json:"instanceId"`
	X          float64 `json:"x"`
	Z          float64 `json:"z"`
}

//go:embed content/world-locations.json
var worldLocationJSON []byte

var worldLocations = func() map[string]WorldLocation {
	var entries []WorldLocation
	if err := json.Unmarshal(worldLocationJSON, &entries); err != nil {
		panic(err)
	}
	result := make(map[string]WorldLocation, len(entries))
	entities := map[string]bool{}
	for _, entry := range entries {
		if _, exists := result[entry.ID]; exists || entry.ID == "" || entry.EntityID == "" || entities[entry.EntityID] || entry.Name == "" || !finiteCoordinate(entry.X) || !finiteCoordinate(entry.Z) {
			panic("invalid world location registry")
		}
		result[entry.ID], entities[entry.EntityID] = entry, true
	}
	return result
}()

func worldLocation(id string) WorldLocation {
	entry, ok := worldLocations[id]
	if !ok {
		panic("missing world location: " + id)
	}
	return entry
}

func (w *World) spawnResonancePortal() {
	p := worldLocation("resonance-portal")
	w.AddEntity(&Entity{ID: p.EntityID, Type: TypeNPC, SubType: "ResonancePortal", Name: p.Name,
		InstanceID: p.InstanceID, X: p.X, Z: p.Z, SpawnX: p.X, SpawnZ: p.Z, State: "IDLE", Scale: 1})
}
