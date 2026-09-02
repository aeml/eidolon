package game

import "testing"

func TestSuccessfulEquipAndUnequipAdvanceEquipmentRevision(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:        "equipment-revision-player",
		Type:      TypePlayer,
		Level:     20,
		Equipment: map[string]Item{},
		Inventory: []Item{{
			ID:    "equipment-revision-sword",
			Name:  "Iron Sword",
			Type:  ItemWeapon,
			Slot:  "mainHand",
			Level: 10,
			Stats: map[string]int{"damage": 4},
		}},
	}
	w.AddEntity(player)

	updated, ok := w.PerformEquip(player.ID, "equipment-revision-sword", "mainHand")
	if !ok || updated.EquipmentRevision != 1 {
		t.Fatalf("equip must advance revision once: ok=%v revision=%d", ok, updated.EquipmentRevision)
	}
	if broadcast := w.copyEntity(updated); broadcast.EquipmentRevision != updated.EquipmentRevision {
		t.Fatalf("broadcast copy dropped equipment revision: got %d want %d", broadcast.EquipmentRevision, updated.EquipmentRevision)
	}

	updated, ok = w.PerformUnequip(player.ID, "mainHand")
	if !ok || updated.EquipmentRevision != 2 {
		t.Fatalf("unequip must advance revision once: ok=%v revision=%d", ok, updated.EquipmentRevision)
	}
}

func TestFailedEquipmentMutationDoesNotAdvanceRevision(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:                "failed-equipment-revision-player",
		Type:              TypePlayer,
		Level:             1,
		Equipment:         map[string]Item{},
		EquipmentRevision: 7,
		Inventory: []Item{{
			ID:    "too-high-sword",
			Name:  "Iron Sword",
			Type:  ItemWeapon,
			Slot:  "mainHand",
			Level: 100,
		}},
	}
	w.AddEntity(player)

	if _, ok := w.PerformEquip(player.ID, "too-high-sword", "mainHand"); ok {
		t.Fatal("level-gated equip unexpectedly succeeded")
	}
	if player.EquipmentRevision != 7 {
		t.Fatalf("failed equip changed revision: %d", player.EquipmentRevision)
	}
}

func TestSuccessfulForgeMutationsAdvanceEquipmentRevision(t *testing.T) {
	tests := []struct {
		name   string
		player *Entity
		mutate func(*World, *Entity) (bool, string)
	}{
		{
			name: "level upgrade",
			player: equipmentRevisionForgePlayer(
				Item{ID: "upgrade-sword", Name: "Iron Sword", Level: 1, Stats: map[string]int{"damage": 4}},
				[]Item{{ID: "upgrade-shard", Name: "Eidolon Shard", Stack: 1}},
			),
			mutate: func(w *World, player *Entity) (bool, string) {
				_, ok, message := w.PerformForgeUpgrade(player.ID, "mainHand", 1)
				return ok, message
			},
		},
		{
			name: "potency",
			player: equipmentRevisionForgePlayer(
				Item{ID: "potency-sword", Name: "Iron Sword", Stats: map[string]int{"damage": 4}},
				[]Item{{ID: "potency-heart", Name: "Eidolon Heart", Stack: 1}},
			),
			mutate: func(w *World, player *Entity) (bool, string) {
				_, ok, message := w.PerformForgePotency(player.ID, "mainHand")
				return ok, message
			},
		},
		{
			name: "socket",
			player: equipmentRevisionForgePlayer(
				Item{ID: "socket-sword", Name: "Iron Sword"},
				[]Item{
					{ID: "socket-heart", Name: "Eidolon Heart", Stack: 25},
					{ID: "socket-shard", Name: "Eidolon Shard", Stack: 250},
				},
			),
			mutate: func(w *World, player *Entity) (bool, string) {
				_, ok, message := w.PerformForgeSocket(player.ID, "mainHand")
				return ok, message
			},
		},
		{
			name: "gem insert",
			player: equipmentRevisionForgePlayer(
				Item{ID: "insert-sword", Name: "Iron Sword", Sockets: 1},
				[]Item{{
					ID: "insert-ruby", Name: "Ruby", Type: ItemGem,
					GemType: GemRuby, GemQuality: GemFlawless, Stats: map[string]int{"strength": 4},
				}},
			),
			mutate: func(w *World, player *Entity) (bool, string) {
				_, ok, message := w.PerformForgeInsertGem(player.ID, "mainHand", 0, 0)
				return ok, message
			},
		},
		{
			name: "gem removal",
			player: equipmentRevisionForgePlayer(Item{
				ID: "remove-sword", Name: "Iron Sword", Sockets: 1,
				Gems: []SocketedGem{{Type: GemRuby, Quality: GemFlawless}},
			}, nil),
			mutate: func(w *World, player *Entity) (bool, string) {
				_, ok, message := w.PerformForgeRemoveGem(player.ID, "mainHand", 0)
				return ok, message
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			w := NewWorld(nil)
			w.AddEntity(test.player)
			before := test.player.EquipmentRevision
			ok, message := test.mutate(w, test.player)
			if !ok {
				t.Fatalf("forge mutation failed: %s", message)
			}
			if test.player.EquipmentRevision != before+1 {
				t.Fatalf("forge mutation revision = %d, want %d", test.player.EquipmentRevision, before+1)
			}
		})
	}
}

func equipmentRevisionForgePlayer(equipment Item, inventory []Item) *Entity {
	return &Entity{
		ID:                "equipment-revision-forge-player",
		Type:              TypePlayer,
		Level:             100,
		EquipmentRevision: 10,
		Equipment:         map[string]Item{"mainHand": equipment},
		Inventory:         inventory,
	}
}
