package game

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestDamageEventsDuringConcurrentEntityInsertion(t *testing.T) {
	w := newTestWorld()
	source := newTestPlayer("lifesteal-source", "Fighter")
	source.Health, source.MaxHealth, source.LifestealBonus = 10, 100, .1
	w.AddEntity(source)
	var damageEvents atomic.Int32
	w.OnEvent = func(kind string, payload interface{}) {
		if kind == "damage" {
			damageEvents.Add(1)
		}
	}
	start := make(chan struct{})
	var workers sync.WaitGroup
	workers.Add(2)
	go func() {
		defer workers.Done()
		<-start
		for i := 0; i < 1000; i++ {
			w.AddEntity(&Entity{ID: fmt.Sprintf("concurrent-loot-%d", i), Type: TypeLoot})
		}
	}()
	go func() {
		defer workers.Done()
		<-start
		for i := 0; i < 1000; i++ {
			w.fireDamageEvent(source, "target", 10, "physical", source.InstanceID)
		}
	}()
	close(start)
	workers.Wait()
	if damageEvents.Load() != 1000 || source.Health != 100 {
		t.Fatalf("lost event or lifesteal: events=%d health=%d", damageEvents.Load(), source.Health)
	}
}

func TestDamageEventsDoNotReacquireWorldLock(t *testing.T) {
	w := newTestWorld()
	source := newTestPlayer("locked-lifesteal-source", "Fighter")
	source.Health, source.MaxHealth, source.LifestealBonus = 50, 100, .5
	w.AddEntity(source)
	done := make(chan struct{})
	go func() {
		w.Mu.Lock()
		defer w.Mu.Unlock()
		w.fireDamageEvent(source, "target", 20, "physical", "")
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("damage feedback deadlocked inside normal world-locked dispatch")
	}
	if source.Health != 60 {
		t.Fatalf("lifesteal healed to %d, want 60", source.Health)
	}
}
