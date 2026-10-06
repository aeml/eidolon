package main

import (
	"sync"
	"testing"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func TestStateDeltaFrameConcurrentEntriesKeepFalseAndDifferentBaselines(t *testing.T) {
	actor := &game.Entity{ID: "delta-frame-subject", Type: game.TypePlayer, Health: 100, MaxHealth: 100}
	matching := entityToSnapshot(actor)
	older := *matching
	older.Health = 50
	frame := &stateDeltaFrame{}
	var workers sync.WaitGroup
	snapshots := make([]*EntitySnapshot, 32)
	for index := range snapshots {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for range 20 {
				if frame.changed(actor, matching) || !frame.changed(actor, &older) {
					t.Error("comparison borrowed another baseline or lost cached false")
				}
				snapshots[index] = frame.snapshot(actor)
			}
		}()
	}
	workers.Wait()
	if len(frame.entries) != 1 || len(frame.entries[actor].changes) != 2 {
		t.Fatal("frame retained more than one actor/two declared baselines")
	}
	for _, snapshot := range snapshots {
		if snapshot != snapshots[0] || snapshot.Health != 100 {
			t.Fatal("parallel observers did not share immutable delta history")
		}
	}
	actor.Mu.Lock()
	actor.Health = 25
	actor.Mu.Unlock()
	// The first frame has finished. A new frame must observe the actor afresh,
	// not reuse a cached comparison or mutate anybody's previous history.
	next := &stateDeltaFrame{}
	if !next.changed(actor, matching) || next.snapshot(actor).Health != 25 || next.snapshot(actor) == snapshots[0] || snapshots[0].Health != 100 {
		t.Fatal("cache escaped its frame or rewrote an earlier history")
	}
}

func TestBroadcastDeltaFrameSharesHistoryButHonorsDifferentClientBaselines(t *testing.T) {
	previousWorld, previousSessions := world, activeSessions
	world = game.NewWorld(nil)
	world.Entities = make(map[string]*game.Entity)
	world.Grid = game.NewSpatialMap(50)
	activeSessions = make(map[string]*Client)
	t.Cleanup(func() {
		world.StopBackground()
		world, activeSessions = previousWorld, previousSessions
	})
	for _, id := range []string{"subject", "observer-a", "observer-b", "observer-c"} {
		world.AddEntity(&game.Entity{ID: id, Type: game.TypePlayer, Health: 100, MaxHealth: 100})
		client := newAutoStatusClient(id)
		client.prioritySend = make(chan []byte, 32)
		activeSessions[id] = client
	}
	read := func(client *Client) *statepb.StateEnvelope {
		t.Helper()
		if len(client.send) != 1 {
			t.Fatal("missing one actual queued state frame")
		}
		data := <-client.send
		if len(data) < 5 || string(data[:4]) != string(stateProtoMagic) {
			t.Fatal("missing protobuf frame")
		}
		var envelope statepb.StateEnvelope
		if err := proto.Unmarshal(data[5:], &envelope); err != nil {
			t.Fatal(err)
		}
		return &envelope
	}
	broadcastState()
	first := activeSessions["subject"].lastState["subject"]
	for _, client := range activeSessions {
		if read(client).GetFull() == nil || client.lastState["subject"] != first {
			t.Fatal("detached actor delta history was rebuilt for each observer")
		}
	}
	actor := world.GetEntity("subject")
	actor.Mu.Lock()
	actor.Health = 75
	actor.Mu.Unlock()
	broadcastState()
	current := activeSessions["subject"].lastState["subject"]
	for _, client := range activeSessions {
		packet := read(client).GetDelta()
		found := false
		for _, entity := range packet.GetEntities() {
			found = found || entity.Id == "subject" && entity.Health == 75
		}
		if !found || client.lastState["subject"] != current || current == first || first.Health != 100 {
			t.Fatal("next broadcast lost current changes or rewrote an earlier history")
		}
	}
	// One transport has an older baseline; another needs a full sync. Neither
	// can borrow the unchanged outcome of a caught-up observer.
	stale := *current
	stale.Health = 1
	activeSessions["observer-a"].lastState["subject"] = &stale
	activeSessions["observer-b"].resetSnapshotHistory()
	broadcastState()
	for id, client := range activeSessions {
		packet := read(client)
		if id == "observer-b" {
			if packet.GetFull() == nil {
				t.Fatal("reset recipient did not get full sync")
			}
			continue
		}
		found := false
		for _, entity := range packet.GetDelta().GetEntities() {
			found = found || entity.Id == "subject" && entity.Health == 75
		}
		if id == "observer-c" {
			if found {
				t.Fatal("unchanged subject was needlessly sent to caught-up observer")
			}
			continue
		}
		if !found {
			t.Fatal("own or stale-baseline recipient lost its current actor")
		}
	}
}
