package game

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestConcurrentDungeonRoomClearReservesRewardOnce(t *testing.T) {
	w := NewWorld(nil)
	id := w.CreateDungeon("room-once-party", "verdant_bastion_catacombs", DifficultyNormal, 30)
	player := newTestPlayer("room-once-player", "Fighter")
	w.AddEntity(player)
	if err := w.EnterInstance(player.ID, id); err != nil {
		t.Fatal(err)
	}
	instance, _ := w.getDungeonInstance(id)
	instance.Mu.Lock()
	instance.Layout.Rooms[1].Type = "normal"
	instance.Layout.Rooms[1].Hook = ""
	instance.Mu.Unlock()
	goldBefore := player.Gold
	var events atomic.Int32
	w.OnEvent = func(kind string, _ interface{}) {
		if kind == "room_clear_reward" {
			events.Add(1)
		}
	}
	var workers sync.WaitGroup
	for i := 0; i < 32; i++ {
		workers.Add(1)
		go func() { defer workers.Done(); w.MarkDungeonRoomCleared(id, 1) }()
	}
	workers.Wait()
	if events.Load() != 1 || player.Gold-goldBefore != 90 {
		t.Fatalf("duplicate/missing room rewards: events=%d gold=%d", events.Load(), player.Gold-goldBefore)
	}
}

func TestDungeonRoomRewardDoesNotBlockBossMovementGeometry(t *testing.T) {
	w := NewWorld(nil)
	id := w.CreateDungeon("room-lock-party", "verdant_bastion_catacombs", DifficultyNormal, 30)
	instance, _ := w.getDungeonInstance(id)
	var boss *Entity
	for _, entity := range w.Entities {
		if entity.InstanceID == id && entity.SubType == "RootboundWarden" {
			boss = entity
			break
		}
	}
	if boss == nil {
		t.Fatal("first Verdant boss did not spawn")
	}
	// AI owns the actor lock while querying the instance's walking geometry.
	// A room reward must not hold the instance lock while waiting for this actor.
	boss.Mu.Lock()
	done := make(chan struct{})
	go func() {
		w.MarkDungeonRoomCleared(id, 1)
		close(done)
	}()
	defer func() {
		boss.Mu.Unlock()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Error("room clear did not finish after actor release")
		}
	}()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if instance.Mu.TryRLock() {
			cleared := instance.RoomState.Rooms[1].Cleared
			instance.Mu.RUnlock()
			if cleared {
				if _, _, ok := w.constrainDungeonTargetPosition(boss, boss.X, boss.Z); !ok {
					t.Fatal("boss lost its dungeon walking geometry")
				}
				return
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("room reward holds the instance lock while waiting for a boss; AI cannot read its movement geometry")
}
