package game

import (
	"sync"
	"testing"
	"time"
)

func TestEnemyTargetSnapshotMembershipAndStealth(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("target", "Wizard")
	p.X, p.Z, p.InstanceID = 42, 73, "air"
	w.AddEntity(p)
	s := w.snapshotEnemyTarget(p)
	if !s.active || s.hidden || s.id != p.ID || s.instanceID != "air" || s.x != 42 || s.z != 73 {
		t.Fatal("target snapshot lost identity or position", s)
	}
	p.StealthActive, p.StealthEndTime = true, time.Now().Add(time.Minute)
	if !w.snapshotEnemyTarget(p).hidden {
		t.Fatal("stealth target exposed")
	}
	p.StealthEndTime = time.Now().Add(-time.Second)
	if w.snapshotEnemyTarget(p).hidden {
		t.Fatal("expired stealth retained")
	}
	p.Disconnected = true
	if w.snapshotEnemyTarget(p).active {
		t.Fatal("disconnected target admitted")
	}
	p.Disconnected, p.State = false, "DEAD"
	if w.snapshotEnemyTarget(p).active {
		t.Fatal("dead target admitted")
	}
	p.State = "IDLE"
	w.Entities[p.ID] = newTestPlayer(p.ID, "Wizard")
	if w.snapshotEnemyTarget(p).active || w.snapshotEnemyTarget(nil).active {
		t.Fatal("stale or missing target admitted")
	}
}

func TestEnemyTargetSnapshotSerializesWorldOwnedCastState(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("caster", "Wizard")
	w.AddEntity(p)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 10000; i++ {
			w.Mu.Lock() // PerformAbility owns this lock, not the actor lock.
			p.State = "ATTACKING"
			p.State = "IDLE"
			w.Mu.Unlock()
		}
	}()
	for i := 0; i < 10000; i++ {
		if !w.snapshotEnemyTarget(p).active {
			t.Error("casting made active player invalid")
			break
		}
	}
	wg.Wait()
}
