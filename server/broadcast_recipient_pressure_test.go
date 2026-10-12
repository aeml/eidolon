package main

import (
	"bytes"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestCombatVisualBurstPreservesSocketControlAndStateRecovery(t *testing.T) {
	for _, kind := range []string{MsgAbility, MsgAttack, MsgDamage, MsgHeal, MsgProjectileImpact} {
		t.Run(kind, func(t *testing.T) {
			previousWorld, previousClients, previousSessions := world, clients, activeSessions
			defer func() { world, clients, activeSessions = previousWorld, previousClients, previousSessions }()
			world = &game.World{Entities: make(map[string]*game.Entity), Grid: game.NewSpatialMap(50)}
			client, peer := transportDiagnosticSocket(t)
			client.send = make(chan []byte, 256)
			client.prioritySend = make(chan []byte, 64)
			client.playerID = "pressure-viewer"
			client.lastState = make(map[string]*EntitySnapshot)
			client.seenIDs = make(map[string]bool)
			// This fixture owns both socket endpoints and has no account/store.
			// Keep unrelated asynchronous account cleanup outside the repro.
			client.cleanupOnce.Do(func() {})
			clients, activeSessions = map[*Client]bool{client: true}, map[string]*Client{client.playerID: client}
			player := &game.Entity{ID: client.playerID, Type: game.TypePlayer, Health: 100}
			world.AddEntity(player)
			wire := createMessage(kind, []byte(`{"visual":true}`))
			for i := 0; i < cap(client.send)+32; i++ {
				deliverBroadcast(BroadcastMessage{Type: kind, ActorID: client.playerID, Data: wire,
					Footprint: BroadcastFootprint{Present: true}})
			}
			if !clients[client] || client.transportClosed.Load() || client.transportCloseReason.Load() != 0 {
				t.Fatal("a transient visual burst closed or retired a healthy transport")
			}
			if len(client.send) != cap(client.send) || len(client.prioritySend) != 0 {
				t.Fatal("visual pressure consumed the reserved control lane or bypassed the bounded queue")
			}
			// A full visual/state queue must not advance authoritative delta or
			// actor visibility history. The next available snapshot is a full one.
			broadcastState()
			if len(client.lastState) != 0 || len(client.seenIDs) != 0 {
				t.Fatal("unsent snapshot advanced visibility during visual pressure")
			}
			for len(client.prioritySend) > 0 {
				<-client.prioritySend
			}
			receipt := createMessage(MsgInventory, []byte(`{"receipt":"owned-value"}`))
			if !client.sendSafe(receipt) {
				t.Fatal("visual pressure rejected a private control receipt")
			}
			warning := createMessage(MsgTelegraph, []byte(`{"warning":true}`))
			deliverBroadcast(BroadcastMessage{Type: MsgTelegraph, Data: warning, Footprint: BroadcastFootprint{Present: true}})
			if len(client.prioritySend) != 2 {
				t.Fatal("essential encounter warning lost its reserved lane")
			}
			exited := make(chan struct{})
			go func() { defer close(exited); client.writePumpWithTicks(make(chan time.Time)) }()
			defer func() {
				client.closeSendQueues()
				client.conn.Close()
				select {
				case <-exited:
				case <-time.After(2 * time.Second):
					t.Error("owned writer survived cleanup")
				}
			}()
			peer.SetReadDeadline(time.Now().Add(2 * time.Second))
			for _, expected := range [][]byte{receipt, warning} {
				_, got, err := peer.ReadMessage()
				if err != nil || !bytes.Equal(got, expected) {
					t.Fatalf("control/warning did not precede burst: %v", err)
				}
			}
			for i := 0; i < cap(client.send); i++ {
				_, got, err := peer.ReadMessage()
				if err != nil || !bytes.Equal(got, wire) {
					t.Fatalf("queued visual changed or socket ended: %v", err)
				}
			}
			broadcastState()
			_, snapshot, err := peer.ReadMessage()
			if err != nil || len(snapshot) < 5 || !bytes.Equal(snapshot[:4], stateProtoMagic) {
				t.Fatalf("own authoritative state did not recover after the burst: %v", err)
			}
			var envelope statepb.StateEnvelope
			if proto.Unmarshal(snapshot[5:], &envelope) != nil || envelope.GetFull() == nil || len(envelope.GetFull().Entities) != 1 {
				t.Fatal("burst recovery did not send a complete authoritative replacement")
			}
			if len(client.lastState) != 1 || !client.seenIDs[client.playerID] {
				t.Fatal("recovered snapshot lost self visibility")
			}
		})
	}
}
