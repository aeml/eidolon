package game

import (
	"testing"
	"time"
)

func TestGroundLootHelpersStartFullPickupLifetime(t *testing.T) {
	for _, instanceID := range []string{"", "dungeon_loot_lifetime"} {
		w := newTestWorld()
		t.Cleanup(w.StopBackground)
		item := Item{ID: "fresh-ground-item", Stack: 3}
		if instanceID == "" {
			w.DropLoot(item, 60000, 60010)
		} else {
			w.DropLootInInstance(item, 60000, 60010, instanceID)
		}
		var loot *Entity
		for _, entity := range w.Entities {
			if entity.Type == TypeLoot {
				loot = entity
				break
			}
		}
		if loot == nil {
			t.Fatal("helper created no loot")
		}
		deferred := &deferredActions{}
		w.updateEntity(loot, .05, nil, deferred)
		if containsPlayer(deferred.removals, loot.ID) {
			t.Fatal("fresh ground loot expired on its first update")
		}
		if loot.InstanceID != instanceID || loot.X != 60000 || loot.Z != 60010 || loot.LootItem.Stack != 3 {
			t.Fatal("helper changed placement or stack")
		}
		loot.LootTime = time.Now().Add(-61 * time.Second)
		w.updateEntity(loot, .05, nil, deferred)
		if !containsPlayer(deferred.removals, loot.ID) {
			t.Fatal("old loot never expires")
		}
	}
}
