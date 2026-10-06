package game

import (
	"fmt"
	"math"
	"sync"
	"testing"
	"time"
)

func TestEnemyTargetScanRangePreservesLiveAuthorityAndDistantThreat(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}}
	p := &Entity{ID: "scan-live", Type: TypePlayer, State: "IDLE", X: 3, Z: 4}
	w.Entities[p.ID] = p
	for _, scenario := range []string{"near", "boundary", "outside", "far-threat", "tiny-threat", "negative-threat", "wrong-scene", "disconnected", "dead", "hidden", "expired-stealth", "replaced", "removed", "nil", "nan-position"} {
		t.Run(scenario, func(t *testing.T) {
			p.X, p.Z, p.InstanceID, p.State = 3, 4, "", "IDLE"
			p.Disconnected, p.StealthActive = false, false
			w.Entities[p.ID] = p
			candidate := p
			threat := map[string]float64{}
			outside := false
			switch scenario {
			case "outside", "far-threat", "tiny-threat", "negative-threat":
				p.X, p.Z = 6, 0
				outside = true
				if scenario == "far-threat" {
					threat[p.ID] = 10
				}
				if scenario == "tiny-threat" {
					threat[p.ID] = .000001
				}
				if scenario == "negative-threat" {
					threat[p.ID] = -1
				}
			case "near":
				p.X, p.Z = 1, 1
			case "wrong-scene":
				p.InstanceID = CasinoInstanceID
			case "disconnected":
				p.Disconnected = true
			case "dead":
				p.State = "DEAD"
			case "hidden", "expired-stealth":
				p.StealthActive, p.StealthEndTime = true, time.Now().Add(time.Minute)
				if scenario == "expired-stealth" {
					p.StealthEndTime = time.Now().Add(-time.Minute)
				}
			case "replaced":
				w.Entities[p.ID] = &Entity{ID: p.ID, Type: TypePlayer}
			case "removed":
				delete(w.Entities, p.ID)
			case "nil":
				candidate = nil
			case "nan-position":
				p.X = math.NaN()
			}
			w.Mu.RLock()
			want := w.snapshotEnemyTargetLocked(candidate, "")
			got := w.snapshotEnemyTargetForScanLocked(candidate, "", 0, 0, 5, threat)
			w.Mu.RUnlock()
			if outside && threat[p.ID] <= 0 {
				want = enemyTargetSnapshot{}
			}
			// NaN is deliberately not promoted to a finite attack position; use
			// individual fields because NaN is not equal to itself.
			if scenario == "nan-position" {
				if !math.IsNaN(got.x) || got.active != want.active || got.hidden != want.hidden || got.id != want.id {
					t.Fatal("nonfinite live snapshot changed")
				}
			} else if got != want {
				t.Fatal("scan shortcut changed live eligibility or threat priority", got, want)
			}
		})
	}
}

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

func TestEnemyTargetScanKeepsDistantThreatPriorityAtActualConsumer(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	near, far := newTestPlayer("scan-consumer-near", "Fighter"), newTestPlayer("scan-consumer-far", "Fighter")
	near.X, near.Z, far.X, far.Z = 201, 600, 1000, 600
	enemy := &Entity{ID: "scan-consumer-enemy", Type: TypeEnemy, SubType: "Skeleton", Level: 30,
		X: 200, Z: 600, SpawnX: 200, SpawnZ: 600, Health: 100, MaxHealth: 100, Damage: 50,
		State: "IDLE", AttackCooldown: time.Second, Threat: map[string]float64{far.ID: 100, near.ID: 1}}
	w.AddEntity(near)
	w.AddEntity(far)
	w.AddEntity(enemy)
	w.updateEntity(enemy, .033, []*Entity{near, far}, &deferredActions{})
	if near.Health != near.MaxHealth || far.Health != far.MaxHealth {
		t.Fatal("range shortcut dropped distant threat priority and attacked a nearer actor")
	}
	// Once the distant threat genuinely disappears, the same normal AI must
	// attack the in-range target. No extended sight, timer or power is granted.
	delete(enemy.Threat, far.ID)
	w.updateEntity(enemy, .033, []*Entity{near, far}, &deferredActions{})
	enemy.Mu.RLock()
	accepted := enemy.State == "ATTACKING" && !enemy.LastAttackTime.IsZero()
	enemy.Mu.RUnlock()
	if !accepted {
		t.Fatal("ordinary in-range enemy attack was not accepted")
	}
	// Normal melee has a wind-up (35% of cooldown). Observe its real queued
	// impact instead of expecting synchronous damage or shortening that timer.
	deadline := time.Now().Add(2 * time.Second)
	for {
		near.Mu.RLock()
		landed := near.Health < near.MaxHealth
		near.Mu.RUnlock()
		if landed {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("ordinary in-range enemy attack did not land after its wind-up")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if far.Health != far.MaxHealth {
		t.Fatal("distant player received an out-of-range impact")
	}
}

func TestEnemyTargetSceneFilterKeepsLiveAuthority(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}}
	p := &Entity{ID: "target-scene", Type: TypePlayer, State: "IDLE", InstanceID: CasinoInstanceID}
	w.Entities[p.ID] = p
	check := func(scene string, wantActive bool) {
		t.Helper()
		w.Mu.RLock()
		got := w.snapshotEnemyTargetLocked(p, scene)
		unfiltered := w.snapshotEnemyTargetLocked(p)
		w.Mu.RUnlock()
		if got.active != wantActive || p.InstanceID == scene && got != unfiltered {
			t.Fatal("scene filter changed live target authority", got, unfiltered)
		}
	}
	check("", false)
	check(CasinoInstanceID, true)
	p.InstanceID = ""
	check(CasinoInstanceID, false)
	check("", true)
	p.StealthActive, p.StealthEndTime = true, time.Now().Add(time.Minute)
	check("", true) // Hidden state must still match the live unfiltered view.
	p.Disconnected = true
	check("", false)
	p.Disconnected, p.State = false, "DEAD"
	check("", false)
	p.State = "IDLE"
	w.Entities[p.ID] = &Entity{ID: p.ID, Type: TypePlayer}
	check("", false)
	delete(w.Entities, p.ID)
	check("", false)
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
