package game

import (
	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"reflect"
	"sync"
	"testing"
)

func TestForgeProgressionAuctionRoundTrip(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("auction-forge", "Wizard")
	p.Level = 100
	p.Equipment = map[string]Item{"mainHand": {ID: "staff", Level: 1, Stats: map[string]int{"damage": 1}, Value: 10, StatScaleVersion: ItemStatScaleVersion}}
	p.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 1000}}
	w.AddEntity(p)
	trading := NewTradingSystem(nil)
	for level := 2; level <= 100; level++ {
		if _, ok, message := w.PerformForgeUpgrade(p.ID, "mainHand", 1); !ok {
			t.Fatal(message)
		}
		original := p.Equipment["mainHand"]
		encoded, err := bson.Marshal(trading.toDBAuction(&Auction{ID: "persisted-auction", Item: original}))
		if err != nil {
			t.Fatal(err)
		}
		var saved database.Auction
		if err := bson.Unmarshal(encoded, &saved); err != nil {
			t.Fatal(err)
		}
		loaded := trading.fromDBAuction(&saved).Item
		if !reflect.DeepEqual(loaded.ForgeBasis, original.ForgeBasis) {
			t.Fatalf("auction dropped earned precision at level %d: %+v", level, loaded.ForgeBasis)
		}
		p.Equipment["mainHand"] = loaded
	}
	if item := p.Equipment["mainHand"]; item.Stats["damage"] != 13 || item.Value != 139 {
		t.Fatalf("auction reload changed accumulated upgrades: %+v", item)
	}
	item := p.Equipment["mainHand"]
	dbCopy := trading.toDBItem(item)
	loaded := trading.fromDBItem(dbCopy)
	loaded.ForgeBasis.Stats["damage"] = 999
	if item.ForgeBasis.Stats["damage"] != 1 || dbCopy.ForgeBasis.Stats["damage"] != 1 {
		t.Fatal("auction conversion shares a mutable basis")
	}
}

func TestForgeProgressionRejectedPurchasePreservesItem(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("rejected-forge", "Wizard")
	p.Level = 30
	p.Equipment = map[string]Item{"mainHand": {ID: "staff", Level: 30, Stats: map[string]int{"damage": 7}, Value: 300}}
	p.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 100}}
	w.AddEntity(p)
	beforeItem, beforeInventory := cloneItem(p.Equipment["mainHand"]), cloneItems(p.Inventory)
	if _, ok, _ := w.PerformForgeUpgrade(p.ID, "mainHand", 10); ok {
		t.Fatal("underlevel purchase succeeded")
	}
	if _, ok, _ := w.PerformForgePotency(p.ID, "mainHand"); ok {
		t.Fatal("purchase without hearts succeeded")
	}
	if !reflect.DeepEqual(beforeItem, p.Equipment["mainHand"]) || !reflect.DeepEqual(beforeInventory, p.Inventory) {
		t.Fatal("rejected purchase changed gear, its basis or currency")
	}
}

func TestForgeProgressionConcurrentCharacterSnapshots(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("forge-concurrent", "Wizard")
	p.Level = 100
	w.AddEntity(p)
	var workers sync.WaitGroup
	workers.Add(2)
	go func() {
		defer workers.Done()
		for i := 0; i < 500; i++ {
			w.Mu.Lock()
			p.Mu.Lock()
			p.Equipment = map[string]Item{"mainHand": {ID: "staff", Level: 30, Stats: map[string]int{"damage": 30}, Value: 300}}
			p.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 100}, {ID: "hearts", Name: "Eidolon Heart", Stack: 100}}
			p.Mu.Unlock()
			w.Mu.Unlock()
			w.PerformForgeUpgrade(p.ID, "mainHand", 10)
			w.PerformForgePotency(p.ID, "mainHand")
		}
	}()
	go func() {
		defer workers.Done()
		for i := 0; i < 5000; i++ {
			w.GetEntityCopy(p.ID)
		}
	}()
	workers.Wait()
}

func TestForgeProgressionDoesNotLoseSmallStatGains(t *testing.T) {
	results := make([]Item, 0, 3)
	costs := make([]int, 0, 3)
	for _, batch := range []int{1, 10, 99} {
		w := newTestWorld()
		player := newTestPlayer("forge-path", "Wizard")
		player.Level = 100
		player.Equipment = map[string]Item{"mainHand": {
			ID: "small-staff", Level: 1, Stats: map[string]int{"damage": 1, "intelligence": 3}, Value: 10,
		}}
		player.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 1000}}
		w.AddEntity(player)
		for player.Equipment["mainHand"].Level < 100 {
			if _, ok, message := w.PerformForgeUpgrade(player.ID, "mainHand", batch); !ok {
				t.Fatal(message)
			}
		}
		results = append(results, player.Equipment["mainHand"])
		costs = append(costs, 1000-auditForgeMaterialCount(player, isForgeShardItem))
	}
	for i, item := range results {
		if item.Stats["damage"] != 13 || item.Stats["intelligence"] != 41 || item.Value != 139 {
			t.Errorf("path %d lost accumulated gains: stats=%v value=%d", i, item.Stats, item.Value)
		}
		if costs[i] != 119 {
			t.Errorf("path %d skipped tier costs: %d", i, costs[i])
		}
	}
}

func TestForgeProgressionPotencyAndLevelOrderAgree(t *testing.T) {
	results := []Item{}
	for _, potencyFirst := range []bool{false, true} {
		w := newTestWorld()
		p := newTestPlayer("mixed-forge", "Fighter")
		p.Level = 100
		p.Equipment = map[string]Item{"mainHand": {ID: "blade", Level: 1, Stats: map[string]int{"damage": 1}, Value: 10}}
		p.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 1000}, {ID: "hearts", Name: "Eidolon Heart", Stack: 100}}
		w.AddEntity(p)
		potency := func() {
			for i := 0; i < 5; i++ {
				if _, ok, message := w.PerformForgePotency(p.ID, "mainHand"); !ok {
					t.Fatal(message)
				}
			}
		}
		if potencyFirst {
			potency()
		}
		if _, ok, message := w.PerformForgeUpgrade(p.ID, "mainHand", 99); !ok {
			t.Fatal(message)
		}
		if !potencyFirst {
			potency()
		}
		results = append(results, p.Equipment["mainHand"])
	}
	if !reflect.DeepEqual(results[0].Stats, results[1].Stats) || results[0].Value != results[1].Value || results[0].Stats["damage"] != 20 {
		t.Fatalf("operation order changed earned gains: %+v / %+v", results[0], results[1])
	}
}

func TestForgeProgressionDoesNotMutatePriorItemMaps(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("forge-snapshot", "Wizard")
	p.Level = 100
	old := Item{ID: "existing-staff", Level: 30, Potency: 4, Stats: map[string]int{"damage": 17}, Value: 300}
	p.Equipment = map[string]Item{"mainHand": old}
	p.Inventory = []Item{{ID: "shards", Name: "Eidolon Shard", Stack: 1000}}
	w.AddEntity(p)
	if _, ok, message := w.PerformForgeUpgrade(p.ID, "mainHand", 10); !ok {
		t.Fatal(message)
	}
	if old.Stats["damage"] != 17 {
		t.Fatalf("upgrade mutated an earlier snapshot: %v", old.Stats)
	}
}
