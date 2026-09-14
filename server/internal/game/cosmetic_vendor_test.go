package game

import (
	"reflect"
	"testing"
)

func TestCosmeticVendorUnlocksOnlyAppearanceWithoutGoldOrPower(t *testing.T) {
	for _, offer := range CosmeticCatalogue() {
		t.Run(offer.ID, func(t *testing.T) {
			w, p := loadoutFixture()
			p.X, p.Z, p.EP, p.Gold = 12, 185, 100, 9_000_000
			before := w.GetEntityCopy(p.ID)
			bought, err := w.BuyCosmetic(p.ID, offer.ID, offer.PriceEP)
			if err != nil || !bought || p.EP != 100-offer.PriceEP || !p.UnjournaledSave {
				t.Fatal("purchase failed", err)
			}
			if p.AppearanceCollection[AppearanceKey(offer.Appearance)] != offer.Appearance {
				t.Fatal("missing permanent look receipt")
			}
			if p.Gold != before.Gold || p.Stats != before.Stats || p.Experience != before.Experience || p.ResonanceXP != before.ResonanceXP ||
				!reflect.DeepEqual(p.Inventory, before.Inventory) || !reflect.DeepEqual(p.Equipment, before.Equipment) || !reflect.DeepEqual(p.Stash, before.Stash) || len(p.Appearances) != 0 {
				t.Fatal("purchase changed items/power or auto-applied")
			}
			p.EP = 0 // A replay cannot depend on having enough EP to buy again.
			if bought, err = w.BuyCosmetic(p.ID, offer.ID, offer.PriceEP); err != nil || bought || p.EP != 0 {
				t.Fatal("duplicate unlock charged again", err)
			}
			p.Equipment[offer.Appearance.Slot] = Item{ID: "equipped-real-gear", Name: offer.Base, Slot: offer.Appearance.Slot, Type: ItemArmor}
			if offer.Appearance.Slot == "mainHand" || offer.Appearance.Slot == "offHand" {
				p.Equipment[offer.Appearance.Slot] = Item{ID: "equipped-real-gear", Name: offer.Base, Slot: offer.Appearance.Slot, Type: ItemWeapon}
			}
			if err := w.SelectAppearance(p.ID, offer.Appearance.Slot, AppearanceKey(offer.Appearance)); err != nil {
				t.Fatal("purchased look cannot be applied", err)
			}
			if p.Stats != before.Stats || p.Gold != before.Gold {
				t.Fatal("applying look changed power/currency")
			}
		})
	}
}

func TestCosmeticVendorRejectsRemotePoorStalePriceAndInventedOffers(t *testing.T) {
	for _, scenario := range []string{"remote", "poor", "gold-only", "dead", "instance", "stale-price", "invented"} {
		t.Run(scenario, func(t *testing.T) {
			w, p := loadoutFixture()
			p.X, p.Z, p.EP = 12, 185, 100
			offer := CosmeticCatalogue()[0]
			switch scenario {
			case "remote":
				p.X = -20
			case "poor":
				p.EP = offer.PriceEP - 1
			case "gold-only":
				p.EP, p.Gold = 0, 900_000_000
			case "dead":
				p.Health = 0
			case "instance":
				p.InstanceID = CasinoInstanceID
			case "stale-price":
				offer.PriceEP = 1
			case "invented":
				offer.ID = "power-potion"
			}
			ep, gold := p.EP, p.Gold
			if bought, err := w.BuyCosmetic(p.ID, offer.ID, offer.PriceEP); bought || err == nil || p.EP != ep || p.Gold != gold || len(p.AppearanceCollection) != 0 {
				t.Fatal("invalid purchase accepted or mutated currency", err)
			}
		})
	}
}

func TestCosmeticVendorCatalogueAndPhysicalIdentity(t *testing.T) {
	w, _ := loadoutFixture()
	vendor := w.GetEntityCopy(CosmeticVendorID)
	if vendor == nil || vendor.SubType != "CosmeticVendor" || vendor.InstanceID != "" || vendor.X != 12 || vendor.Z != 185 {
		t.Fatal("missing physical outfitter")
	}
	catalogue := CosmeticCatalogue()
	if len(catalogue) != 12 {
		t.Fatal("incomplete launch collection")
	}
	for _, offer := range catalogue {
		for _, base := range BaseItems {
			if base.Name == offer.Name {
				t.Fatal("cosmetic became a droppable/sellable base item")
			}
		}
		look, learned := appearanceForItem(Item{ID: "renamed-gear", Name: offer.Name, Slot: offer.Appearance.Slot, Type: ItemArmor, Rarity: RarityCommon})
		if learned && look == offer.Appearance {
			t.Fatal("item name bypassed purchased cosmetic ownership")
		}
	}
	catalogue[0].PriceEP = 0
	if CosmeticCatalogue()[0].PriceEP == 0 {
		t.Fatal("caller changed authoritative prices")
	}
}
