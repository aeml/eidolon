package main

import (
	"encoding/json"
	"time"

	"eidolon-server/internal/game"
)

func (c *Client) sendStationaryCast(id uint64, kind, target, state string) {
	payload, _ := json.Marshal(map[string]interface{}{"id": id, "kind": kind, "target": target, "state": state, "duration": game.StationaryCastDuration.Seconds()})
	c.sendSafe(createMessage("interaction_cast", payload))
}

// The timer owns no account/world locks while waiting. It remains part of the
// connection and shutdown lifecycle, then reacquires character ownership before
// the atomic game effect and its existing durable acknowledgement.
func (c *Client) startStationaryCast(kind, target string, finish func(uint64) error) {
	w := world
	started := time.Now()
	id, err := w.BeginStationaryCast(c.playerID, kind, target, started)
	if err != nil {
		if kind == "recall" && target != "" && len(target) <= 64 {
			c.sendStationaryCast(0, kind, target, "rejected")
		}
		c.sendError(err.Error())
		return
	}
	if !scheduleClientCharacterWork(c, func() {
		defer w.CancelStationaryCast(c.playerID, id)
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for now := range ticker.C {
			if c.transportClosed.Load() || c.retired.Load() {
				return
			}
			if !w.StationaryCastActive(c.playerID, id) {
				c.sendStationaryCast(id, kind, target, "cancelled")
				return
			}
			if now.Before(started.Add(game.StationaryCastDuration)) {
				continue
			}
			unlock, _, err := lockDirectTradeWork(false, c.username)
			if err != nil {
				c.sendStationaryCast(id, kind, target, "cancelled")
				c.sendError(err.Error())
				return
			}
			defer unlock()
			if world != w || !currentCharacterConnection(c) || c.transportClosed.Load() {
				return
			}
			if err := finish(id); err != nil {
				c.sendStationaryCast(id, kind, target, "cancelled")
				c.sendError(err.Error())
			}
			return
		}
	}) {
		w.CancelStationaryCast(c.playerID, id)
		c.sendError("Cast unavailable while the server is shutting down")
		return
	}
	c.sendStationaryCast(id, kind, target, "started")
}
