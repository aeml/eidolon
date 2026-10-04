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

func TestBotMovementActualWirePassesGameAuthorityAndRotatesRecoveryContext(t *testing.T) {
	upgrader := websocket.Upgrader{}
	packets := make(chan Message, 3)
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
	if message.Type != "respawn" || json.Unmarshal(message.Payload, &payload) != nil || payload.MovementContext != "synthetic-recovery" {
		t.Fatal("respawn omitted current authority context")
	}
}
