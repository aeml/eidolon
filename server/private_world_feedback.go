package main

// World callbacks may hold World.Mu or an entity lock. Private presentation
// must not take another world snapshot there or create a goroutine per event.
// Use the current recipient's existing bounded, lossless-priority lane; a slow
// transport is retired by sendSafe rather than accumulating background work.
// Authoritative rewards/saves remain on their existing independent paths.
func sendPrivateWorldFeedback(playerID string, message []byte) bool {
	if playerID == "" || len(message) == 0 {
		return false
	}
	client := getClientByPlayerID(playerID)
	if client == nil || client.retired.Load() || client.transportClosed.Load() {
		return false
	}
	return client.sendSafe(message)
}
