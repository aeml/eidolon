package game

// PlayerBroadcastContext contains only the live position/scene and the owner's
// private Resonance view needed alongside the ordinary replication snapshot.
// It is not a character save or observer DTO; do not broadcast it to peers.
type PlayerBroadcastContext struct {
	X, Z       float64
	InstanceID string
	Progress   EndgameProgress
}

// Same world-before-actor lock order as GetEntityCopy, without copying bags,
// storage, equipped items, loadouts or growing durable operation receipts.
func (w *World) GetPlayerBroadcastContext(id string) (PlayerBroadcastContext, bool) {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	player := w.Entities[id]
	if player == nil {
		return PlayerBroadcastContext{}, false
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	if player.Type != TypePlayer {
		return PlayerBroadcastContext{}, false
	}
	return PlayerBroadcastContext{X: player.X, Z: player.Z, InstanceID: player.InstanceID,
		Progress: player.endgameProgressLocked()}, true
}
