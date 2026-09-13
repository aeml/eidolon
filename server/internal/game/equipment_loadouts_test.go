package game

import (
	"reflect"
	"testing"
	"time"
)

func loadoutFixture() (*World, *Entity) {
	p := &Entity{ID: "loadout-player", Type: TypePlayer, SubType: "Fighter", Level: 30,
		X: 0, Z: 200, State: "IDLE", Health: 25, Mana: 7,
		BaseStats:         Stats{Vitality: 20, Strength: 20, Intelligence: 20},
		Equipment:         map[string]Item{"mainHand": {ID: "old-sword", Type: ItemWeapon, Slot: "mainHand", Stack: 1}},
		Inventory:         []Item{{ID: "new-sword", Type: ItemWeapon, Slot: "mainHand", Stack: 1, Stats: map[string]int{"vitality": 20}}},
		EquipmentLoadouts: []EquipmentLoadout{{Name: "Adventure", Class: "Fighter", Equipment: map[string]string{"mainHand": "new-sword"}, Hotbar: []string{"Charge", "", "", ""}}}}
	p.RecalculateStats()
	w := NewWorld(nil)
	w.AddEntity(p)
	return w, p
}

func TestLoadoutFullBagSwapConservesGearAndDepletedResources(t *testing.T) {
	w, p := loadoutFixture()
	health, mana := p.Health, p.Mana
	oldGear, newGear := p.Equipment["mainHand"], p.Inventory[0]
	profile, err := w.ApplyEquipmentLoadout(p.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(p.Equipment["mainHand"], newGear) || !reflect.DeepEqual(p.Inventory[0], oldGear) {
		t.Fatal("swap lost item identity or stats")
	}
	if p.Health != health || p.Mana != mana || p.EquipmentRevision != 1 {
		t.Fatal("swap healed or did not update equipment revision")
	}
	profile.Equipment["mainHand"] = "forged"
	profile.Hotbar[0] = "forged"
	if p.EquipmentLoadouts[0].Equipment["mainHand"] != newGear.ID || p.EquipmentLoadouts[0].Hotbar[0] != "Charge" {
		t.Fatal("result aliases server preset")
	}
}

func TestLoadoutRingExchangeNeedsNoFreeBagSlot(t *testing.T) {
	w, p := loadoutFixture()
	p.Equipment = map[string]Item{"ring1": {ID: "a", Slot: "ring", Stack: 1}, "ring2": {ID: "b", Slot: "ring", Stack: 1}}
	p.EquipmentLoadouts[0].Equipment = map[string]string{"ring1": "b", "ring2": "a"}
	before := cloneItems(p.Inventory)
	if _, err := w.ApplyEquipmentLoadout(p.ID, 0); err != nil {
		t.Fatal(err)
	}
	if p.Equipment["ring1"].ID != "b" || p.Equipment["ring2"].ID != "a" || !reflect.DeepEqual(before, p.Inventory) {
		t.Fatal("ring exchange changed ownership")
	}
}

func TestLoadoutRejectsInvalidSwapWithoutPartialMutation(t *testing.T) {
	cases := map[string]func(*Entity){
		"missing":             func(p *Entity) { p.EquipmentLoadouts[0].Equipment["mainHand"] = "sold" },
		"stashed":             func(p *Entity) { p.Stash = cloneItems(p.Inventory); p.Inventory[0] = Item{} },
		"duplicate ownership": func(p *Entity) { p.Inventory = append(p.Inventory, p.Inventory[0]) },
		"duplicate reference": func(p *Entity) { p.EquipmentLoadouts[0].Equipment["offHand"] = "new-sword" },
		"wrong slot":          func(p *Entity) { p.Inventory[0].Slot = "head" },
		"stacked":             func(p *Entity) { p.Inventory[0].Stack = 2 },
		"level":               func(p *Entity) { p.Inventory[0].Level = 100 },
		"full bag unequip":    func(p *Entity) { p.EquipmentLoadouts[0].Equipment = map[string]string{} },
		"locked skill":        func(p *Entity) { p.EquipmentLoadouts[0].Hotbar[0] = "Meteor" },
		"class":               func(p *Entity) { p.EquipmentLoadouts[0].Class = "Wizard" },
		"legacy hidden slot":  func(p *Entity) { p.Equipment["hidden"] = p.Inventory[0]; p.Inventory[0] = Item{} },
		"dead":                func(p *Entity) { p.Health = 0 },
		"outside town":        func(p *Entity) { p.Z = 301 },
		"dungeon":             func(p *Entity) { p.InstanceID = "dungeon" },
		"recent combat":       func(p *Entity) { p.LastAttackTime = time.Now() },
		"charging":            func(p *Entity) { p.IsCharging = true },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			w, p := loadoutFixture()
			mutate(p)
			before := w.GetEntityCopy(p.ID)
			if _, err := w.ApplyEquipmentLoadout(p.ID, 0); err == nil {
				t.Fatal("invalid swap accepted")
			}
			if !reflect.DeepEqual(before.Inventory, p.Inventory) || !reflect.DeepEqual(before.Equipment, p.Equipment) ||
				p.EquipmentRevision != before.EquipmentRevision || p.Health != before.Health || p.Mana != before.Mana {
				t.Fatal("rejected swap partially changed character")
			}
		})
	}
}

func TestLoadoutSaveCapturesOwnedIDsAndCopiesSnapshots(t *testing.T) {
	w, p := loadoutFixture()
	if err := w.SaveEquipmentLoadout(p.ID, 2, "  My kit  ", []string{"Charge"}); err != nil {
		t.Fatal(err)
	}
	profile := p.EquipmentLoadouts[2]
	if profile.Name != "My kit" || profile.Equipment["mainHand"] != "old-sword" || len(profile.Hotbar) != 4 {
		t.Fatal("save did not capture equipment and skills")
	}
	snapshot := w.GetEntityCopy(p.ID)
	snapshot.EquipmentLoadouts[2].Equipment["mainHand"] = "fake"
	snapshot.EquipmentLoadouts[2].Hotbar[0] = "fake"
	if p.EquipmentLoadouts[2].Equipment["mainHand"] != "old-sword" || p.EquipmentLoadouts[2].Hotbar[0] != "Charge" {
		t.Fatal("snapshot aliases live presets")
	}
	for _, index := range []int{-1, 3} {
		if err := w.SaveEquipmentLoadout(p.ID, index, "Invalid", nil); err == nil {
			t.Fatal("invalid slot accepted")
		}
	}
	for _, name := range []string{"", "\n", "bad\x00name"} {
		if err := w.SaveEquipmentLoadout(p.ID, 0, name, nil); err == nil {
			t.Fatal("invalid name accepted")
		}
	}
}
