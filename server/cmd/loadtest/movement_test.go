package main

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func TestBotMovementUsesReportedSpeedAndRequiresKnownContext(t *testing.T) {
	me := Entity{X: 0, Y: 8, Z: 200, Speed: 5, Health: 100}
	x, z, valid := movementDestination(me, 3, 204)
	if !valid || math.Abs(x-.6) > 1e-9 || math.Abs(z-200.8) > 1e-9 {
		t.Fatal("distant target was not limited to one tick of reported speed")
	}
	for _, bad := range []Entity{{Health: 100}, {Speed: 5}, {Speed: 5, Health: 100, State: "DEAD"}, {Speed: math.NaN(), Health: 100}, {X: math.Inf(1), Speed: 5, Health: 100}, {X: math.MaxFloat64, Speed: 5, Health: 100}} {
		if _, _, ok := movementDestination(bad, 1, 201); ok {
			t.Fatal("unavailable/invalid actor moved")
		}
	}
	movement := &botMovement{}
	if movement.move(nil, me, 1, 201) || movement.respawn(nil) {
		t.Fatal("missing authority context was replaced by a made-up context")
	}
	for _, invalid := range []string{`{}`, `{"movementContext":null}`, `{"movementContext":42}`, `{"movementContext":"` + strings.Repeat("x", 1025) + `"}`} {
		if movement.updateContext(json.RawMessage(invalid)) {
			t.Fatal("invalid context accepted")
		}
	}
	if !movement.updateContext(json.RawMessage(`{"movementContext":""}`)) {
		t.Fatal("valid empty initial context refused")
	}
	movement.observeSequence(math.MaxUint64)
	if movement.move(nil, me, 1, 201) {
		t.Fatal("sequence exhaustion wrapped to zero")
	}
}

func TestBotRecoveryRequiresEchoAndFreshTownStateWithinBound(t *testing.T) {
	now := time.Unix(100, 0)
	for _, scenario := range []string{"echo-only", "state-before-echo", "dead", "instance", "away", "wrong-type", "complete"} {
		t.Run(scenario, func(t *testing.T) {
			movement := &botMovement{recovery: "new-private-nonce", awaitingTown: true, recoveryAt: now, requested: 1}
			me := Entity{Type: "Player", Health: 100, X: -1.25, Z: 200}
			if scenario == "state-before-echo" {
				movement.observePlayer(me)
				if movement.counts().completed != 0 {
					t.Fatal("state without nonce echo acknowledged recovery")
				}
			}
			if !movement.updateContext(json.RawMessage(`{"movementContext":"new-private-nonce"}`)) {
				t.Fatal("matching echo refused")
			}
			switch scenario {
			case "dead":
				me.Health = 0
			case "instance":
				me.InstanceID = "dungeon-synthetic"
			case "away":
				me.X = 50
			case "wrong-type":
				me.Type = "Enemy"
			}
			if scenario != "echo-only" && scenario != "state-before-echo" {
				movement.observePlayer(me)
			}
			if scenario == "complete" {
				movement.observePlayer(me) // Repeated fresh town states cannot double-count.
				if movement.expire(now.Add(5*time.Second), time.Second) || movement.counts().completed != 1 || movement.counts().pending {
					t.Fatal("complete recovery repeated or timed out")
				}
			} else {
				if movement.expire(now.Add(999*time.Millisecond), time.Second) || !movement.expire(now.Add(time.Second), time.Second) || movement.counts().completed != 0 || !movement.counts().pending || movement.move(nil, me, 0, 200) || movement.respawn(nil) {
					t.Fatal("incomplete recovery did not fail at the declared bound without retry/move")
				}
			}
		})
	}
}

