package game

import (
	"testing"
	"time"
)

func TestDungeonEntryDoesNotHoldPlayerWhileWaitingForInstance(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("entry-lock-player", "Fighter")
	w.AddEntity(player)
	id := w.CreateDungeon("entry-lock-party", "abyssal_well", DifficultyNormal, 60)
	instance, _ := w.getDungeonInstance(id)
	instance.Mu.Lock()
	done := make(chan error, 1)
	go func() { done <- w.EnterInstance(player.ID, id) }()
	defer func() {
		instance.Mu.Unlock()
		select {
		case err := <-done:
			if err != nil {
				t.Error(err)
			}
		case <-time.After(2 * time.Second):
			t.Error("entry did not finish after the instance lock was released")
		}
	}()
	deadline := time.Now().Add(2 * time.Second)
	for w.Mu.TryRLock() {
		w.Mu.RUnlock()
		if time.Now().After(deadline) {
			t.Fatal("entry did not reach its world critical section")
		}
		time.Sleep(time.Millisecond)
	}
	if !player.Mu.TryLock() {
		t.Fatal("entry holds player lock while waiting for instance, reversing room-reward lock order")
	}
	player.Mu.Unlock()
}

func TestDungeonEntryCancelsDepartedSceneMovement(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("entering-player", "Fighter")
	player.X, player.Y, player.Z = 10, 7, 200
	player.State = "JUMPING"
	player.IsCharging = true
	player.ChargeTargetX, player.ChargeTargetZ = 40, 200
	player.JumpDuration, player.JumpElapsed = 0.6, 0.2
	player.TargetID = "old-enemy"
	w.AddEntity(player)
	id := w.CreateDungeon("entry-party", "abyssal_well", DifficultyNormal, 60)
	if err := w.EnterInstance(player.ID, id); err != nil {
		t.Fatal(err)
	}
	layout, _ := w.GetInstanceLayout(id)
	w.updateEntity(player, 0.05, nil, &deferredActions{})
	if player.X != layout.Rooms[0].X || player.Z != layout.Rooms[0].Z || player.Y != 0 || player.IsCharging || player.JumpDuration != 0 || player.TargetID != "" || player.State != "IDLE" {
		t.Fatalf("departed motion survived entry: position=(%f,%f,%f) state=%s charge=%t jump=%f target=%s", player.X, player.Y, player.Z, player.State, player.IsCharging, player.JumpDuration, player.TargetID)
	}
}

func TestTownRecoveryCancelsOldDungeonForcedMovement(t *testing.T) {
	for _, respawn := range []bool{false, true} {
		w := NewWorld(nil)
		player := newTestPlayer("town-recovery", "Fighter")
		player.InstanceID = "old-dungeon"
		player.X, player.Y, player.Z = 20000, 7, 20000
		player.IsCharging = true
		player.ChargeStartX, player.ChargeStartZ = 20000, 20000
		player.ChargeTargetX, player.ChargeTargetZ = 20030, 20000
		player.JumpDuration, player.JumpElapsed, player.JumpProgress = 0.35, 0.2, 0.5
		player.TargetID = "old-boss"
		w.AddEntity(player)
		if respawn {
			w.PerformRespawn(player.ID)
		} else {
			w.PerformRecall(player.ID)
		}
		w.updateEntity(player, 0.05, nil, &deferredActions{})
		if player.IsCharging || player.JumpDuration != 0 || player.TargetID != "" || player.InstanceID != "" || player.X != -1.25 || player.Y != 0 || player.Z != 200 {
			t.Fatalf("respawn=%t old movement survived town recovery: x=%f y=%f z=%f charging=%t jump=%f target=%s", respawn, player.X, player.Y, player.Z, player.IsCharging, player.JumpDuration, player.TargetID)
		}
	}
}
