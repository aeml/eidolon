package game

import (
	"sync"
	"testing"
	"time"
)

func TestGetEntityCopySerializesRealAbilityMutations(t *testing.T) {
	w := newTestWorld()
	player := newTestPlayer("snapshot-caster", "Wizard")
	w.AddEntity(player)
	done := make(chan struct{})
	var readers sync.WaitGroup
	readers.Add(1)
	go func() {
		defer readers.Done()
		for {
			select {
			case <-done:
				return
			default:
				w.GetEntityCopy(player.ID)
			}
		}
	}()
	defer func() { close(done); readers.Wait() }()
	for i := 0; i < 200; i++ {
		// Prepared cooldown/resources allow repeated real ability dispatch,
		// without changing the production cooldown or weakening its assertions.
		w.Mu.Lock()
		player.Mana = 100
		player.LastAbilityTime = time.Time{}
		player.Cooldowns = nil
		w.Mu.Unlock()
		if result := w.PerformAbility(player.ID, 10, 200, "", "Fireball"); !result.Accepted || result.Mana != 70 {
			t.Fatalf("prepared real Fireball failed: %+v", result)
		}
	}
}