func TestBotRecoveryTimeoutKeepsFirstFixedFailureStage(t *testing.T) {
	now := time.Unix(100, 0)
	for _, echoed := range []bool{false, true} {
		movement := &botMovement{recovery: "private-nonce", awaitingTown: true, recoveryAt: now, requested: 1}
		want := failureRecoveryEchoTimeout
		if echoed {
			if !movement.updateContext(json.RawMessage(`{"movementContext":"private-nonce"}`)) {
				t.Fatal("matching acknowledgement refused")
			}
			want = failureRecoveryTownStateTimeout
		}
		if movement.expire(now.Add(999*time.Millisecond), time.Second) || movement.failure() != failureUnknown {
			t.Fatal("diagnostic invented a failure before the original deadline")
		}
		if !movement.expire(now.Add(time.Second), time.Second) || movement.failure() != want {
			t.Fatal("recovery timeout lost the failed acknowledgement stage")
		}
		movement.updateContext(json.RawMessage(`{"movementContext":"private-nonce"}`))
		movement.observePlayer(Entity{Type: "Player", Health: 100, X: -1.25, Z: 200})
		movement.expire(now.Add(2*time.Second), time.Second)
		if movement.failure() != want || movement.counts().completed != 0 || !movement.counts().failed {
			t.Fatal("late acknowledgement replaced or waived the original failure")
		}
		p := &partyLoad{}
		p.rejectAt(movement.failure())
		p.reject() // Later generic cleanup must not replace the recorded cause.
		code := "recovery_echo_timeout"
		if echoed {
			code = "recovery_town_state_timeout"
		}
		if p.failureCode() != code {
			t.Fatal("party controller lost the fixed recovery stage")
		}
	}
}

func TestBotRecoveryTimeoutRetainsOnlyFreshFixedTownBlocker(t *testing.T) {
	now := time.Unix(100, 0)
	for _, scenario := range []string{"dead", "zero-health", "away", "nan", "instance", "invalid", "before-echo"} {
		t.Run(scenario, func(t *testing.T) {
			movement := &botMovement{recovery: "private-nonce", awaitingTown: true, recoveryAt: now, requested: 1}
			me := Entity{Type: "Player", X: -1.25, Z: 200, Health: 100}
			want := failureRecoveryTownStateTimeout
			switch scenario {
			case "dead":
				me.State, want = "DEAD", failureRecoveryTownDead
			case "zero-health":
				me.Health, want = 0, failureRecoveryTownDead
			case "away":
				me.X, want = 400, failureRecoveryOutsideTown
			case "nan":
				me.X, want = math.NaN(), failureRecoveryOutsideTown
			case "instance":
				me.InstanceID, want = "private-scene", failureRecoveryWrongScene
			case "invalid":
				me.Type = "Enemy"
			}
			if scenario == "before-echo" {
				me.State = "DEAD"
				movement.observePlayer(me)
			}
			movement.updateContext(json.RawMessage(`{"movementContext":"private-nonce"}`))
			if scenario != "before-echo" {
				movement.observePlayer(me)
			}
			if !movement.expire(now.Add(time.Second), time.Second) || movement.failure() != want || movement.counts().completed != 0 {
				t.Fatal("timeout lost its fresh blocker or credited an invalid recovery")
			}
			movement.observePlayer(Entity{Type: "Player", X: -1.25, Z: 200, Health: 100})
			if movement.failure() != want || movement.counts().completed != 0 {
				t.Fatal("late town state replaced or waived original failure")
			}
		})
	}
}

