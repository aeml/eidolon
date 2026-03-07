package game

import "testing"

func TestPerformSellAddsLegendaryToBuyback(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-shop-1",
		Type: TypePlayer,
		Gold: 10,
		Inventory: []Item{{
			ID:     "item-legendary-1",
			Name:   "Phoenix Blade",
			Rarity: RarityLegendary,
			Value:  125,
			Stack:  2,
		}},
	}
	w.AddEntity(player)

	updated, ok := w.PerformSell(player.ID, "item-legendary-1")
	if !ok {
		t.Fatal("PerformSell returned false")
	}
	if updated.Gold != 260 {
		t.Fatalf("expected gold 260, got %d", updated.Gold)
	}
	if len(updated.Buyback) != 1 {
		t.Fatalf("expected 1 buyback item, got %d", len(updated.Buyback))
	}
	if updated.Buyback[0].ID != "item-legendary-1" {
		t.Fatalf("unexpected buyback item id %q", updated.Buyback[0].ID)
	}
	if updated.Inventory[0].ID != "" {
		t.Fatalf("expected sold inventory slot to be cleared, got %q", updated.Inventory[0].ID)
	}
}

func TestPerformBuybackRestoresItemToInventory(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-shop-2",
		Type: TypePlayer,
		Gold: 500,
		Inventory: []Item{{
			ID: "existing-item",
		}},
		Buyback: []Item{{
			ID:     "item-legendary-2",
			Name:   "Sunforged Crown",
			Rarity: RarityLegendary,
			Value:  200,
			Stack:  1,
		}},
	}
	w.AddEntity(player)

	updated, ok := w.PerformBuyback(player.ID, "item-legendary-2")
	if !ok {
		t.Fatal("PerformBuyback returned false")
	}
	if updated.Gold != 300 {
		t.Fatalf("expected gold 300, got %d", updated.Gold)
	}
	if len(updated.Buyback) != 0 {
		t.Fatalf("expected empty buyback list, got %d", len(updated.Buyback))
	}
	if len(updated.Inventory) != 2 {
		t.Fatalf("expected inventory length 2, got %d", len(updated.Inventory))
	}
	if updated.Inventory[1].ID != "item-legendary-2" {
		t.Fatalf("expected bought back item appended to inventory, got %q", updated.Inventory[1].ID)
	}
}
