package game

import (
	"reflect"
	"testing"
)

func outfitOffer(t *testing.T) CosmeticOffer {
	t.Helper()
	for _, offer := range CosmeticCatalogue() {
		if offer.Kind == "outfit" {
			return offer
		}
	}
	t.Fatal("missing complete garment")
	return CosmeticOffer{}
}

func TestWardrobeFullOutfitPreservesGearStatsAndIndependentAppearances(t *testing.T) {
	w, p := loadoutFixture()
	look := outfitOffer(t).Appearance
	if err := w.SelectAppearance(p.ID, "outfit", AppearanceKey(look)); err == nil {
		t.Fatal("unowned full outfit was selected")
	}
	p.AppearanceCollection = map[string]EquipmentAppearance{AppearanceKey(look): look}
	p.Appearances = map[string]EquipmentAppearance{
		"chest":    {BaseName: "Robes", Rarity: RarityRare, Slot: "chest"},
		"mainHand": {BaseName: "Iron Sword", Rarity: RarityCommon, Slot: "mainHand"},
	}
	before := w.GetEntityCopy(p.ID)
	if err := w.SelectAppearance(p.ID, "outfit", AppearanceKey(look)); err != nil {
		t.Fatal(err)
	}
	if p.Appearances["outfit"] != look || p.Appearances["chest"] != before.Appearances["chest"] || p.Appearances["mainHand"] != before.Appearances["mainHand"] {
		t.Fatal("full garment overwrote independent appearance choices")
	}
	if !reflect.DeepEqual(p.Equipment, before.Equipment) || !reflect.DeepEqual(p.Inventory, before.Inventory) || p.Stats != before.Stats || p.Gold != before.Gold || p.EP != before.EP {
		t.Fatal("garment changed equipment, power or wallet")
	}
	if err := w.SelectAppearance(p.ID, "outfit", ""); err != nil || !reflect.DeepEqual(p.Appearances, before.Appearances) {
		t.Fatal("removing garment lost retained appearances", err)
	}
}

func TestWardrobeFullOutfitDoesNotRequireOrCreateArmorItems(t *testing.T) {
	w, p := loadoutFixture()
	p.Equipment = map[string]Item{}
	look := outfitOffer(t).Appearance
	p.AppearanceCollection = map[string]EquipmentAppearance{AppearanceKey(look): look}
	if err := w.SelectAppearance(p.ID, "outfit", AppearanceKey(look)); err != nil || len(p.Equipment) != 0 {
		t.Fatal("complete outfit required or created real armor", err)
	}
	for _, slot := range []string{"chest", "head", "mainHand", "offHand"} {
		if err := w.SelectAppearance(p.ID, slot, AppearanceKey(look)); err == nil {
			t.Fatal("full outfit accepted as an individual equipment look", slot)
		}
	}
}

func TestWardrobeFullOutfitRejectsForgedCatalogDescriptorsAndUnsafeChanges(t *testing.T) {
	w, p := loadoutFixture()
	legitimate := outfitOffer(t).Appearance
	for _, forged := range []EquipmentAppearance{
		{BaseName: legitimate.BaseName, Slot: "outfit", Rarity: RarityLegendary},
		{BaseName: "Iron Sword", Slot: "outfit", Rarity: RarityCommon},
		{BaseName: "Invented garment", Slot: "outfit", Rarity: RarityCommon},
	} {
		p.AppearanceCollection = map[string]EquipmentAppearance{AppearanceKey(forged): forged}
		if err := w.SelectAppearance(p.ID, "outfit", AppearanceKey(forged)); err == nil {
			t.Fatal("forged collection descriptor selected", forged)
		}
	}
	p.AppearanceCollection = map[string]EquipmentAppearance{AppearanceKey(legitimate): legitimate}
	p.X = 1000
	if err := w.SelectAppearance(p.ID, "outfit", AppearanceKey(legitimate)); err == nil {
		t.Fatal("outfit changed outside safe town access")
	}
}
