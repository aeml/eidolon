package game

import (
	"fmt"
	"reflect"
	"sync"
	"testing"
)

func TestStateBatchSharesOnlyDetachedCurrentBroadcast(t *testing.T) {
	w := newTestWorld()
	ids := []string{"batch-a", "batch-b", "batch-raid", "missing"}
	for i, id := range ids[:3] {
		p := &Entity{ID: id, Type: TypePlayer, X: float64(i), Health: 100,
			EP: 83, EPExchangeReceipts: map[string]int{"private": 1},
			EPCasinoReceipts: map[string]int{"private": -10}, VIPAllowanceReceipts: map[string]int{"private": 100},
			Inventory: []Item{{ID: "private-bag-item"}}, AppearanceCollection: map[string]EquipmentAppearance{"private": {}},
			UnlockedSkills: []string{"Fireball"}, Equipment: map[string]Item{
				"mainHand": {ID: "staff", Description: "omit", Stats: map[string]int{"damage": 7}}}}
		if i == 2 {
			p.InstanceID = "raid"
		}
		w.AddEntity(p)
	}
	loot := &Entity{ID: "batch-loot", Type: TypeLoot, LootItem: &Item{ID: "loot", Stats: map[string]int{"damage": 3}}}
	w.AddEntity(loot)
	w.AddEntity(&Entity{ID: "beyond-radius", Type: TypeEnemy, X: 205})
	batch := w.GetStatesForPlayers(ids, 200)
	for _, id := range ids {
		if !reflect.DeepEqual(batch[id], w.GetStateForPlayer(id, 200)) {
			t.Fatalf("batch changed existing snapshot fields for %s", id)
		}
	}
	a, b := batch[ids[0]], batch[ids[1]]
	if a[ids[0]] != b[ids[0]] || a[loot.ID] != b[loot.ID] {
		t.Fatal("overlapping observers allocated duplicate snapshots")
	}
	if a[ids[2]] != nil || batch[ids[2]][ids[0]] != nil {
		t.Fatal("batch crossed instance boundary")
	}
	if a["beyond-radius"] != nil || b["beyond-radius"] != nil {
		t.Fatal("batch crossed view radius")
	}
	if a[ids[0]].EP != 0 || a[ids[0]].EPExchangeReceipts != nil || a[ids[0]].EPCasinoReceipts != nil ||
		a[ids[0]].VIPAllowanceReceipts != nil || a[ids[0]].Inventory != nil || a[ids[0]].AppearanceCollection != nil ||
		a[ids[0]].Equipment["mainHand"].Description != "" {
		t.Fatal("snapshot exposed private wallet or changed wire stripping")
	}
	p := w.Entities[ids[0]]
	p.Mu.Lock()
	p.UnlockedSkills[0] = "Arcane Shield"
	p.Equipment["mainHand"].Stats["damage"] = 11
	p.Health = 50
	p.Mu.Unlock()
	loot.Mu.Lock()
	loot.LootItem.Stats["damage"] = 5
	loot.Mu.Unlock()
	if a[ids[0]].UnlockedSkills[0] != "Fireball" || a[ids[0]].Equipment["mainHand"].Stats["damage"] != 7 || a[loot.ID].LootItem.Stats["damage"] != 3 {
		t.Fatal("live mutation changed a detached shared snapshot")
	}
	next := w.GetStatesForPlayers(ids, 200)
	if next[ids[0]][ids[0]] == a[ids[0]] || next[ids[0]][ids[0]].Health != 50 {
		t.Fatal("stale snapshot reused across broadcasts")
	}
	w.RemoveEntity(ids[1])
	if w.GetStatesForPlayers(ids, 200)[ids[0]][ids[1]] != nil {
		t.Fatal("removed player retained in next broadcast")
	}
}

func TestStateBatchConcurrentInstanceChangesStayIsolated(t *testing.T) {
	w := newTestWorld()
	for _, p := range []*Entity{{ID: "outside", Type: TypePlayer}, {ID: "inside", Type: TypePlayer, InstanceID: "raid"}, {ID: "moving", Type: TypePlayer}} {
		w.AddEntity(p)
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			w.Mu.Lock()
			p := w.Entities["moving"]
			p.Mu.Lock()
			w.Grid.Remove(p)
			if p.InstanceID == "" {
				p.InstanceID = "raid"
			} else {
				p.InstanceID = ""
			}
			w.Grid.Add(p)
			p.Mu.Unlock()
			w.Mu.Unlock()
		}
	}()
	defer wg.Wait()
	for i := 0; i < 100; i++ {
		batch := w.GetStatesForPlayers([]string{"outside", "inside", "moving"}, 200)
		for id, state := range batch {
			for _, snapshot := range state {
				if snapshot.InstanceID != state[id].InstanceID {
					t.Fatal("cross-instance snapshot")
				}
			}
		}
	}
}

func BenchmarkStateBroadcastObservers(b *testing.B) {
	w := newTestWorld()
	ids := make([]string, 100)
	for i := range ids {
		ids[i] = fmt.Sprintf("observer-%d", i)
		w.AddEntity(&Entity{ID: ids[i], Type: TypePlayer, X: float64(i % 10), Health: 100})
	}
	for i := 0; i < 250; i++ {
		w.AddEntity(&Entity{ID: fmt.Sprintf("nearby-%d", i), Type: TypeEnemy, X: float64(i % 25), Health: 100})
	}
	for _, shared := range []bool{false, true} {
		b.Run(fmt.Sprintf("shared=%t", shared), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if shared {
					_ = w.GetStatesForPlayers(ids, 200)
				} else {
					for _, id := range ids {
						_ = w.GetStateForPlayer(id, 200)
					}
				}
			}
		})
	}
}
