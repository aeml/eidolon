package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"go.mongodb.org/mongo-driver/bson"
	"google.golang.org/protobuf/proto"
)

func TestForgeBasisSurvivesSnapshotBSONAndContinuedUpgrades(t *testing.T) {
	w := game.NewWorld(nil)
	p := &game.Entity{ID: "saved-forge", Type: game.TypePlayer, SubType: "Wizard", Level: 100,
		Equipment: map[string]game.Item{"mainHand": {ID: "staff", Level: 1, Stats: map[string]int{"damage": 1}, Value: 10, StatScaleVersion: game.ItemStatScaleVersion}},
		Inventory: []game.Item{{ID: "shards", Name: "Eidolon Shard", Stack: 1000, MaxStack: 1000}},
	}
	w.AddEntity(p)
	for i := 0; i < 99; i++ {
		if _, ok, message := w.PerformForgeUpgrade(p.ID, "mainHand", 1); !ok {
			t.Fatal(message)
		}
		item := p.Equipment["mainHand"]
		// Every saved container must retain this metadata, not just equipment.
		p.Stash, p.Buyback = []game.Item{item}, []game.Item{item}
		snapshot := characterSnapshot("saved-forge", p, time.Now())
		snapshot.Inventory = append(snapshot.Inventory, databaseItem(item))
		encoded, err := bson.Marshal(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		var saved database.Character
		if err := bson.Unmarshal(encoded, &saved); err != nil {
			t.Fatal(err)
		}
		for _, dbItem := range []database.Item{saved.Equipment["mainHand"], saved.Stash[0], saved.Buyback[0], saved.Inventory[len(saved.Inventory)-1]} {
			loaded := gameItemFromDatabase(dbItem)
			if !reflect.DeepEqual(loaded.ForgeBasis, item.ForgeBasis) || !reflect.DeepEqual(loaded.Stats, item.Stats) {
				t.Fatalf("forge basis lost on round trip: %+v", loaded)
			}
		}
		p.Equipment["mainHand"] = gameItemFromDatabase(saved.Equipment["mainHand"])
	}
	if item := p.Equipment["mainHand"]; item.Stats["damage"] != 13 || item.Value != 139 {
		t.Fatalf("repeated reconnects discarded progress: %+v", item)
	}
	// A snapshot's nested basis cannot alias later mutable state.
	snapshot := characterSnapshot("saved-forge", p, time.Now())
	p.Equipment["mainHand"].ForgeBasis.Stats["damage"] = 999
	if snapshot.Equipment["mainHand"].ForgeBasis.Stats["damage"] != 1 {
		t.Fatal("snapshot shares mutable forge basis")
	}
}

func TestForgeBasisIsIncludedInEquipmentProtocol(t *testing.T) {
	w := game.NewWorld(nil)
	p := &game.Entity{ID: "wire-forge", Type: game.TypePlayer, Level: 100,
		Equipment: map[string]game.Item{"mainHand": {ID: "staff", Level: 1, Stats: map[string]int{"damage": 1}, Value: 10}},
		Inventory: []game.Item{{ID: "shards", Name: "Eidolon Shard", Stack: 100}},
	}
	w.AddEntity(p)
	if _, ok, message := w.PerformForgeUpgrade(p.ID, "mainHand", 10); !ok {
		t.Fatal(message)
	}
	item := p.Equipment["mainHand"]
	encoded, err := proto.Marshal(itemToProto(&item))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Item
	if err := proto.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	basis := decoded.GetForgeBasis()
	if basis == nil || basis.GetLevel() != 1 || basis.GetPotency() != 0 || basis.GetStats()["damage"] != 1 || basis.GetValue() != 10 {
		t.Fatalf("client cannot reconstruct precise preview: %+v", basis)
	}
}
