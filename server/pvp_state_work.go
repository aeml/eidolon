package main

import "eidolon-server/internal/game"

// Death callbacks may still own combat/world locks. Request a fresh private
// snapshot after those locks release, without retaining old match snapshots or
// creating one goroutine per update. Initial admission remains synchronous.
func queuePvPMatchState(match *game.PvPMatch) {
	if match == nil {
		return
	}
	seen := make(map[string]bool, len(match.TeamA)+len(match.TeamB))
	for _, team := range [][]string{match.TeamA, match.TeamB} {
		for _, playerID := range team {
			if playerID == "" || seen[playerID] {
				continue
			}
			seen[playerID] = true
			if client := getClientByPlayerID(playerID); client != nil {
				client.queuePvPState()
			}
		}
	}
}

func (c *Client) queuePvPState() bool {
	if c == nil || c.username == "" || c.boundPlayerID() == "" || c.retired.Load() || c.transportClosed.Load() {
		return false
	}
	c.pvpStateMu.Lock()
	defer c.pvpStateMu.Unlock()
	c.pvpStatePending = true
	if c.pvpStateRunning {
		return true
	}
	c.pvpStateRunning = true
	if !scheduleClientCharacterWork(c, c.runPendingPvPState) {
		c.pvpStateRunning = false
		return false
	}
	return true
}

func (c *Client) runPendingPvPState() {
	for {
		c.pvpStateMu.Lock()
		if !c.pvpStatePending {
			c.pvpStateRunning = false
			c.pvpStateMu.Unlock()
			return
		}
		c.pvpStatePending = false
		c.pvpStateMu.Unlock()
		unlock := lockCharacterWork(c.username)
		if world != nil && currentCharacterConnection(c) && !c.transportClosed.Load() {
			sendPvPState(c)
		}
		unlock()
	}
}
