package main

import (
	"fmt"
	"reflect"
	"testing"
)

func TestCasinoDecisionDoesNotAllocateUnusedWorldAndBagCopies(t *testing.T) {
	entities := map[string]Entity{"own": {ID: "own", Health: 10}, "enemy": {ID: "enemy", Health: 20}}
	inventory := []Item{{ID: "keep", Slot: "chest"}}
	current, bag := copyDecisionDetails(entities, inventory, true)
	if current != nil || bag != nil {
		t.Fatal("casino allocated unused combat/sale state")
	}
	if allocations := testing.AllocsPerRun(100, func() { copyDecisionDetails(entities, inventory, true) }); allocations != 0 {
		t.Fatal("casino detail snapshot allocates")
	}
	if len(entities) != 2 || entities["own"].Health != 10 || inventory[0].ID != "keep" {
		t.Fatal("input state mutated")
	}
}

func TestOtherDecisionControllersRetainDetachedWorldAndBagCopies(t *testing.T) {
	entities := map[string]Entity{"own": {ID: "own", Health: 10}, "enemy": {ID: "enemy", Health: 20}}
	inventory := []Item{{ID: "keep", Slot: "chest"}}
	current, bag := copyDecisionDetails(entities, inventory, false)
	if !reflect.DeepEqual(current, entities) || !reflect.DeepEqual(bag, inventory) {
		t.Fatal("non-casino inputs changed")
	}
	delete(current, "enemy")
	current["own"] = Entity{ID: "own", Health: 0}
	bag[0].Slot = "head"
	if len(entities) != 2 || entities["own"].Health != 10 || inventory[0].Slot != "chest" {
		t.Fatal("decision shares mutable map/slice with reader")
	}
}

var snapshotEntities map[string]Entity
var snapshotInventory []Item

func BenchmarkDecisionDetails(b *testing.B) {
	for _, size := range []int{128, 1024} {
		entities := make(map[string]Entity, size)
		for i := 0; i < size; i++ {
			id := fmt.Sprintf("synthetic-%d", i)
			entities[id] = Entity{ID: id, Health: 100}
		}
		inventory := make([]Item, 40)
		for _, casinoOnly := range []bool{false, true} {
			b.Run(fmt.Sprintf("entities%d/casino%t", size, casinoOnly), func(b *testing.B) {
				b.ReportAllocs()
				for i := 0; i < b.N; i++ {
					snapshotEntities, snapshotInventory = copyDecisionDetails(entities, inventory, casinoOnly)
				}
			})
		}
	}
}
