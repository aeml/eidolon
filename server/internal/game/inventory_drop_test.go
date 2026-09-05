package game

import (
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestInventoryDropRoundTripPreservesWholeItemAndInstance(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("drop-player", "Fighter")
	player.X, player.Z, player.InstanceID = 50000, 20000, "dungeon_drop_test"
	item := Item{ID: "keep-identity", Name: "Test sword", Stack: 3, MaxStack: 4,
		Stats: map[string]int{"strength": 12}, Sockets: 1, Gems: []SocketedGem{{}}, UniqueEffect: "lucky"}
	player.Inventory = []Item{item, {ID: "untouched", Stack: 1}}
	w.AddEntity(player)
	inventory, err := w.PerformInventoryDrop(player.ID, 0, item.ID)
	if err != nil || inventory[0].ID != "" || inventory[1].ID != "untouched" {
		t.Fatalf("drop failed or changed another slot: %v %+v", err, inventory)
	}
	var loot *Entity
	for _, actor := range w.Entities {
		if actor.Type == TypeLoot && actor.LootItem.ID == item.ID {
			loot = actor
		}
	}
	if loot == nil || loot.InstanceID != player.InstanceID || loot.X != player.X || loot.Z != player.Z || time.Since(loot.LootTime) > time.Second {
		t.Fatal("drop missing, expired, or in the wrong scene")
	}
	if !reflect.DeepEqual(*loot.LootItem, item) {
		t.Fatal("drop changed item stats, stack, sockets or identity")
	}
	player.InstanceID = "other-instance"
	if _, ok, reason := w.PerformPickup(player.ID, loot.ID); ok || reason != "different_instance" {
		t.Fatal("cross-instance pickup was accepted")
	}
	player.InstanceID = loot.InstanceID
	if _, ok, reason := w.PerformPickup(player.ID, loot.ID); !ok || reason != "" {
		t.Fatalf("manual pickup failed: %s", reason)
	}
	if !reflect.DeepEqual(player.Inventory[0], item) || w.Entities[loot.ID] != nil {
		t.Fatal("drop/pickup duplicated or lost the item")
	}
}

func TestInventoryDropRejectsUnsafeRequestsWithoutChangingBag(t *testing.T) {
	for _, scenario := range []string{"negative-slot", "past-end", "wrong-id", "empty-id", "quest-item", "dead", "disconnected", "trading"} {
		t.Run(scenario, func(t *testing.T) {
			w := NewWorld(nil)
			player := newTestPlayer("drop-player", "Fighter")
			player.Inventory = []Item{{ID: "bag-item", Stack: 1}}
			w.AddEntity(player)
			slot, id := 0, "bag-item"
			switch scenario {
			case "negative-slot":
				slot = -1
			case "past-end":
				slot = 1
			case "wrong-id":
				id = "another-item"
			case "empty-id":
				id = ""
			case "quest-item":
				id = "chronicle-item-quest"
				player.Inventory[0].ID = id
			case "dead":
				player.State = "DEAD"
			case "disconnected":
				player.Disconnected = true
			case "trading":
				w.TradeByPlayer[player.ID] = "active-trade"
			}
			before, count := cloneItems(player.Inventory), len(w.Entities)
			if _, err := w.PerformInventoryDrop(player.ID, slot, id); err == nil {
				t.Fatal("unsafe drop accepted")
			}
			if !reflect.DeepEqual(before, player.Inventory) || len(w.Entities) != count {
				t.Fatal("rejected drop changed inventory or world")
			}
		})
	}
}

func TestConcurrentInventoryDropRequestsCreateOnlyOneGroundItem(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("drop-once", "Wizard")
	player.Inventory = []Item{{ID: "once", Stack: 1}}
	w.AddEntity(player)
	var accepted atomic.Int32
	var pending sync.WaitGroup
	for i := 0; i < 32; i++ {
		pending.Add(1)
		go func() {
			defer pending.Done()
			if _, err := w.PerformInventoryDrop(player.ID, 0, "once"); err == nil {
				accepted.Add(1)
			}
		}()
	}
	pending.Wait()
	if accepted.Load() != 1 {
		t.Fatalf("accepted %d duplicate drops", accepted.Load())
	}
	count := 0
	for _, actor := range w.Entities {
		if actor.Type == TypeLoot && actor.LootItem.ID == "once" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("created %d copies", count)
	}
}