func TestBotMovementActualWirePassesGameAuthorityAndRotatesRecoveryContext(t *testing.T) {
	upgrader := websocket.Upgrader{}
	packets := make(chan Message, 8)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Error("fixture upgrade failed")
			return
		}
		defer connection.Close()
		_ = connection.SetReadDeadline(time.Now().Add(2 * time.Second))
		for {
			var message Message
			if connection.ReadJSON(&message) != nil {
				return
			}
			packets <- message
		}
	}))
	defer server.Close()
	connection, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal("fixture connection failed")
	}
	defer connection.Close()
	defer writeLocks.Delete(connection)
	world := game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	player := &game.Entity{ID: "synthetic-movement", Type: game.TypePlayer, X: 0, Z: 200, Speed: 5, Health: 100, MaxHealth: 100, MovementContext: "synthetic-first", RecoveryContextReady: true}
	world.AddEntity(player)
	movement := &botMovement{}
	if !movement.updateContext(json.RawMessage(`{"movementContext":"synthetic-first"}`)) {
		t.Fatal("initial context missing")
	}
	read := func() Message {
		select {
		case message := <-packets:
			return message
		case <-time.After(time.Second):
			t.Fatal("wire request missing")
		}
		return Message{}
	}
	apply := func(message Message, wantedContext string, wantedSequence uint64) {
		var payload struct {
			X, Y, Z, Rotation      float64
			State, MovementContext string
			Sequence               uint64
		}
		if message.Type != "move" || json.Unmarshal(message.Payload, &payload) != nil || payload.MovementContext != wantedContext || payload.Sequence != wantedSequence ||
			!world.UpdatePlayerMovementWithContext(player.ID, payload.X, payload.Y, payload.Z, payload.Rotation, payload.State, payload.Sequence, payload.MovementContext) {
			t.Fatal("driver's actual wire packet did not pass normal game movement authority")
		}
	}
	me := Entity{X: 0, Z: 200, Speed: 5, Health: 100}
	if !movement.move(connection, me, 10, 200) {
		t.Fatal("initial move not sent")
	}
	apply(read(), "synthetic-first", 1)
	if player.X != 1 {
		t.Fatal("first valid packet did not move the real game entity")
	}
	player.Mu.Lock()
	player.MovementContext, player.LastMoveSequence = "synthetic-recovery", 10
	player.Mu.Unlock()
	if world.UpdatePlayerMovementWithContext(player.ID, 2, 0, 200, 0, "MOVING", 11, "synthetic-first") {
		t.Fatal("old recovery context passed normal authority")
	}
	movement.updateContext(json.RawMessage(`{"movementContext":"synthetic-recovery"}`))
	movement.observeSequence(10)
	movement.observeSequence(2) // A delayed acknowledgement cannot regress the sequence.
	me.X = 1
	if !movement.move(connection, me, 10, 200) {
		t.Fatal("recovery move not sent")
	}
	apply(read(), "synthetic-recovery", 11)
	if player.X != 2 {
		t.Fatal("new-context packet did not move the real game entity")
	}
	if !movement.respawn(connection) {
		t.Fatal("context-bound recovery not sent")
	}
	message := read()
	var payload struct{ MovementContext string }
	if message.Type != "respawn" || json.Unmarshal(message.Payload, &payload) != nil || payload.MovementContext == "synthetic-recovery" || len(payload.MovementContext) != 32 {
		t.Fatal("respawn did not propose a bounded fresh recovery nonce")
	}
	if err := world.PerformRespawn(player.ID, "synthetic-recovery"); err == nil {
		t.Fatal("fixture did not exercise the old nonce rejection")
	}
	if err := world.PerformRespawn(player.ID, payload.MovementContext); err != nil {
		t.Fatal("actual respawn wire request failed normal game authority")
	}
	if player.InstanceID != "" || player.Health != player.MaxHealth || player.MovementContext != payload.MovementContext {
		t.Fatal("normal recovery did not return the real entity to town with new authority")
	}
	if movement.move(connection, me, 10, 200) || movement.respawn(connection) {
		t.Fatal("unacknowledged recovery moved or was retried")
	}
	if movement.updateContext(json.RawMessage(`{"movementContext":"synthetic-recovery"}`)) {
		t.Fatal("stale acknowledgement enabled post-recovery movement")
	}
	acknowledged, _ := json.Marshal(map[string]string{"movementContext": player.MovementContext})
	if !movement.updateContext(acknowledged) {
		t.Fatal("normal server echo did not acknowledge fresh recovery")
	}
	if world.UpdatePlayerMovementWithContext(player.ID, 2, 0, 200, 0, "MOVING", 12, "synthetic-recovery") {
		t.Fatal("old-context movement remained valid after real recovery")
	}
	me.X, me.Z = player.X, player.Z
	me.Type = "Player"
	movement.observePlayer(me)
	if got := movement.counts(); got.requested != 1 || got.completed != 1 || got.pending || got.failed {
		t.Fatal("fresh nonce echo and actual town state did not complete recovery")
	}
	movement.observeSequence(player.LastMoveSequence)
	if !movement.move(connection, me, 10, 200) {
		t.Fatal("acknowledged recovery did not resume normal bounded movement")
	}
	apply(read(), payload.MovementContext, 12)
	if math.Abs(player.X-(me.X+1)) > 1e-9 {
		t.Fatal("fresh-context recovery movement did not advance at normal speed")
	}
	// A later recovery must rotate again, not reuse the first successful nonce.
	if !movement.respawn(connection) {
		t.Fatal("subsequent recovery request missing")
	}
	var next struct{ MovementContext string }
	message = read()
	if json.Unmarshal(message.Payload, &next) != nil || next.MovementContext == payload.MovementContext || len(next.MovementContext) != 32 || world.PerformRespawn(player.ID, next.MovementContext) != nil {
		t.Fatal("subsequent recovery did not rotate accepted authority")
	}
}
