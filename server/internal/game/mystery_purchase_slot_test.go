package game

import (
	"reflect"
	"testing"
)

func TestMysteryPurchaseSlotAllowsEquipmentAndLegacyAccessoryAliases(t *testing.T) {
	for _, slot := range []string{"head", "chest", "legs", "feet", "gloves", "shoulders", "belt", "neck", "mainHand", "offHand", "ring", "trinket", "ring1", "ring2", "trinket1", "trinket2"} {
		t.Run(slot, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("mystery-slot", "Fighter")
			p.Level, p.Gold = 100, 3500
			p.Inventory = make([]Item, MaxInventorySize)
			w.AddEntity(p)
			if _, bought := w.PerformBuyGamble(p.ID, slot); !bought || p.Gold != 0 || p.Inventory[0].ID == "" ||
				p.Inventory[0].Level != 100 || !equipmentItemType(p.Inventory[0]) {
				t.Fatal("legitimate mystery-equipment purchase was blocked or changed")
			}
		})
	}
}

func TestMysteryPurchaseSlotCannotPurchaseForgeMaterialsOrOtherPools(t *testing.T) {
	for _, slot := range []string{"material", "relic", "gem", "ep-wallet", "", "MAINHAND"} {
		t.Run(slot, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("mystery-invalid-slot", "Fighter")
			p.Level, p.Gold = 100, 3500
			p.Inventory = make([]Item, MaxInventorySize)
			before := append([]Item(nil), p.Inventory...)
			w.AddEntity(p)
			if _, bought := w.PerformBuyGamble(p.ID, slot); bought || p.Gold != 3500 || !reflect.DeepEqual(before, p.Inventory) {
				t.Fatal("forged mystery slot changed wallet or granted a non-equipment item")
			}
		})
	}
}
