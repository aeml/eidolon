package game

import (
	"reflect"
	"testing"
)

func TestWardrobeLearnsOnlyOwnedGearWithoutConsumingOrChangingStats(t *testing.T) {
	w, p := loadoutFixture()
	p.Inventory[0].Name = "Strong Iron Sword of Might"
	p.Stash = []Item{{ID: "robe", Name: "Brilliant Robes", Type: ItemArmor, Slot: "chest", Rarity: RarityRare, Stack: 1},
		{ID: "not-gear", Name: "Robes", Type: ItemMaterial, Slot: "chest", Stack: 1}}
	before := w.GetEntityCopy(p.ID)
	count, err := w.CollectOwnedAppearances(p.ID)
	if err != nil || count != 2 {
		t.Fatalf("collect: count=%d err=%v", count, err)
	}
	if !reflect.DeepEqual(p.Inventory, before.Inventory) || !reflect.DeepEqual(p.Stash, before.Stash) || p.Stats != before.Stats || p.Gold != before.Gold {
		t.Fatal("learning consumed gear or changed combat/economy")
	}
	if count, err = w.CollectOwnedAppearances(p.ID); err != nil || count != 0 {
		t.Fatal("repeat learning duplicated collection")
	}
	p.Inventory[0], p.Stash = Item{}, nil
	if err := w.SelectAppearance(p.ID, "mainHand", "Iron Sword|Common"); err != nil {
		t.Fatal("learned style lost after source item sale", err)
	}
	if p.Equipment["mainHand"].ID != before.Equipment["mainHand"].ID || p.Stats != before.Stats {
		t.Fatal("appearance replaced combat item")
	}
	if err := w.SelectAppearance(p.ID, "mainHand", ""); err != nil || len(p.Appearances) != 0 {
		t.Fatal("original appearance could not be restored")
	}
}

func TestWardrobeRejectsUnearnedWrongSlotAndUnsafeChanges(t *testing.T) {
	w, p := loadoutFixture()
	p.AppearanceCollection = map[string]EquipmentAppearance{"Robes|Rare": {BaseName: "Robes", Rarity: RarityRare, Slot: "chest"}}
	for _, selection := range [][2]string{{"mainHand", "Iron Sword|Eidolic"}, {"mainHand", "Robes|Rare"}, {"chest", "Robes|Rare"}, {"hidden", ""}} {
		if err := w.SelectAppearance(p.ID, selection[0], selection[1]); err == nil {
			t.Fatal("invalid selection accepted", selection)
		}
	}
	if len(p.Appearances) != 0 || p.EquipmentRevision != 0 {
		t.Fatal("rejected look mutated selection")
	}
	p.Z = 500
	if _, err := w.CollectOwnedAppearances(p.ID); err == nil {
		t.Fatal("learning outside town accepted")
	}
	if err := w.SelectAppearance(p.ID, "mainHand", ""); err == nil {
		t.Fatal("selection outside town accepted")
	}
}

func TestWardrobeCopiesDoNotLeakCollectionOrAliasSelection(t *testing.T) {
	w, p := loadoutFixture()
	look := EquipmentAppearance{BaseName: "Iron Sword", Rarity: RarityRare, Slot: "mainHand"}
	p.AppearanceCollection = map[string]EquipmentAppearance{AppearanceKey(look): look}
	p.Appearances = map[string]EquipmentAppearance{"mainHand": look}
	private := w.GetEntityCopy(p.ID)
	public := w.copyEntity(p)
	if len(public.AppearanceCollection) != 0 || public.Appearances["mainHand"] != look {
		t.Fatal("public snapshot leaked collection or omitted selected look")
	}
	delete(private.AppearanceCollection, AppearanceKey(look))
	delete(private.Appearances, "mainHand")
	delete(public.Appearances, "mainHand")
	if len(p.AppearanceCollection) != 1 || len(p.Appearances) != 1 {
		t.Fatal("snapshot aliases live wardrobe")
	}
}
