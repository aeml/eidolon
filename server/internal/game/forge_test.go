package game

import "testing"

func TestPerformForgePotencyConsumesHeartStacks(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-forge-1",
		Type: TypePlayer,
		Equipment: map[string]Item{
			"mainHand": {
				ID:      "staff-1",
				Name:    "Wizard Staff",
				Potency: 2,
				Stats:   map[string]int{"damage": 120},
				Value:   100,
			},
		},
		Inventory: []Item{{
			ID:    "heart-stack",
			Name:  "Eidolon Heart",
			Stack: 5,
		}},
	}
	w.AddEntity(player)

	updated, ok, msg := w.PerformForgePotency(player.ID, "mainHand")
	if !ok {
		t.Fatalf("PerformForgePotency failed: %s", msg)
	}
	if updated.Equipment["mainHand"].Potency != 3 {
		t.Fatalf("expected potency 3, got %d", updated.Equipment["mainHand"].Potency)
	}
	if len(updated.Inventory) != 1 || updated.Inventory[0].Stack != 1 {
		t.Fatalf("expected one remaining heart, got %+v", updated.Inventory)
	}
}

func TestPerformForgePotencyAcceptsLegacyHeartName(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-forge-2",
		Type: TypePlayer,
		Equipment: map[string]Item{
			"mainHand": {
				ID:      "blade-1",
				Name:    "Knight Blade",
				Potency: 0,
				Stats:   map[string]int{"damage": 20},
				Value:   50,
			},
		},
		Inventory: []Item{{
			ID:   "legacy-heart",
			Name: "Heart",
		}},
	}
	w.AddEntity(player)

	updated, ok, msg := w.PerformForgePotency(player.ID, "mainHand")
	if !ok {
		t.Fatalf("PerformForgePotency failed: %s", msg)
	}
	if updated.Equipment["mainHand"].Potency != 1 {
		t.Fatalf("expected potency 1, got %d", updated.Equipment["mainHand"].Potency)
	}
	if len(updated.Inventory) != 0 {
		t.Fatalf("expected heart to be consumed, got %+v", updated.Inventory)
	}
}

func TestPerformForgeSocketAcceptsLegacyHeartAndShardNames(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-forge-3",
		Type: TypePlayer,
		Equipment: map[string]Item{
			"offHand": {
				ID:      "shield-1",
				Name:    "Guardian Shield",
				Sockets: 0,
			},
		},
		Inventory: []Item{
			{ID: "legacy-heart-stack", Name: "Heart", Stack: 25},
			{ID: "legacy-shard-stack", Name: "Shard", Stack: 250},
		},
	}
	w.AddEntity(player)

	updated, ok, msg := w.PerformForgeSocket(player.ID, "offHand")
	if !ok {
		t.Fatalf("PerformForgeSocket failed: %s", msg)
	}
	if updated.Equipment["offHand"].Sockets != 1 {
		t.Fatalf("expected sockets 1, got %d", updated.Equipment["offHand"].Sockets)
	}
	if len(updated.Inventory) != 0 {
		t.Fatalf("expected forge materials consumed, got %+v", updated.Inventory)
	}
}
