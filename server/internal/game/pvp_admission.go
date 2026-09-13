package game

import (
	"errors"
	"math"
)

// World.Mu is held, PvP.mu is not. Snapshot one actor at a time to avoid
// opposing invitations acquiring two actor locks in different orders.
func (w *World) validateDuelActorsLocked(requesterID, targetID string) error {
	if requesterID == targetID {
		return errors.New("a duel requires two different players")
	}
	var actors [2]struct {
		x, z    float64
		partyID string
	}
	for i, id := range []string{requesterID, targetID} {
		player := w.Entities[id]
		if player == nil {
			return errors.New("duel player is unavailable")
		}
		player.Mu.RLock()
		available := player.Type == TypePlayer && !player.Disconnected && player.InstanceID == "" && player.State != "DEAD" && player.Health > 0
		actors[i].x, actors[i].z, actors[i].partyID = player.X, player.Z, player.PartyID
		player.Mu.RUnlock()
		if !available {
			return errors.New("duel player is unavailable")
		}
	}
	if actors[0].partyID != "" && actors[0].partyID == actors[1].partyID {
		return errors.New("leave the shared party before dueling each other")
	}
	if !finiteCoordinate(actors[0].x) || !finiteCoordinate(actors[0].z) || !finiteCoordinate(actors[1].x) || !finiteCoordinate(actors[1].z) || math.Hypot(actors[0].x-actors[1].x, actors[0].z-actors[1].z) > 15 {
		return errors.New("duels require two nearby players in the overworld")
	}
	return nil
}
