package main

import (
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestCharacterWorkSerializesOneAccountWithoutBlockingAnother(t *testing.T) {
	unlock := lockCharacterWork("work-a")
	entered, finished := make(chan struct{}), make(chan struct{})
	go func() { close(entered); release := lockCharacterWork("work-a"); release(); close(finished) }()
	<-entered
	other := make(chan struct{})
	go func() { release := lockCharacterWork("work-b"); release(); close(other) }()
	select {
	case <-other:
	case <-time.After(time.Second):
		t.Fatal("unrelated character blocked")
	}
	select {
	case <-finished:
		t.Fatal("same account entered before release")
	default:
	}
	unlock()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("queued account did not proceed")
	}
	characterWork.Lock()
	count := len(characterWork.entries)
	characterWork.Unlock()
	if count != 0 {
		t.Fatal("finished account lock leaked")
	}
}

func TestCharacterWorkOrdersConcurrentUpdates(t *testing.T) {
	var group sync.WaitGroup
	count := 0
	for i := 0; i < 100; i++ {
		group.Add(1)
		go func() { defer group.Done(); unlock := lockCharacterWork("counter"); defer unlock(); count++ }()
	}
	group.Wait()
	if count != 100 {
		t.Fatalf("lost updates: %d", count)
	}
}

func TestStaleCleanupCannotDisconnectOrSaveNewOwner(t *testing.T) {
	oldWorld, oldSessions := world, activeSessions
	t.Cleanup(func() { world, activeSessions = oldWorld, oldSessions })
	world = game.NewWorld(nil)
	older := &Client{username: "handoff", playerID: "player-handoff"}
	newer := &Client{username: "handoff", playerID: "player-handoff"}
	activeSessions = map[string]*Client{"handoff": newer}
	entity := &game.Entity{ID: newer.playerID, Type: game.TypePlayer,
		State: "IDLE", Health: 17, Mana: 0, MaxHealth: 100, MaxMana: 100}
	world.AddEntity(entity)
	cleanupClient(older)
	if entity.Disconnected || entity.Health != 17 || entity.Mana != 0 || activeSessions["handoff"] != newer {
		t.Fatal("old cleanup changed newer binding or resources")
	}
	if currentCharacterConnection(older) {
		t.Fatal("stale connection may issue commands")
	}
	newer.retired.Store(true)
	if currentCharacterConnection(newer) {
		t.Fatal("retired connection may issue commands")
	}
}
