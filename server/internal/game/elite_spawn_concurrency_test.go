package game

import (
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
)

// The five-minute runtime spawn shares Entities with broadcast view lookups.
// A reader's existing world lock cannot protect against an unlocked publisher.
func TestEliteSpawnConcurrentBroadcastViewAndMembership(t *testing.T) {
	viewer := &Entity{ID: "elite-race-viewer", Type: TypePlayer, X: 60000, Z: 60000, Health: 100, State: "IDLE"}
	w := &World{Entities: map[string]*Entity{viewer.ID: viewer}, Grid: NewSpatialMap(50)}
	w.Grid.Add(viewer)
	const spawns = 200
	var observed atomic.Int32
	w.OnEvent = func(kind string, _ interface{}) {
		if kind != "elite_spawn" {
			return
		}
		// Events must run after releasing the publication lock so ordinary
		// listeners may inspect the now-complete world without deadlocking.
		if _, _, _, joined := w.GetPlayerViewPosition(viewer.ID); !joined {
			t.Error("viewer disappeared")
		}
		observed.Add(1)
	}
	ready := make(chan struct{})
	done := make(chan struct{})
	var readers sync.WaitGroup
	for i := 0; i < 4; i++ {
		readers.Add(1)
		go func() {
			defer readers.Done()
			<-ready
			for {
				select {
				case <-done:
					return
				default:
				}
				x, z, instance, joined := w.GetPlayerViewPosition(viewer.ID)
				if !joined || x != 60000 || z != 60000 || instance != "" {
					t.Error("incoherent recipient snapshot")
					return
				}
				w.Mu.RLock()
				for _, e := range w.Entities {
					if e == nil {
						t.Error("partial entity publication")
					}
				}
				w.Mu.RUnlock()
				runtime.Gosched()
			}
		}()
	}
	close(ready)
	for i := 0; i < spawns; i++ {
		w.spawnEliteInRect(50, 60000, 60000, 60000, 60000)
		runtime.Gosched()
	}
	close(done)
	readers.Wait()
	if observed.Load() != spawns || len(w.Entities) != spawns+1 {
		t.Fatalf("lost elite spawns: events=%d entities=%d", observed.Load(), len(w.Entities))
	}
	if len(w.Grid.Nearby(60000, 60000, 10, "")) != spawns+1 {
		t.Fatal("spatial membership diverged from entity publication")
	}
}
