package game

import (
	"math"
	"reflect"
	"testing"
)

func TestClassEquipmentRestrictions(t *testing.T) {
	for _, tc := range []struct {
		class, name, slot string
		kind              ItemType
		allowed           bool
	}{
		{"Wizard", "Robes", "chest", ItemArmor, true}, {"Wizard", "Leather Tunic", "chest", ItemArmor, false},
		{"Wizard", "Plate Mail", "chest", ItemArmor, false}, {"Wizard", "Sandals", "feet", ItemArmor, true},
		{"Rogue", "Leather Tunic", "chest", ItemArmor, true}, {"Rogue", "Plate Mail", "chest", ItemArmor, false},
		{"Fighter", "Plate Mail", "chest", ItemArmor, true}, {"Cleric", "Plate Mail", "chest", ItemArmor, true},
		{"Rogue", "Wooden Staff", "mainHand", ItemWeapon, false}, {"Rogue", "Cleric Mace", "mainHand", ItemWeapon, true},
		{"Rogue", "Wooden Shield", "offHand", ItemArmor, false}, {"Rogue", "Spell Tome", "offHand", ItemArmor, false},
		{"Wizard", "Spell Tome", "offHand", ItemArmor, true}, {"Cleric", "Wooden Staff", "mainHand", ItemWeapon, true},
	} {
		t.Run(tc.class+tc.name, func(t *testing.T) {
			item := Item{ID: "gear", Name: "Rare " + tc.name + " of Might", Type: tc.kind, Slot: tc.slot, Stack: 1}
			w := NewWorld(nil)
			p := &Entity{ID: "actor", Type: TypePlayer, SubType: tc.class, Level: 30, Inventory: []Item{item}, Equipment: map[string]Item{}}
			w.AddEntity(p)
			_, ok := w.PerformEquip(p.ID, item.ID, tc.slot)
			if ok != tc.allowed {
				t.Fatalf("equip=%v, want %v", ok, tc.allowed)
			}
			if !ok && (!reflect.DeepEqual(p.Inventory, []Item{item}) || len(p.Equipment) != 0 || p.EquipmentRevision != 0) {
				t.Fatal("rejected equip changed ownership")
			}
		})
	}
}

func TestRogueDualWieldCadenceAndRecovery(t *testing.T) {
	w := NewWorld(nil)
	weapon := Item{ID: "offhand", Name: "Steel Dagger", Type: ItemWeapon, Slot: "mainHand", Stack: 1}
	p := &Entity{ID: "dual", Type: TypePlayer, SubType: "Rogue", Level: 30, Inventory: []Item{weapon}, Equipment: map[string]Item{"mainHand": {ID: "main", Name: "Iron Sword", Type: ItemWeapon, Slot: "mainHand"}}}
	w.AddEntity(p)
	p.RecalculateStats()
	normal := p.AttackSpeed
	if _, ok := w.PerformEquip(p.ID, weapon.ID, "offHand"); !ok {
		t.Fatal("weapon rejected from Rogue offhand")
	}
	for i := 0; i < 3; i++ {
		p.RecalculateStats()
		if math.Abs(p.AttackSpeed-normal*2/3) > 1e-6 {
			t.Fatal("dual cadence incorrect or compounded")
		}
	}
	if _, ok := w.PerformUnequip(p.ID, "offHand"); !ok {
		t.Fatal("offhand weapon recovery failed")
	}
	if math.Abs(p.AttackSpeed-normal) > 1e-6 {
		t.Fatal("single weapon cadence not restored")
	}
}

func TestForbiddenSavedArmorInactiveButRecoverable(t *testing.T) {
	p := &Entity{ID: "saved", Type: TypePlayer, SubType: "Wizard", Level: 30, Equipment: map[string]Item{}}
	p.RecalculateStats()
	baseline := p.Stats
	armor := Item{ID: "old", Name: "Plate Mail", Type: ItemArmor, Slot: "chest", Stats: map[string]int{"intelligence": 1000}, UniqueEffect: "swift"}
	p.Equipment["chest"] = armor
	p.RecalculateStats()
	if p.Stats != baseline || len(p.ActiveUniqueEffects) != 0 || !reflect.DeepEqual(p.Equipment["chest"], armor) {
		t.Fatal("forbidden armor grants power or was deleted")
	}
}

func TestClassRestrictionCannotBeBypassedByLoadout(t *testing.T) {
	w, p := loadoutFixture()
	p.SubType = "Wizard"
	armor := Item{ID: "forbidden-plate", Name: "Plate Mail", Type: ItemArmor, Slot: "chest", Stack: 1}
	p.Inventory = []Item{armor}
	p.EquipmentLoadouts[0] = EquipmentLoadout{Name: "Old armor", Class: "Wizard", Equipment: map[string]string{"chest": armor.ID}, Hotbar: []string{"", "", "", ""}}
	beforeInventory := append([]Item(nil), p.Inventory...)
	beforeEquipment := CloneEquipmentLoadouts(p.EquipmentLoadouts)
	beforeGold, beforeRevision := p.Gold, p.EquipmentRevision
	if _, err := w.ApplyEquipmentLoadout(p.ID, 0); err == nil {
		t.Fatal("loadout bypassed class restriction")
	}
	if !reflect.DeepEqual(p.Inventory, beforeInventory) || !reflect.DeepEqual(p.EquipmentLoadouts, beforeEquipment) || p.Gold != beforeGold || p.EquipmentRevision != beforeRevision {
		t.Fatal("failed loadout mutated ownership")
	}
	p.Equipment["chest"] = armor
	if err := w.SaveEquipmentLoadout(p.ID, 1, "Invalid", []string{"", "", "", ""}); err == nil {
		t.Fatal("forbidden saved gear accepted in new loadout")
	}
}
