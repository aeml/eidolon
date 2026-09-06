package game

import (
	"strings"
	"testing"
	"time"
)

// Membership/progress fixtures, not evidence of a player-controlled wipe.
func TestDungeonTownExitUpdatesPresenceWithoutResettingProgress(t *testing.T) {
	for _, action := range []string{"recall", "respawn"} {
		t.Run(action, func(t *testing.T) {
			w := newTestWorld()
			id := w.CreateDungeon("exit-presence-party", "verdant_bastion_catacombs", DifficultyNormal, 30)
			instance, _ := w.getDungeonInstance(id)
			players := []*Entity{newTestPlayer("exit-first", "Fighter"), newTestPlayer("exit-second", "Cleric")}
			for _, player := range players {
				w.AddEntity(player)
				if err := w.EnterInstance(player.ID, id); err != nil {
					t.Fatal(err)
				}
			}
			instance.Mu.Lock()
			instance.RoomState.Rooms[1].Cleared = true
			instance.Mu.Unlock()
			exit := w.PerformRecall
			if action == "respawn" {
				exit = w.PerformRespawn
			}
			if err := exit(players[0].ID); err != nil {
				t.Fatal(err)
			}
			if !instance.EmptySince.IsZero() || players[1].InstanceID != id {
				t.Fatal("one member leaving invalidated the remaining member's run")
			}
			if err := exit(players[1].ID); err != nil {
				t.Fatal(err)
			}
			if instance.EmptySince.IsZero() {
				t.Fatal("the last town exit failed to start the empty-instance grace period")
			}
			if active, remaining := w.GetDungeonStatus("exit-presence-party"); !active || remaining <= 0 || remaining > 300 {
				t.Fatalf("portal did not expose the real return window: active=%v remaining=%v", active, remaining)
			}
			if !instance.RoomState.Rooms[1].Cleared {
				t.Fatal("town exit reset encounter progress")
			}
			if err := w.EnterInstance(players[0].ID, id); err != nil {
				t.Fatal(err)
			}
			if !instance.EmptySince.IsZero() || !instance.RoomState.Rooms[1].Cleared {
				t.Fatal("re-entry failed to reactivate the existing run with its progress")
			}
		})
	}
}

func TestTownExitReleasesActorBeforeWaitingForInstance(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("exit-lock-player", "Fighter")
	w.AddEntity(p)
	id := w.CreateDungeon("exit-lock-party", "verdant_bastion_catacombs", DifficultyNormal, 30)
	if err := w.EnterInstance(p.ID, id); err != nil {
		t.Fatal(err)
	}
	instance, _ := w.getDungeonInstance(id)
	instance.Mu.Lock()
	done := make(chan error, 1)
	go func() { done <- w.PerformRecall(p.ID) }()
	defer func() {
		instance.Mu.Unlock()
		select {
		case err := <-done:
			if err != nil {
				t.Error(err)
			}
		case <-time.After(2 * time.Second):
			t.Error("town exit did not finish after instance lock release")
		}
	}()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if p.Mu.TryRLock() {
			left := p.InstanceID == ""
			p.Mu.RUnlock()
			if left {
				return
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("town exit retained the actor lock while waiting to update instance presence")
}

func TestDeadRecallRequiresRespawnWithoutCreatingZeroHealthIdlePlayer(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("dead-recall", "Fighter")
	p.InstanceID, p.X, p.Z, p.State, p.Health = "dungeon_death", 20000, 20000, "DEAD", 0
	w.AddEntity(p)
	if err := w.PerformRecall(p.ID); err == nil || !strings.Contains(strings.ToLower(err.Error()), "respawn") {
		t.Fatalf("dead recall needs actionable respawn guidance, got %v", err)
	}
	if p.InstanceID != "dungeon_death" || p.State != "DEAD" || p.Health != 0 || p.X != 20000 || p.Z != 20000 {
		t.Fatal("rejected recall changed the dead character's state or location")
	}
	if err := w.PerformRespawn(p.ID); err != nil {
		t.Fatal(err)
	}
	if p.State != "IDLE" || p.InstanceID != "" || p.Health != p.MaxHealth || p.X != -1.25 || p.Z != 200 {
		t.Fatal("explicit respawn did not restore a living character in Lanternhold")
	}
}
