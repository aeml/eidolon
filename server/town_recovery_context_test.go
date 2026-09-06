package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestTownRecoveryContextAdmitsFreshMovementAndRejectsDepartedPackets(t *testing.T) {
	for _, action := range []string{MsgRecall, MsgRespawn} {
		t.Run(action, func(t *testing.T) {
			previousWorld := world
			defer func() { world = previousWorld }()
			world = game.NewWorld(nil)
			client := newAutoStatusClient("recovery-context")
			player := newAutoStatusPlayer(client.playerID, "Recovery", "available")
			player.X, player.Z = 120, 200
			player.Health, player.MaxHealth = 100, 100
			world.AddEntity(player)
			world.GenerateDailyQuests(player.ID)
			for i := range player.Quests {
				if player.Quests[i].ID == "chronicle_01_bell_below" {
					player.Quests[i].Accepted, player.Quests[i].Count = true, 3
				}
			}
			client.handleMessage(Message{Type: action, Payload: json.RawMessage(`{"movementContext":"new-recovery"}`)})
			assertRecoveryContextMessage(t, client, "new-recovery")
			client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":80,"z":200,"state":"MOVING","sequence":20,"movementContext":"old-recovery"}`)})
			if got := world.GetEntityCopy(player.ID); got.X != -1.25 || got.Z != 200 {
				t.Fatal("departed-context movement displaced the returned player")
			}
			client.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":17,"z":215,"state":"IDLE","sequence":21,"movementContext":"new-recovery"}`)})
			if got := world.GetEntityCopy(player.ID); got.X != 17 || got.Z != 215 {
				t.Fatalf("fresh movement was rejected after approved %s: (%v,%v)", action, got.X, got.Z)
			}
			client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"chronicle_01_bell_below"}`)})
			if !game.HasCompletedChronicleQuest(player, "chronicle_01_bell_below") {
				t.Fatal("Ilyra rejected a ready quest after accepted town movement")
			}
		})
	}
}

func assertRecoveryContextMessage(t *testing.T, client *Client, expected string) {
	t.Helper()
	for _, message := range drainSentMessages(client.send) {
		if message.Type != MsgMovementContext {
			continue
		}
		var payload TownRecoveryPayload
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.MovementContext != expected {
			t.Fatalf("context acknowledgement = %q, want %q", payload.MovementContext, expected)
		}
		return
	}
	t.Fatal("missing lossless recovery-context acknowledgement")
}

func TestRecoveryContextRejectsInvalidRequestsAndRestoresTransportContext(t *testing.T) {
	previousWorld := world
	defer func() { world = previousWorld }()
	world = game.NewWorld(nil)
	client := newAutoStatusClient("recovery-validation")
	player := newAutoStatusPlayer(client.playerID, "Recovery", "available")
	player.Health, player.MaxHealth = 100, 100
	player.X, player.Z = 10, 200
	world.AddEntity(player)
	for _, action := range []string{MsgRecall, MsgRespawn} {
		for _, payload := range []string{`{"movementContext":23}`, `{"movementContext":"` + strings.Repeat("x", 65) + `"}`} {
			client.handleMessage(Message{Type: action, Payload: json.RawMessage(payload)})
			if got := world.GetEntityCopy(player.ID); got.X != 10 || got.MovementContext != "" {
				t.Fatal("invalid recovery mutated the actor")
			}
			messages := drainSentMessages(client.send)
			if len(messages) != 1 || messages[0].Type != MsgError {
				t.Fatalf("invalid recovery should only return an error: %+v", messages)
			}
		}
	}
	// The same lossless helper is used by fresh join and session resume.
	sendMovementContext(client)
	assertRecoveryContextMessage(t, client, "")
	if err := world.PerformRecall(player.ID, "resumed-context"); err != nil {
		t.Fatal(err)
	}
	resumed := newAutoStatusClient(player.ID)
	sendMovementContext(resumed)
	assertRecoveryContextMessage(t, resumed, "resumed-context")
	if world.StartPlayerJumpWithContext(player.ID, 2, 0, 200, "") {
		t.Fatal("old jump accepted immediately after recovery")
	}
	if !world.StartPlayerJumpWithContext(player.ID, 2, 0, 200, "resumed-context") {
		t.Fatal("fresh jump rejected immediately after recovery")
	}
	player.State, player.Health = "DEAD", 0
	client.handleMessage(Message{Type: MsgRecall, Payload: json.RawMessage(`{"movementContext":"denied-context"}`)})
	if got := world.GetEntityCopy(player.ID); got.MovementContext != "resumed-context" || got.State != "DEAD" {
		t.Fatal("denied dead-player recall replaced the active context")
	}
	for _, message := range drainSentMessages(client.send) {
		if message.Type == MsgMovementContext {
			t.Fatal("denied recall acknowledged a new movement context")
		}
	}
}

func TestRecoveryContextPreservesLegacyAndSubsequentMovementGuards(t *testing.T) {
	w := game.NewWorld(nil)
	p := &game.Entity{ID: "recovery-guards", Type: game.TypePlayer, Health: 100, MaxHealth: 100, State: "IDLE"}
	w.AddEntity(p)
	if err := w.PerformRecall(p.ID); err != nil {
		t.Fatal(err)
	}
	if w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 1, "") {
		t.Fatal("legacy recovery lost its stale-packet window")
	}
	p.LastRespawnTime, p.MoveLockUntil = time.Time{}, time.Time{}
	if !w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 1, "") {
		t.Fatal("legacy movement did not resume after its existing window")
	}
	if err := w.PerformRecall(p.ID, "fresh"); err != nil {
		t.Fatal(err)
	}
	if w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 2, "old") {
		t.Fatal("old context moved a recovered player")
	}
	p.LastRespawnTime = time.Time{}
	if w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 2, "old") {
		t.Fatal("old context became valid after time elapsed")
	}
	p.MoveLockUntil = time.Now().Add(time.Second)
	if w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 2, "fresh") {
		t.Fatal("recovery bypassed a subsequent ability movement lock")
	}
	p.MoveLockUntil = time.Time{}
	if w.UpdatePlayerMovementWithContext(p.ID, 200, 0, 200, 0, "MOVING", 2, "fresh") {
		t.Fatal("recovery bypassed the network discontinuity bound")
	}
	if !w.UpdatePlayerMovementWithContext(p.ID, 2, 0, 200, 0, "MOVING", 2, "fresh") {
		t.Fatal("valid movement rejected")
	}
	if w.UpdatePlayerMovementWithContext(p.ID, 3, 0, 200, 0, "MOVING", 2, "fresh") {
		t.Fatal("stale sequence accepted")
	}
	if err := w.PerformRecall(p.ID, "fresh"); err == nil {
		t.Fatal("replayed recovery context accepted")
	}
	if got := w.GetEntityCopy(p.ID); got.MovementContext != "fresh" || got.X != 2 {
		t.Fatal("rejected recovery changed the movement context or position")
	}
	if w.StartPlayerJumpWithContext(p.ID, 3, 0, 200, "old") {
		t.Fatal("departed jump accepted")
	}
	if !w.StartPlayerJumpWithContext(p.ID, 3, 0, 200, "fresh") {
		t.Fatal("current-context jump rejected")
	}
}
