package game

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestEnemyTargetSharedLockSnapshotKeepsLiveValidation(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}}
	p := &Entity{ID: "target-shared", Type: TypePlayer, X: 42, Z: 73, InstanceID: "air", State: "IDLE"}
	w.Entities[p.ID] = p
	for _, scenario := range []string{"active", "stealth", "expired", "disconnected", "dead", "replaced", "removed", "nil"} {
		t.Run(scenario, func(t *testing.T) {
			p.State, p.Disconnected, p.StealthActive = "IDLE", false, false
			w.Entities[p.ID] = p
			candidate := p
			switch scenario {
			case "stealth", "expired":
				p.StealthActive = true
				p.StealthEndTime = time.Now().Add(time.Minute)
				if scenario == "expired" {
					p.StealthEndTime = time.Now().Add(-time.Minute)
				}
			case "disconnected":
				p.Disconnected = true
			case "dead":
				p.State = "DEAD"
			case "replaced":
				w.Entities[p.ID] = &Entity{ID: p.ID, Type: TypePlayer}
			case "removed":
				delete(w.Entities, p.ID)
			case "nil":
				candidate = nil
			}
			want := w.snapshotEnemyTarget(candidate)
			w.Mu.RLock()
			got := w.snapshotEnemyTargetLocked(candidate)
			w.Mu.RUnlock()
			if got != want {
				t.Fatal("shared-lock scan changed live target authority", got, want)
			}
		})
	}
}

func BenchmarkEnemyTargetScanWorldLock(b *testing.B) {
	w := &World{Entities: map[string]*Entity{}}
	players := make([]*Entity, 100)
	for i := range players {
		p := &Entity{ID: fmt.Sprintf("synthetic-scan-%d", i), Type: TypePlayer, State: "IDLE", X: float64(i), Z: 600}
		w.Entities[p.ID], players[i] = p, p
	}
	for _, shared := range []bool{false, true} {
		b.Run(map[bool]string{false: "per-candidate", true: "per-scan"}[shared], func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				if shared {
					w.Mu.RLock()
					for _, p := range players {
						if !w.snapshotEnemyTargetLocked(p).active {
							b.Fatal("missing active benchmark target")
						}
					}
					w.Mu.RUnlock()
				} else {
					for _, p := range players {
						if !w.snapshotEnemyTarget(p).active {
							b.Fatal("missing active benchmark target")
						}
					}
				}
			}
		})
	}
}

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
