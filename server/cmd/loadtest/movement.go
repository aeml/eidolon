package main

import (
	"encoding/json"
	"math"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Match the normal client's current recovery context and monotonic input
// ordering. Context is private protocol state, never output in load evidence.
type botMovement struct {
	mu                   sync.Mutex
	context              string
	known                bool
	sequence             uint64
	recovery             string // Pending fresh recovery nonce; never output as evidence.
	awaitingTown         bool
	recoveryAt           time.Time
	requested, completed uint64
	failed               bool
	failureStage         loadFailureStage
}

type recoveryCounts struct {
	requested, completed uint64
	pending, failed      bool
}

func (m *botMovement) counts() recoveryCounts {
	m.mu.Lock()
	defer m.mu.Unlock()
	return recoveryCounts{m.requested, m.completed, m.recovery != "" || m.awaitingTown, m.failed}
}

// The nonce echo alone is not proof that the player actually recovered. Only
// a subsequent fresh own-player town state completes the pending operation.
func (m *botMovement) observePlayer(me Entity) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.failed && m.awaitingTown && m.known && me.Type == "Player" && me.Health > 0 && me.State != "DEAD" && me.InstanceID == "" && math.Hypot(me.X+1.25, me.Z-200) <= 2 {
		m.awaitingTown = false
		m.completed++
	}
}

func (m *botMovement) expire(now time.Time, timeout time.Duration) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.failed && (m.recovery != "" || m.awaitingTown) && now.Sub(m.recoveryAt) >= timeout {
		m.failed = true
		m.failureStage = failureRecoveryTownStateTimeout
		if m.recovery != "" {
			m.failureStage = failureRecoveryEchoTimeout
		}
	}
	return m.failed
}

func (m *botMovement) failure() loadFailureStage {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.failureStage
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
	if m.recovery != "" && *update.Context != m.recovery {
		return false // An old acknowledgement cannot enable post-recovery moves.
	}
	m.context, m.known = *update.Context, true // Empty initial context is valid, missing is not.
	m.recovery = ""
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
	if !m.known || m.awaitingTown || m.failed || m.sequence == math.MaxUint64 {
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
	return m.recover(connection, "respawn")
}

func (m *botMovement) recover(connection *websocket.Conn, kind string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if (kind != "respawn" && kind != "recall") || !m.known || m.recovery != "" || m.awaitingTown || m.failed {
		return false
	}
	context, err := randomHex(16)
	if err != nil || context == m.context {
		return false
	}
	// Like the real client, propose a fresh nonce for recovery. Do not reuse
	// the current movement authority or move again before the server echoes it.
	if send(connection, kind, map[string]string{"movementContext": context}) != nil {
		return false
	}
	m.recovery, m.known = context, false
	m.awaitingTown, m.recoveryAt = true, time.Now()
	m.requested++
	return true
}
