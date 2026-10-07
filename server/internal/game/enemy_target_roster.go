package game

import "sort"

// Preserve the existing active-at-frame-start player roster and its tie order.
// This is only an identity index: all mutable eligibility stays in the live
// target snapshot. The roster is discarded after the workers join each frame.
type enemyTargetRoster struct {
	byID  map[string]*Entity
	order map[*Entity]int
}

func newEnemyTargetRoster(players []*Entity) *enemyTargetRoster {
	roster := &enemyTargetRoster{byID: make(map[string]*Entity, len(players)), order: make(map[*Entity]int, len(players))}
	for index, player := range players {
		if player != nil {
			roster.byID[player.ID], roster.order[player] = player, index
		}
	}
	return roster
}

// Caller owns World.Mu, so scene transfers/world membership cannot change
// during the query/scan. Grid.Mu is released before any actor lock is acquired.
// Coarse cells may overinclude; the original live range, scene, life, stealth,
// safe-zone and pursuit checks remain authoritative. Every positive threat is
// included independently of spatial range, including tiny/distant values.
func (roster *enemyTargetRoster) candidatesLocked(grid *SpatialMap, x, z, sightRange float64, scene string, threat map[string]float64) []*Entity {
	if len(roster.byID) == 0 {
		return nil
	}
	nearby := grid.nearbyType(x, z, sightRange, scene, TypePlayer)
	candidates := nearby[:0]
	for _, player := range nearby {
		if _, present := roster.order[player]; present {
			candidates = append(candidates, player)
		}
	}
	for id, amount := range threat {
		if amount <= 0 {
			continue
		}
		player := roster.byID[id]
		if player == nil {
			continue
		}
		found := false
		for _, candidate := range candidates {
			if candidate == player {
				found = true
				break
			}
		}
		if !found {
			candidates = append(candidates, player)
		}
	}
	// Equal distance/threat keeps the same winner as the original frame list.
	if len(candidates) > 1 {
		sort.Slice(candidates, func(i, j int) bool { return roster.order[candidates[i]] < roster.order[candidates[j]] })
	}
	return candidates
}
