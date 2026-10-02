package main

import (
	"bytes"
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func TestStateBroadcastQueuePressureForcesFullResyncWithoutPhantomVisibility(t *testing.T) {
	for _, initialPublished := range []bool{false, true} {
		name := "initial-drop"
		if initialPublished {
			name = "delta-drop"
		}
		t.Run(name, func(t *testing.T) {
			previousWorld, previousSessions := world, activeSessions
			defer func() { world, activeSessions = previousWorld, previousSessions }()
			world = game.NewWorld(nil)
			world.Entities = make(map[string]*game.Entity)
			world.Grid = game.NewSpatialMap(50)
			player := &game.Entity{ID: "viewer", Type: game.TypePlayer, InstanceID: "party_a", Health: 100}
			world.AddEntity(player)
			world.AddEntity(&game.Entity{ID: "near", Type: game.TypeEnemy, InstanceID: player.InstanceID, X: 100})
			client := newAutoStatusClient(player.ID)
			client.send = make(chan []byte, 1)
			client.prioritySend = make(chan []byte, 16)
			activeSessions = map[string]*Client{player.ID: client}
			if initialPublished {
				broadcastState()
				if len(client.send) != 1 || !client.seenIDs["near"] || client.seenScene != "party_a" {
					t.Fatal("initial snapshot was not queued with its visibility history")
				}
				<-client.send
				player.Mu.Lock()
				player.Health--
				player.Mu.Unlock()
			}
			client.send <- []byte("occupied-state-lane")
			broadcastState()
			if len(client.seenIDs) != 0 || len(client.lastState) != 0 || client.seenScene != "" {
				t.Fatal("rejected snapshot advanced visible actor/delta history")
			}
			if client.observesBroadcastActor(BroadcastMessage{Type: MsgAbility, ActorID: "near", InstanceID: "party_a"}, player.ID) {
				t.Fatal("an unsent actor snapshot granted a visual audience")
			}
			privateProgress := client.lastEndgame
			if privateProgress == nil {
				t.Fatal("fixture did not queue its independent private progress")
			}
			if string(<-client.send) != "occupied-state-lane" {
				t.Fatal("pressure test replaced existing queued traffic")
			}
			broadcastState()
			if len(client.send) != 1 {
				t.Fatal("snapshot recovery did not resume")
			}
			data := <-client.send
			if len(data) < 5 || !bytes.Equal(data[:4], stateProtoMagic) {
				t.Fatal("expected actual production protobuf snapshot")
			}
			var envelope statepb.StateEnvelope
			if err := proto.Unmarshal(data[5:], &envelope); err != nil {
				t.Fatal(err)
			}
			if envelope.GetFull() == nil || len(envelope.GetFull().Entities) != 2 {
				t.Fatal("queue pressure must recover with a full replacement, not an incomplete delta")
			}
			if !client.seenIDs["near"] || client.seenScene != "party_a" || client.lastEndgame != privateProgress {
				t.Fatal("successful resync lost actor visibility or independently queued private progress")
			}
		})
	}
}
