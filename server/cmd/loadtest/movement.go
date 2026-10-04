package main

import (
	"encoding/json"
	"math"
	"sync"

	"github.com/gorilla/websocket"
)

// Match the normal client's current recovery context and monotonic input
// ordering. Context is private protocol state, never output in load evidence.
type botMovement struct {
	mu       sync.Mutex
	context  string
	known    bool
	sequence uint64
}

func (m *botMovement) updateContext(payload json.RawMessage) bool {
	var update struct {
		Context *string `json:"movementContext"`
	}
	if json.Unmarshal(payload, &update) != nil || update.Context == nil || len(*update.Context) > 1024 {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.context, m.known = *update.Context, true // Empty initial context is valid, missing is not.
	return true
}

func (m *botMovement) observeSequence(sequence uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sequence > m.sequence {
		m.sequence = sequence
	}
}

func movementDestination(me Entity, x, z float64) (float64, float64, bool) {
	for _, value := range []float64{me.X, me.Y, me.Z, me.Speed, x, z} {
		if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > math.MaxFloat32 {
			return 0, 0, false
		}
	}
	if me.Health <= 0 || me.State == "DEAD" || me.Speed <= 0 {
		return 0, 0, false
	}
	dx, dz := x-me.X, z-me.Z
	distance := math.Hypot(dx, dz)
	// One200ms AI tick of server-reported speed, even for distant loot/targets.
	step := me.Speed * .2
	if distance > step {
		x, z = me.X+dx/distance*step, me.Z+dz/distance*step
	}
	return x, z, true
}

func (m *botMovement) move(connection *websocket.Conn, me Entity, x, z float64) bool {
	x, z, valid := movementDestination(me, x, z)
	if !valid {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.known || m.sequence == math.MaxUint64 {
		return false
	}
	m.sequence++
	// Keep assignment and actual writes ordered across reader/AI callbacks.
	return send(connection, "move", map[string]interface{}{
		"x": x, "y": me.Y, "z": z, "rotation": 0, "state": "MOVING",
		"sequence": m.sequence, "movementContext": m.context,
	}) == nil
}

func (m *botMovement) respawn(connection *websocket.Conn) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.known && send(connection, "respawn", map[string]string{"movementContext": m.context}) == nil
}
