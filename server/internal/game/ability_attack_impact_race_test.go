package game

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// Attack wind-ups resolve outside the simulation frame. Exercise both an
// outgoing attacker snapshot and an incoming hit while real cast bookkeeping
// changes the same caster; World.Mu alone does not cover those delayed hits.
func TestAbilityDispatchConcurrentAttackImpacts(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	player := newTestPlayer("impact-caster", "Wizard")
	player.InstanceID, player.X, player.Z = "impact-cast-room", 10, 200
	player.Health, player.MaxHealth = 1000000, 1000000
	enemy := &Entity{ID: "impact-cast-enemy", Type: TypeEnemy, SubType: "RootboundWarden",
		InstanceID: player.InstanceID, X: 11, Z: 200, Health: 1000000, MaxHealth: 1000000,
		Damage: 10, Scale: 4, State: "IDLE"}
	w.AddEntity(player)
	w.AddEntity(enemy)
	var hits atomic.Int32
	w.OnEvent = func(kind string, _ interface{}) {
		if kind == "damage" {
			hits.Add(1)
		}
	}
	var impacts sync.WaitGroup
	start := make(chan struct{})
	impacts.Add(1)
	go func() {
		defer impacts.Done()
		<-start
		for i := 0; i < 300; i++ {
			w.applyAttackImpact(player.ID, enemy.ID, player.InstanceID, nil, 0)
			w.applyAttackImpact(enemy.ID, player.ID, player.InstanceID, nil, 0)
		}
	}()
	defer impacts.Wait()
	close(start)
	for i := 0; i < 300; i++ {
		// Prepare resources/cooldowns under the production world/actor order.
		// No production timing, damage or cast requirement is changed.
		w.Mu.Lock()
		player.Mu.Lock()
		player.Mana = 100
		player.LastAbilityTime = time.Time{}
		player.Cooldowns = nil
		player.Mu.Unlock()
		w.Mu.Unlock()
		if result := w.PerformAbility(player.ID, enemy.X, enemy.Z, enemy.ID, "Fireball"); !result.Accepted || result.Mana != 70 {
			t.Fatalf("prepared ordinary cast rejected: %+v", result)
		}
	}
	impacts.Wait()
	if hits.Load() != 600 || player.Health >= player.MaxHealth || enemy.Health >= enemy.MaxHealth {
		t.Fatalf("real impacts were lost: hits=%d casterHP=%d enemyHP=%d", hits.Load(), player.Health, enemy.Health)
	}
}
