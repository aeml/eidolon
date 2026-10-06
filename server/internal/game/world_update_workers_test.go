package game

import (
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestWorldUpdateWorkersRespectRuntimeCPUBudgetAndVisitEveryActor(t *testing.T) {
	for _, budget := range []int{1, 2} {
		t.Run(fmt.Sprintf("budget%d", budget), func(t *testing.T) {
			previous := runtime.GOMAXPROCS(budget)
			defer runtime.GOMAXPROCS(previous)
			w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50), EliteSpawnTimer: time.Now()}
			const count = 6
			actors := make([]*Entity, count)
			for index := range actors {
				e := &Entity{ID: fmt.Sprintf("worker-fixture-%d", index), Type: TypeNPC, State: "IDLE", Health: 100, MaxHealth: 100,
					Bleeding: true, BleedDamage: 1, BleedEndTime: time.Now().Add(time.Minute), LastBleedTick: time.Now().Add(-2 * time.Second)}
				actors[index], w.Entities[e.ID] = e, e
				w.Grid.Add(e)
			}
			entered, release, done := make(chan struct{}, count), make(chan struct{}), make(chan struct{})
			var active, peak, calls atomic.Int32
			w.OnEvent = func(kind string, _ interface{}) {
				if kind != "damage" {
					return
				}
				calls.Add(1)
				current := active.Add(1)
				for prior := peak.Load(); current > prior; prior = peak.Load() {
					if peak.CompareAndSwap(prior, current) {
						break
					}
				}
				entered <- struct{}{}
				<-release
				active.Add(-1)
			}
			go func() { w.Update(.1); close(done) }()
			var released sync.Once
			finish := func() {
				released.Do(func() { close(release) })
				select {
				case <-done:
				case <-time.After(2 * time.Second):
					t.Fatal("owned update did not join")
				}
			}
			defer finish()
			for index := 0; index < budget; index++ {
				select {
				case <-entered:
				case <-time.After(2 * time.Second):
					t.Fatal("expected update workers did not reach ordinary damage callback")
				}
			}
			// Each admitted worker is held in a real callback. An additional
			// callback must not enter until one of those workers is released.
			select {
			case <-entered:
				t.Error("world update exceeded the configured CPU worker budget")
			case <-time.After(50 * time.Millisecond):
			}
			finish()
			if peak.Load() > int32(budget) || calls.Load() != count {
				t.Fatal("worker bound or every-actor update violated", peak.Load(), calls.Load())
			}
			for _, actor := range actors {
				if actor.Health != 99 {
					t.Fatal("actor damage tick skipped or applied more than once")
				}
			}
		})
	}
}

func TestWorldUpdateEmptyFramePreservesGlobalBookkeeping(t *testing.T) {
	started := time.Now()
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50), EliteSpawnTimer: started}
	w.Update(.25)
	if len(w.Entities) != 0 || w.RegenTimer != .25 || w.EliteSpawnTimer != started {
		t.Fatal("empty frame skipped bookkeeping or created actors")
	}
}
