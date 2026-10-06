package game

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// Static fences have no simulation work. Their locks can be held by a state
// reader without preventing ordinary actors and global bookkeeping advancing.
func TestWorldUpdateSkipsStaticFencesWithoutDroppingDynamicActors(t *testing.T) {
	for _, dt := range []float64{.25, 1.25} {
		t.Run(fmt.Sprint(dt), func(t *testing.T) {
			w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50), EliteSpawnTimer: time.Now()}
			fence := &Entity{ID: "static-fence", Type: TypeFence, X: 200, Z: 400, State: "IDLE", Scale: 1}
			npc := &Entity{ID: "dynamic-npc", Type: TypeNPC, State: "IDLE", Health: 10, MaxHealth: 20,
				Mana: 5, MaxMana: 10, HpRegen: 2, ManaRegen: 1, Bleeding: true, BleedDamage: 1,
				BleedEndTime: time.Now().Add(time.Minute), LastBleedTick: time.Now().Add(-2 * time.Second)}
			w.Entities[fence.ID], w.Entities[npc.ID] = fence, npc
			w.Grid.Add(fence)
			w.Grid.Add(npc)
			damage := make(chan struct{}, 1)
			w.OnEvent = func(kind string, _ interface{}) {
				if kind == "damage" {
					damage <- struct{}{}
				}
			}
			fence.Mu.Lock()
			var release sync.Once
			done := make(chan struct{})
			go func() { w.Update(dt); close(done) }()
			defer func() {
				release.Do(fence.Mu.Unlock)
				select {
				case <-done:
				case <-time.After(2 * time.Second):
					t.Error("owned frame did not join after releasing fixture lock")
				}
			}()
			select {
			case <-damage:
			case <-time.After(2 * time.Second):
				t.Fatal("static fence lock blocked dynamic simulation")
			}
			select {
			case <-done:
			case <-time.After(2 * time.Second):
				t.Fatal("static fence lock blocked frame completion")
			}
			release.Do(fence.Mu.Unlock)
			wantHP, wantMP, wantTimer := 9, 5, dt
			if dt >= 1 {
				wantHP, wantMP, wantTimer = 11, 6, dt-1
			}
			if npc.Health != wantHP || npc.Mana != wantMP || w.RegenTimer != wantTimer {
				t.Fatal("non-fence damage, regeneration or global tick changed")
			}
			if w.Entities[fence.ID] != fence || fence.X != 200 || fence.Z != 400 || fence.State != "IDLE" || fence.Scale != 1 {
				t.Fatal("static fence identity or placement changed")
			}
			found := false
			for _, entity := range w.Grid.Nearby(200, 400, 1, "") {
				found = found || entity == fence
			}
			if !found {
				t.Fatal("static fence vanished from spatial queries")
			}
		})
	}
}

func TestWorldUpdateRetainsCompleteFencePopulation(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	fences := make(map[string]*Entity)
	for id, entity := range w.Entities {
		if entity.Type == TypeFence {
			fences[id] = entity
		}
	}
	if len(fences) != 6050 {
		t.Fatal("test must cover the complete current generated fence population", len(fences))
	}
	w.Update(.033)
	for id, entity := range fences {
		if w.Entities[id] != entity || entity.Type != TypeFence {
			t.Fatal("simulation optimization removed or replaced a fence", id)
		}
	}
}
