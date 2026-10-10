package game

import (
	"sync"
	"testing"
	"time"
)

func TestAbilityDispatchConcurrentRealtimeFrames(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("frame-caster", "Wizard")
	w.AddEntity(player)
	var frames sync.WaitGroup
	frames.Add(1)
	start := make(chan struct{})
	go func() {
		defer frames.Done()
		<-start
		for i := 0; i < 200; i++ {
			w.UpdateRealtime(1.0/30, time.Now())
		}
	}()
	defer frames.Wait()
	close(start)
	for i := 0; i < 200; i++ {
		// Fixture preparation follows the world/actor lock order. The actual
		// cast and realtime frame then exercise production dispatch unchanged.
		w.Mu.Lock()
		player.Mu.Lock()
		player.Mana = 100
		player.LastAbilityTime = time.Time{}
		player.Cooldowns = nil
		player.Mu.Unlock()
		w.Mu.Unlock()
		if result := w.PerformAbility(player.ID, 10, 200, "", "Fireball"); !result.Accepted {
			t.Fatalf("prepared ordinary Fireball rejected: %+v", result)
		}
	}
}
