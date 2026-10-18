package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

// Observe the real tracked timer, retaining the original ordered effect
// assertions in the caller. No production deadline override or timer retry.
func waitForCastEffects(t *testing.T, client *Client, terminalType string) []Message {
	t.Helper()
	timer := time.NewTimer(6 * time.Second)
	defer timer.Stop()
	var effects []Message
	completed := false
	for {
		select {
		case raw := <-client.send:
			var message Message
			if err := json.Unmarshal(raw, &message); err != nil {
				t.Fatal(err)
			}
			if message.Type == "interaction_cast" {
				var cast struct {
					State string `json:"state"`
				}
				if err := json.Unmarshal(message.Payload, &cast); err != nil {
					t.Fatal(err)
				}
				if cast.State == "cancelled" {
					t.Fatal("cast unexpectedly cancelled")
				}
				completed = completed || cast.State == "completed"
				continue
			}
			effects = append(effects, message)
			if message.Type == terminalType {
				if !completed {
					t.Fatal("effect preceded completed cast")
				}
				return effects
			}
			if message.Type == MsgError {
				t.Fatalf("cast error: %s", message.Payload)
			}
		case <-timer.C:
			t.Fatal("cast effects did not arrive")
			return nil
		}
	}
}

func TestRecallDispatchWaitsThreeSecondsAndMovementCancels(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("cast-dispatch")
	player := newAutoStatusPlayer(client.playerID, "Recovery", "available")
	player.Health, player.MaxHealth, player.X, player.Z = 100, 100, 300, 200
	world.AddEntity(player)
	started := time.Now()
	client.handleMessage(Message{Type: MsgRecall, Payload: json.RawMessage(`{"movementContext":"cast-context"}`)})
	if got := world.GetEntityCopy(player.ID); got.X != 300 || got.MovementContext != "" {
		t.Fatal("request teleported immediately")
	}
	waitForCastEffects(t, client, MsgMovementContext)
	if time.Since(started) < game.StationaryCastDuration {
		t.Fatal("cast completed before deadline")
	}
	if got := world.GetEntityCopy(player.ID); got.X != -1.25 || got.MovementContext != "cast-context" {
		t.Fatal("cast failed arrival")
	}

	client.handleMessage(Message{Type: MsgRecall, Payload: json.RawMessage(`{"movementContext":"cancelled-context"}`)})
	client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":0,"z":200,"state":"MOVING","sequence":1,"movementContext":"cast-context"}`)})
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	for {
		select {
		case raw := <-client.send:
			var message Message
			_ = json.Unmarshal(raw, &message)
			if message.Type != "interaction_cast" {
				t.Fatalf("unexpected effect: %s", raw)
			}
			var cast struct {
				State string `json:"state"`
			}
			_ = json.Unmarshal(message.Payload, &cast)
			if cast.State == "completed" {
				t.Fatal("moved cast completed")
			}
			if cast.State == "cancelled" {
				if got := world.GetEntityCopy(player.ID); got.MovementContext != "cast-context" || got.X != 0 {
					t.Fatal("cancellation changed movement")
				}
				return
			}
		case <-timer.C:
			t.Fatal("movement did not promptly cancel cast")
			return
		}
	}
}
