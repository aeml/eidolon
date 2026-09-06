package game

import (
	"fmt"
	"reflect"
	"testing"
)

func TestEquipRejectsNonEquipmentAndUnsupportedSlots(t *testing.T) {
	for _, item := range []Item{
		{ID: "gem", Type: ItemGem, Slot: "gem"},
		{ID: "gem-in-hand", Type: ItemGem, Slot: "mainHand"},
		{ID: "hidden-slot", Type: ItemWeapon, Slot: "hidden"},
		{ID: "material-slot", Type: ItemWeapon, Slot: "material"},
	} {
		t.Run(item.ID, func(t *testing.T) {
			w := NewWorld(nil)
			item.Stack = 1
			p := &Entity{ID: "slot-player", Type: TypePlayer, Level: 30, Inventory: []Item{item}, Equipment: map[string]Item{}}
			w.AddEntity(p)
			if _, ok := w.PerformEquip(p.ID, item.ID, item.Slot); ok {
				t.Fatal("non-equipment accepted")
			}
			if !reflect.DeepEqual(p.Inventory, []Item{item}) || len(p.Equipment) != 0 || p.EquipmentRevision != 0 {
				t.Fatal("rejected equip changed owned items or revision")
			}
		})
	}
}

func TestUnsupportedEquipmentRecoveryIsAtomicWhenStackCannotFit(t *testing.T) {
	w := NewWorld(nil)
	gem := Item{ID: "legacy-gem", Name: "Sapphire", Type: ItemGem, Slot: "gem", Stack: 5, MaxStack: 20}
	p := &Entity{ID: "recovery-player", Type: TypePlayer, Level: 30, Inventory: make([]Item, MaxInventorySize), Equipment: map[string]Item{"gem": gem}}
	for i := range p.Inventory {
		p.Inventory[i] = Item{ID: fmt.Sprintf("filler-%d", i), Name: "Sword", Stack: 1}
	}
	p.Inventory[0] = Item{ID: "existing-gem", Name: gem.Name, Type: ItemGem, Slot: "gem", Stack: 18, MaxStack: 20}
	w.AddEntity(p)
	before := append([]Item(nil), p.Inventory...)
	for attempt := 0; attempt < 2; attempt++ {
		if _, ok := w.PerformUnequip(p.ID, "gem"); ok {
			t.Fatal("partial-capacity recovery succeeded")
		}
		if !reflect.DeepEqual(before, p.Inventory) || !reflect.DeepEqual(p.Equipment["gem"], gem) || p.EquipmentRevision != 0 {
			t.Fatal("failed recovery partially merged or duplicated the gem stack")
		}
	}
	p.Inventory[1] = Item{}
	if _, ok := w.PerformUnequip(p.ID, "gem"); !ok {
		t.Fatal("recovery with enough space failed")
	}
	if p.Inventory[0].Stack != 20 || p.Inventory[1].Stack != 3 || p.Inventory[1].ID != gem.ID || len(p.Equipment) != 0 || p.EquipmentRevision != 1 {
		t.Fatal("recovery did not conserve exact stack quantity and equipment revision")
	}
	if _, ok := w.PerformUnequip(p.ID, "gem"); ok {
		t.Fatal("replayed recovery duplicated an item")
	}
}

func TestUnsupportedEquipmentDoesNotGrantStatsOrUniqueEffects(t *testing.T) {
	p := &Entity{ID: "legacy-stat-player", Type: TypePlayer, Level: 30, BaseStats: Stats{Intelligence: 10, Vitality: 10}}
	p.RecalculateStats()
	baseline := p.Stats
	gem := Item{ID: "legacy-gem", Type: ItemGem, Slot: "gem", Stack: 1, Stats: map[string]int{"intelligence": 1000}, UniqueEffect: "swift"}
	p.Equipment = map[string]Item{"gem": gem}
	p.RecalculateStats()
	if p.Stats != baseline || len(p.ActiveUniqueEffects) != 0 {
		t.Fatal("unsupported equipment grants gameplay power")
	}
	if !reflect.DeepEqual(p.Equipment["gem"], gem) {
		t.Fatal("stat calculation deleted a recoverable item")
	}
}

func TestRecoveryRejectsStaleItemIdentity(t *testing.T) {
	w := NewWorld(nil)
	gem := Item{ID: "replacement-gem", Type: ItemGem, Slot: "gem", Stack: 1}
	p := &Entity{ID: "stale-recovery", Type: TypePlayer, Level: 30, Inventory: make([]Item, 25), Equipment: map[string]Item{"gem": gem}}
	w.AddEntity(p)
	if _, ok := w.PerformUnequip(p.ID, "gem", "old-gem"); ok {
		t.Fatal("stale identity recovered a replacement item")
	}
	if p.Equipment["gem"].ID != gem.ID || p.Inventory[0].ID != "" {
		t.Fatal("stale request mutated ownership")
	}
}

func TestAllRealEquipmentSlotsAndSocketedGemsRemainUsable(t *testing.T) {
	for _, slot := range []string{"head", "chest", "legs", "feet", "gloves", "shoulders", "belt", "neck", "mainHand", "offHand", "ring1", "ring2", "trinket1", "trinket2"} {
		t.Run(slot, func(t *testing.T) {
			w := NewWorld(nil)
			itemSlot := slot
			if slot == "ring1" || slot == "ring2" {
				itemSlot = "ring"
			}
			if slot == "trinket1" || slot == "trinket2" {
				itemSlot = "trinket"
			}
			item := Item{ID: "legal-gear", Type: ItemArmor, Slot: itemSlot, Stack: 1, Gems: []SocketedGem{{Stats: map[string]int{"intelligence": 7}}}}
			p := &Entity{ID: "legal-slot-player", Type: TypePlayer, Level: 30, BaseStats: Stats{Intelligence: 10}, Inventory: []Item{item}, Equipment: map[string]Item{}}
			w.AddEntity(p)
			if _, ok := w.PerformEquip(p.ID, item.ID, slot); !ok {
				t.Fatal("legal equipment rejected")
			}
			if p.Stats.Intelligence != 17 {
				t.Fatalf("socketed gem lost its bonus: %d", p.Stats.Intelligence)
			}
			if _, ok := w.PerformUnequip(p.ID, slot, item.ID); !ok {
				t.Fatal("legal unequip failed")
			}
			if !reflect.DeepEqual(p.Inventory[0], item) {
				t.Fatal("socketed equipment did not return intact")
			}
		})
	}
}
