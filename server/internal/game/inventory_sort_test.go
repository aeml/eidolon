package game

import "testing"

func TestPerformInventorySortOrdersPriorityGroups(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-sort-1",
		Type: TypePlayer,
		Inventory: []Item{
			{ID: "weapon-1", Name: "Iron Sword", Type: ItemWeapon, Rarity: RarityCommon, Level: 1},
			{ID: "gem-1", Name: "Flawed Ruby", Type: ItemGem, GemType: GemRuby, GemQuality: GemFlawed, Rarity: RarityRare, Level: 1},
			{ID: "heart-1", Name: "Eidolon Heart", Type: ItemRelic, Rarity: RarityEidolic, Level: 1},
			{},
			{ID: "shard-1", Name: "Eidolon Shard", Type: ItemMaterial, Rarity: RarityEidolic, Level: 1},
		},
	}
	w.AddEntity(player)

	updated, ok := w.PerformInventorySort(player.ID)
	if !ok {
		t.Fatal("PerformInventorySort returned false")
	}

	got := []string{updated.Inventory[0].Name, updated.Inventory[1].Name, updated.Inventory[2].Name, updated.Inventory[3].Name}
	want := []string{"Eidolon Heart", "Eidolon Shard", "Flawed Ruby", "Iron Sword"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("slot %d: got %q want %q", i, got[i], want[i])
		}
	}
	if updated.Inventory[4].ID != "" {
		t.Fatalf("expected last slot empty, got %+v", updated.Inventory[4])
	}
}

func TestPerformSellPreservesSortedInventoryOrder(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-sort-sell-1",
		Type: TypePlayer,
		Inventory: []Item{
			{ID: "weapon-1", Name: "Iron Sword", Type: ItemWeapon, Rarity: RarityCommon, Level: 1, Value: 10},
			{ID: "heart-1", Name: "Eidolon Heart", Type: ItemRelic, Rarity: RarityEidolic, Level: 1, Value: 5},
			{},
		},
	}
	w.AddEntity(player)

	if _, ok := w.PerformInventorySort(player.ID); !ok {
		t.Fatal("PerformInventorySort returned false")
	}
	if player.Inventory[0].ID != "heart-1" || player.Inventory[1].ID != "weapon-1" {
		t.Fatalf("expected sorted inventory [heart, weapon], got [%q, %q]", player.Inventory[0].ID, player.Inventory[1].ID)
	}

	updated, ok := w.PerformSell(player.ID, "heart-1")
	if !ok {
		t.Fatal("PerformSell returned false")
	}
	if updated.Inventory[0].ID != "weapon-1" {
		t.Fatalf("expected weapon to shift into first sorted slot after sell, got %q", updated.Inventory[0].ID)
	}
	if updated.Inventory[1].ID != "" {
		t.Fatalf("expected second slot empty after sell, got %+v", updated.Inventory[1])
	}
}
