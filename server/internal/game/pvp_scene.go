package game

// The existing arena constrains player centers to +/-24 by +/-16. Include the
// standard 1.25-unit footprint so client floor containment has those same limits.
func (w *World) pvpArenaLayout(instanceID string) (DungeonLayout, bool) {
	if w.PvP == nil || instanceID == "" {
		return DungeonLayout{}, false
	}
	w.PvP.mu.RLock()
	exists := w.PvP.Matches[instanceID] != nil
	w.PvP.mu.RUnlock()
	if !exists {
		return DungeonLayout{}, false
	}
	return DungeonLayout{
		Rooms:     []DungeonRoom{{Width: 50.5, Height: 34.5, Type: "start"}},
		WalkRects: []DungeonWalkRect{{Width: 50.5, Height: 34.5, Kind: "room"}},
	}, true
}
