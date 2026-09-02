package main

import (
	"reflect"
	"testing"

	"eidolon-server/internal/game"
)

func TestEquipmentChangesInvalidateRemoteEntitySnapshot(t *testing.T) {
	entity := &game.Entity{
		ID:          "fighter-observed",
		Type:        game.TypePlayer,
		SubType:     "Fighter",
		TalentRanks: map[string]int{},
		Equipment: map[string]game.Item{
			"mainHand": {
				ID:      "sword-1",
				Name:    "Iron Sword",
				Type:    game.ItemWeapon,
				Rarity:  game.RarityRare,
				Slot:    "mainHand",
				Level:   20,
				Potency: 1,
			},
		},
	}

	snapshot := entityToSnapshot(entity)
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("unchanged equipment should not invalidate the observer snapshot")
	}

	entity.Mu.Lock()
	item := entity.Equipment["mainHand"]
	item.Potency = 2
	entity.Equipment["mainHand"] = item
	entity.EquipmentRevision++
	entity.Mu.Unlock()
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("potency change must replicate to observing clients")
	}

	snapshot = entityToSnapshot(entity)
	entity.Mu.Lock()
	entity.Equipment["ring1"] = game.Item{
		ID:     "ring-1",
		Name:   "Ruby Ring",
		Type:   game.ItemAccessory,
		Rarity: game.RarityLegendary,
		Slot:   "ring",
		Level:  20,
		Gems: []game.SocketedGem{
			{Type: game.GemRuby, Quality: game.GemFlawless},
		},
	}
	entity.EquipmentRevision++
	entity.Mu.Unlock()
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("equipping a new slot must replicate to observing clients")
	}

	snapshot = entityToSnapshot(entity)
	entity.Mu.Lock()
	delete(entity.Equipment, "mainHand")
	entity.EquipmentRevision++
	entity.Mu.Unlock()
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("unequipping a slot must replicate to observing clients")
	}
}

func TestItemToProtoPreservesEquipmentIdentityAndSocketMetadata(t *testing.T) {
	item := game.Item{
		ID:               "oath-blade",
		Name:             "Hearty Iron Sword of the Whale",
		Type:             game.ItemWeapon,
		Rarity:           game.RarityLegendary,
		Slot:             "mainHand",
		Level:            100,
		Stats:            map[string]int{"damage": 20},
		Potency:          5,
		Sockets:          2,
		SetID:            "warlord_fury",
		UniqueEffect:     "swift",
		StatScaleVersion: game.ItemStatScaleVersion,
		Gems: []game.SocketedGem{
			{Type: game.GemRuby, Quality: game.GemFlawless, Stats: map[string]int{"strength": 4}},
		},
	}

	encoded := itemToProto(&item)
	if encoded.GetSetId() != item.SetID || encoded.GetUniqueEffect() != item.UniqueEffect {
		t.Fatalf("equipment identity metadata was dropped: %#v", encoded)
	}
	if int(encoded.GetStatScaleVersion()) != item.StatScaleVersion {
		t.Fatalf("stat scale version was dropped: %d", encoded.GetStatScaleVersion())
	}
	if len(encoded.GetGems()) != 1 || encoded.GetGems()[0].GetType() != string(game.GemRuby) ||
		!reflect.DeepEqual(encoded.GetGems()[0].GetStats(), map[string]int32{"strength": 4}) {
		t.Fatalf("socketed gem metadata was dropped: %#v", encoded.GetGems())
	}
}

func TestWorldEquipmentMutationFlowsThroughObserverDeltaAndProto(t *testing.T) {
	const observerRadius = 200.0
	w := game.NewWorld(nil)
	observer := &game.Entity{ID: "equipment-observer", Type: game.TypePlayer, TalentRanks: map[string]int{}}
	wearer := &game.Entity{
		ID:          "equipment-wearer",
		Type:        game.TypePlayer,
		SubType:     "Fighter",
		Level:       20,
		TalentRanks: map[string]int{},
		Equipment:   map[string]game.Item{},
		Inventory: []game.Item{{
			ID:     "observer-sword",
			Name:   "Iron Sword",
			Type:   game.ItemWeapon,
			Rarity: game.RarityRare,
			Slot:   "mainHand",
			Level:  10,
		}},
	}
	w.AddEntity(observer)
	w.AddEntity(wearer)

	state := w.GetStateForPlayer(observer.ID, observerRadius)
	snapshot := entityToSnapshot(state[wearer.ID])
	if _, ok := w.PerformEquip(wearer.ID, "observer-sword", "mainHand"); !ok {
		t.Fatal("world equip failed")
	}

	state = w.GetStateForPlayer(observer.ID, observerRadius)
	if !hasEntityChanged(state[wearer.ID], snapshot) {
		t.Fatal("successful world equip did not invalidate the observer delta")
	}
	encoded := entityToProto(state[wearer.ID])
	if encoded.GetEquipment()["mainHand"].GetId() != "observer-sword" {
		t.Fatalf("observer proto omitted equipped item: %#v", encoded.GetEquipment())
	}

	snapshot = entityToSnapshot(state[wearer.ID])
	if _, ok := w.PerformUnequip(wearer.ID, "mainHand"); !ok {
		t.Fatal("world unequip failed")
	}
	state = w.GetStateForPlayer(observer.ID, observerRadius)
	if !hasEntityChanged(state[wearer.ID], snapshot) {
		t.Fatal("successful world unequip did not invalidate the observer delta")
	}
	if got := len(entityToProto(state[wearer.ID]).GetEquipment()); got != 0 {
		t.Fatalf("observer proto retained %d items after final-slot unequip", got)
	}
}
