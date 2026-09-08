package game

import (
	"sync"
	"testing"
)

func TestPartyMembershipMutationsDuringCharacterSnapshots(t *testing.T) {
	w := newTestWorld()
	a, b := newTestPlayer("snapshot-a", "Fighter"), newTestPlayer("snapshot-b", "Cleric")
	w.AddEntity(a)
	w.AddEntity(b)
	stop := make(chan struct{})
	var readers sync.WaitGroup
	readers.Add(1)
	go func() {
		defer readers.Done()
		for {
			select {
			case <-stop:
				return
			default:
			}
			w.GetEntityCopy(a.ID)
			w.GetEntityCopy(b.ID)
		}
	}()
	defer func() { close(stop); readers.Wait() }()
	for i := 0; i < 100; i++ {
		party := w.CreateParty(a.ID)
		if party == nil {
			t.Fatal("create party failed")
		}
		if err := w.JoinParty(party.ID, b.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := w.KickPartyMember(a.ID, b.ID); err != nil {
			t.Fatal(err)
		}
		if err := w.RejoinParty(b.ID, party.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := w.LeaveParty(b.ID); err != nil {
			t.Fatal(err)
		}
		if err := w.RejoinOrRestoreParty(b.ID, party.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := w.LeaveParty(b.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := w.LeaveParty(a.ID); err != nil {
			t.Fatal(err)
		}
		if err := w.RejoinOrRestoreParty(a.ID, party.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := w.LeaveParty(a.ID); err != nil {
			t.Fatal(err)
		}
	}
}

func TestEnemyTargetSelectionDuringSceneChanges(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("scene-racer", "Wizard")
	player.X, player.Z = 10000, 10000 // No actual combat while inspecting shared state.
	enemy := &Entity{ID: "scene-observer", Type: TypeEnemy, SubType: "Skeleton", X: 500, Z: 500,
		SpawnX: 500, SpawnZ: 500, State: "IDLE", Health: 100, MaxHealth: 100}
	w.AddEntity(player)
	w.AddEntity(enemy)
	var changes sync.WaitGroup
	changes.Add(1)
	go func() {
		defer changes.Done()
		for i := 0; i < 10000; i++ {
			player.Mu.Lock()
			if i%2 == 0 {
				player.InstanceID = "pvp-switch"
			} else {
				player.InstanceID = ""
			}
			player.Disconnected = i%3 == 0
			player.Mu.Unlock()
		}
	}()
	for i := 0; i < 1000; i++ {
		w.updateEntity(enemy, .001, []*Entity{player}, &deferredActions{})
	}
	changes.Wait()
	w.StopBackground()
}

func TestEnemyTargetSelectionRejectsStaleDisconnectedPlayer(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("stale-target", "Wizard")
	player.X, player.Z, player.Disconnected = 502, 500, true
	enemy := &Entity{ID: "stale-observer", Type: TypeEnemy, SubType: "Skeleton", X: 500, Z: 500,
		SpawnX: 500, SpawnZ: 500, State: "IDLE", Health: 100, MaxHealth: 100}
	w.AddEntity(player)
	w.AddEntity(enemy)
	w.updateEntity(enemy, .033, []*Entity{player}, &deferredActions{})
	w.StopBackground()
	if !enemy.LastAttackTime.IsZero() {
		t.Fatal("stale tick player list allowed a new attack after disconnect")
	}
}
