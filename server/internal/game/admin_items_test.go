package game

import (
	"reflect"
	"strings"
	"testing"
)

func TestAdminCanonicalItemsUseNormalDefinitions(t *testing.T) {
	seen := map[string]bool{}
	for _, definition := range AdminItemCatalog() {
		if seen[definition.ID] || definition.ID == "" {
			t.Fatal("catalog identity collision")
		}
		seen[definition.ID] = true
		rarities := []ItemRarity{RarityCommon, RarityUncommon, RarityRare, RarityLegendary}
		if definition.Material {
			rarities = []ItemRarity{RarityEidolic}
		}
		for _, rarity := range rarities {
			spec := AdminItemSpec{Item: definition.ID, Rarity: rarity, Level: 100, Quantity: 2}
			if definition.Material {
				spec.Level, spec.Quantity = 1, 1000
			}
			items, err := GenerateAdminItems(spec)
			if err != nil {
				t.Fatalf("%s: %v", definition.ID, err)
			}
			quantity := 0
			ids := map[string]bool{}
			for _, item := range items {
				if item.ID == "" || ids[item.ID] || item.Rarity != rarity || item.Level != spec.Level || item.StatScaleVersion != ItemStatScaleVersion || !strings.Contains(item.Name, definition.Name) {
					t.Fatalf("invalid generated item: %+v", item)
				}
				ids[item.ID] = true
				quantity += item.Stack
				if item.Potency != 0 || item.UniqueEffect != "" || len(item.Gems) != 0 {
					t.Fatal("factory created noncanonical enhancements")
				}
			}
			if quantity != spec.Quantity {
				t.Fatal("factory changed requested quantity")
			}
		}
	}
}

func TestAdminItemValidationRejectsUnsupportedAttributes(t *testing.T) {
	valid := AdminItemSpec{Item: "iron-sword", Rarity: RarityRare, Level: 70, Quantity: 1}
	for _, change := range []func(*AdminItemSpec){
		func(s *AdminItemSpec) { s.Item = "Iron Sword" },
		func(s *AdminItemSpec) { s.Item = "unknown" },
		func(s *AdminItemSpec) { s.Rarity = "rare" },
		func(s *AdminItemSpec) { s.Rarity = RarityEidolic },
		func(s *AdminItemSpec) { s.Level = 0 },
		func(s *AdminItemSpec) { s.Level = 101 },
		func(s *AdminItemSpec) { s.Quantity = 0 },
		func(s *AdminItemSpec) { s.Quantity = 26 },
		func(s *AdminItemSpec) { s.Item = "eidolon-shard" },
	} {
		spec := valid
		change(&spec)
		if items, err := GenerateAdminItems(spec); err == nil || items != nil {
			t.Fatalf("invalid spec generated items: %+v", spec)
		}
	}
	for _, quantity := range []int{0, 1001} {
		if err := (AdminItemSpec{Item: "eidolon-heart", Rarity: RarityEidolic, Level: 1, Quantity: quantity}).Validate(); err == nil {
			t.Fatal("unbounded material quantity accepted")
		}
	}
}

func TestAdminItemDeliveryAtomicCapacityReplayAndDetachedItems(t *testing.T) {
	id := "admin:" + strings.Repeat("a", 64)
	items, err := GenerateAdminItems(AdminItemSpec{Item: "iron-sword", Rarity: RarityRare, Level: 70, Quantity: 2})
	if err != nil {
		t.Fatal(err)
	}
	player := &Entity{Inventory: filledAuctionStorage(MaxInventorySize), Gold: 55, Health: 17}
	player.Inventory[0] = Item{}
	before := cloneItems(player.Inventory)
	if err := player.ApplyAdminItemDelivery(id, items); err == nil || !reflect.DeepEqual(before, player.Inventory) || len(player.ItemDeliveryReceipts) != 0 {
		t.Fatal("partial grant or receipt escaped full-inventory refusal")
	}
	player.Inventory[1] = Item{}
	if err := player.ApplyAdminItemDelivery(id, items); err != nil {
		t.Fatal(err)
	}
	if player.Gold != 55 || player.Health != 17 || len(player.Stash) != 0 || len(player.ItemDeliveryReceipts) != 1 {
		t.Fatal("delivery changed unrelated state")
	}
	player.Inventory[0].Stats["strength"] = 999
	if items[0].Stats["strength"] == 999 {
		t.Fatal("delivery retained journal item map alias")
	}
	player.Inventory[0], player.Inventory[1] = Item{}, Item{} // Consumed/sold after save.
	if err := player.ApplyAdminItemDelivery(id, items); err != nil || player.Inventory[0].ID != "" {
		t.Fatal("retry recreated a consumed item")
	}
	changed := cloneItems(items)
	changed[0].Level++
	if err := player.ApplyAdminItemDelivery(id, changed); err == nil {
		t.Fatal("same receipt accepted different items")
	}
}

func TestAdminMaterialDeliveryDoesNotLeakPartialStacks(t *testing.T) {
	items, err := GenerateAdminItems(AdminItemSpec{Item: "eidolon-shard", Rarity: RarityEidolic, Level: 1, Quantity: 100})
	if err != nil {
		t.Fatal(err)
	}
	player := &Entity{Inventory: filledAuctionStorage(MaxInventorySize)}
	player.Inventory[0] = cloneItem(items[0])
	player.Inventory[0].ID, player.Inventory[0].Stack = "existing-shards", 950
	id := "admin:" + strings.Repeat("b", 64)
	if err := player.ApplyAdminItemDelivery(id, items); err == nil || player.Inventory[0].Stack != 950 {
		t.Fatal("failed grant leaked a partial stack")
	}
	player.Inventory[1] = Item{}
	if err := player.ApplyAdminItemDelivery(id, items); err != nil || player.Inventory[0].Stack != 1000 || player.Inventory[1].Stack != 50 {
		t.Fatalf("valid stacked delivery failed: %v", err)
	}
	if err := player.ApplyAdminItemDelivery("not-a-receipt", items); err == nil {
		t.Fatal("invalid operation ID accepted")
	}
}
