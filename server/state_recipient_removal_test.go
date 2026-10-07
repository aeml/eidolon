package main

import (
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestStateBroadcastRemovalsUseCurrentRecipientMembership(t *testing.T) {
	previousWorld, previousSessions := world, activeSessions
	world = game.NewWorld(nil)
	world.Entities, world.Grid = map[string]*game.Entity{}, game.NewSpatialMap(50)
	t.Cleanup(func() {
		world.StopBackground()
		world, activeSessions = previousWorld, previousSessions
	})
	self := &game.Entity{ID: "removal-viewer", Type: game.TypePlayer, Health: 100}
	near := &game.Entity{ID: "removal-subject", Type: game.TypeEnemy, X: 10, Health: 100}
	world.AddEntity(self)
	world.AddEntity(near)
	client := newAutoStatusClient(self.ID)
	client.prioritySend = make(chan []byte, 32)
	activeSessions = map[string]*Client{self.ID: client}
	read := func() *statepb.StateEnvelope {
		t.Helper()
		if len(client.send) != 1 {
			t.Fatal("missing one real queued state frame")
		}
		data := <-client.send
		if len(data) < 5 || string(data[:4]) != string(stateProtoMagic) {
			t.Fatal("missing production protobuf envelope")
		}
		var envelope statepb.StateEnvelope
		if err := proto.Unmarshal(data[5:], &envelope); err != nil {
			t.Fatal(err)
		}
		return &envelope
	}
	broadcastState()
	if read().GetFull() == nil || !client.seenIDs[near.ID] {
		t.Fatal("initial near actor was not published")
	}
	// The entity still exists in the world, but not in this recipient's view.
	world.Mu.Lock()
	near.Mu.Lock()
	oldX, oldZ := near.X, near.Z
	near.X = stateBroadcastRadius + 100
	world.Grid.Update(near, oldX, oldZ)
	near.Mu.Unlock()
	world.Mu.Unlock()
	broadcastState()
	delta := read().GetDelta()
	if delta == nil || len(delta.RemovedIds) != 1 || delta.RemovedIds[0] != near.ID || client.seenIDs[near.ID] || client.lastState[near.ID] != nil {
		t.Fatal("out-of-view actor retained history or missing actual wire removal")
	}
	// Already-removed IDs must not keep generating removals. Self stays present.
	broadcastState()
	envelope := read()
	if len(envelope.GetDelta().GetRemovedIds()) != 0 || !client.seenIDs[self.ID] {
		t.Fatal("repeated removal or lost owner visibility")
	}
}
