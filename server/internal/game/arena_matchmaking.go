package game

import (
	"math"
	"time"
)

type arenaAvailability struct {
	Available    bool
	PartyID      string
	PartyLeader  string
	PartyMembers []string
}

// World.Mu is held. Read actors before PvP.mu, matching combat's lock order.
func (w *World) arenaAvailabilityLocked() map[string]arenaAvailability {
	availability := make(map[string]arenaAvailability)
	for id, player := range w.Entities {
		if player.Type != TypePlayer {
			continue
		}
		player.Mu.RLock()
		state := arenaAvailability{Available: !player.Disconnected && player.InstanceID == "" && player.State != "DEAD" && player.Health > 0, PartyID: player.PartyID}
		player.Mu.RUnlock()
		if party := w.Parties[state.PartyID]; party != nil {
			_, state.PartyLeader, state.PartyMembers = party.GetSnapshot()
		}
		availability[id] = state
	}
	return availability
}

func arenaRatingWindow(queuedAt, now time.Time) int {
	return min(500, 100+max(0, int(now.Sub(queuedAt)/(30*time.Second)))*50)
}

func (system *PvPSystem) arenaTeamRatingLocked(players []string) int {
	total := 0
	for _, id := range players {
		profile, exists := system.Profiles[id]
		if exists {
			total += profile.Rating
		} else {
			total += 1000
		}
	}
	return total / max(1, len(players))
}

func (system *PvPSystem) validArenaEntryLocked(entry arenaQueueEntry, availability map[string]arenaAvailability, now time.Time) bool {
	for _, id := range entry.Players {
		state := availability[id]
		if !state.Available || system.MatchByPlayer[id] != "" || now.Before(system.DeserterUntil[id]) {
			return false
		}
		if len(entry.Players) == 2 {
			if state.PartyID != entry.PartyID || state.PartyLeader != entry.LeaderID || len(state.PartyMembers) != 2 {
				return false
			}
			for _, member := range state.PartyMembers {
				if !containsPlayer(entry.Players, member) {
					return false
				}
			}
		}
	}
	return true
}

// Prefer the oldest eligible team, then its closest eligible rating opponent.
// Both teams' waiting windows must permit the match. Practice never joins ranked.
func (w *World) matchArenaQueueLocked(size int, now time.Time, availability map[string]arenaAvailability) *PvPMatch {
	system := w.PvP
	queue := system.Queues[size]
	valid := queue[:0]
	for _, entry := range queue {
		if system.validArenaEntryLocked(entry, availability, now) {
			valid = append(valid, entry)
		}
	}
	system.Queues[size] = valid
	for first := 0; first < len(valid); first++ {
		best, gap := -1, math.MaxInt
		for second := first + 1; second < len(valid); second++ {
			a, b := valid[first], valid[second]
			if a.Practice != b.Practice {
				continue
			}
			allies := false
			for _, id := range a.Players {
				for _, other := range b.Players {
					if id == other || (availability[id].PartyID != "" && availability[id].PartyID == availability[other].PartyID) {
						allies = true
					}
				}
			}
			if allies {
				continue
			}
			difference := int(math.Abs(float64(system.arenaTeamRatingLocked(a.Players) - system.arenaTeamRatingLocked(b.Players))))
			if !a.Practice && difference > min(arenaRatingWindow(a.QueuedAt, now), arenaRatingWindow(b.QueuedAt, now)) {
				continue
			}
			if difference < gap {
				best, gap = second, difference
			}
		}
		if best < 0 {
			continue
		}
		a, b := valid[first], valid[best]
		remaining := make([]arenaQueueEntry, 0, len(valid)-2)
		for index, entry := range valid {
			if index != first && index != best {
				remaining = append(remaining, entry)
			}
		}
		system.Queues[size] = remaining
		mode := PvPModeArena1v1
		if size == 2 {
			mode = PvPModeArena2v2
		}
		match := w.startPvPMatchLocked(mode, a.Players, b.Players)
		system.Matches[match.ID].Practice = a.Practice
		match.Practice = a.Practice
		return match
	}
	return nil
}

func (w *World) updateArenaQueues(now time.Time) {
	w.PvP.mu.Lock()
	if now.Before(w.PvP.nextMatchmaking) || (len(w.PvP.Queues[1]) == 0 && len(w.PvP.Queues[2]) == 0) {
		w.PvP.mu.Unlock()
		return
	}
	w.PvP.nextMatchmaking = now.Add(time.Second)
	w.PvP.mu.Unlock()
	w.Mu.Lock()
	availability := w.arenaAvailabilityLocked()
	w.PvP.mu.Lock()
	var matches []*PvPMatch
	for _, size := range []int{1, 2} {
		for {
			match := w.matchArenaQueueLocked(size, now, availability)
			if match == nil {
				break
			}
			matches = append(matches, match)
		}
	}
	w.PvP.mu.Unlock()
	w.Mu.Unlock()
	for _, match := range matches {
		if w.OnPvPMatchStart != nil {
			w.OnPvPMatchStart(match)
		}
	}
}
