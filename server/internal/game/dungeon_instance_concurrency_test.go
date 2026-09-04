package game

import (
	"sync"
	"testing"
	"time"
)

func testDungeonInstance(id string, roomX float64) *DungeonInstance {
	layout := DungeonLayout{Rooms: []DungeonRoom{{X: roomX, Z: 0, Width: 20, Height: 20, Type: "normal"}}}
	return &DungeonInstance{
		ID:                id,
		Layout:            layout,
		Difficulty:        DifficultyNormal,
		RunLevel:          30,
		RoomState:         NewDungeonRoomState(layout),
		PlayerRoomSummary: make(map[string]DungeonRoomSummary),
	}
}

func TestDungeonInstanceLocksAreIsolated(t *testing.T) {
	w := NewWorld(nil)
	instanceA := testDungeonInstance("dungeon-a", 0)
	instanceB := testDungeonInstance("dungeon-b", 100)
	w.storeDungeonInstance(instanceA.ID, instanceA)
	w.storeDungeonInstance(instanceB.ID, instanceB)

	instanceA.Mu.Lock()
	defer instanceA.Mu.Unlock()

	otherDone := make(chan struct{})
	go func() {
		defer close(otherDone)
		if _, ok := w.GetInstanceLayout(instanceB.ID); !ok {
			t.Errorf("expected second instance layout")
		}
	}()

	select {
	case <-otherDone:
	case <-time.After(time.Second):
		t.Fatal("an unrelated instance lock blocked the second dungeon")
	}

	started := make(chan struct{})
	lockedDone := make(chan struct{})
	go func() {
		close(started)
		_, _ = w.GetInstanceLayout(instanceA.ID)
		close(lockedDone)
	}()
	<-started
	select {
	case <-lockedDone:
		t.Fatal("instance getter did not honor the instance read lock")
	case <-time.After(25 * time.Millisecond):
	}

	instanceA.Mu.Unlock()
	select {
	case <-lockedDone:
	case <-time.After(time.Second):
		t.Fatal("instance getter remained blocked after unlock")
	}
	instanceA.Mu.Lock()
}

func TestDungeonRoomProgressUpdatesConcurrentlyAcrossInstances(t *testing.T) {
	w := NewWorld(nil)
	instanceA := testDungeonInstance("dungeon-a", 0)
	instanceB := testDungeonInstance("dungeon-b", 100)
	w.storeDungeonInstance(instanceA.ID, instanceA)
	w.storeDungeonInstance(instanceB.ID, instanceB)
	w.AddEntity(&Entity{ID: "player-a", Type: TypePlayer, InstanceID: instanceA.ID})
	w.AddEntity(&Entity{ID: "player-b", Type: TypePlayer, InstanceID: instanceB.ID})

	var workers sync.WaitGroup
	for i := 0; i < 50; i++ {
		workers.Add(2)
		go func() {
			defer workers.Done()
			w.UpdateDungeonRoomProgress("player-a", 0, 0)
		}()
		go func() {
			defer workers.Done()
			w.UpdateDungeonRoomProgress("player-b", 100, 0)
		}()
	}
	workers.Wait()

	for _, playerID := range []string{"player-a", "player-b"} {
		summary, ok := w.GetDungeonRoomSummary(map[string]string{"player-a": instanceA.ID, "player-b": instanceB.ID}[playerID], playerID)
		if !ok || len(summary.Rooms) != 1 || !summary.Rooms[0].Explored {
			t.Fatalf("expected explored summary for %s, got %+v", playerID, summary)
		}
	}
}
