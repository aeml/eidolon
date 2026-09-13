package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"go.mongodb.org/mongo-driver/bson"
	"google.golang.org/protobuf/proto"
)

func TestWardrobePersistsAndReplicatesSeparateFromEquipment(t *testing.T) {
	look := game.EquipmentAppearance{BaseName: "Silk Hood", Rarity: game.RarityRare, Slot: "head"}
	p := &game.Entity{ID: "wardrobe-hero", Type: game.TypePlayer, Appearances: map[string]game.EquipmentAppearance{"head": look},
		AppearanceCollection: map[string]game.EquipmentAppearance{game.AppearanceKey(look): look},
		Equipment:            map[string]game.Item{"head": {ID: "combat-helm", Name: "Iron Helm", Stats: map[string]int{"defense": 99}}}}
	snapshot := characterSnapshot("hero", p, time.Now())
	stored, err := bson.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if err := bson.Unmarshal(stored, snapshot); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(gameAppearances(snapshot.Appearances), p.Appearances) || !reflect.DeepEqual(gameAppearances(snapshot.AppearanceCollection), p.AppearanceCollection) {
		t.Fatal("wardrobe persistence lost choices")
	}
	wire, err := proto.Marshal(entityToProto(p))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(wire, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Appearances["head"].BaseName != "Silk Hood" || decoded.Equipment["head"].Name != "Iron Helm" || decoded.Equipment["head"].Stats["defense"] != 99 {
		t.Fatal("wire merged cosmetics into combat item")
	}
	before := entityToSnapshot(p)
	p.Appearances = map[string]game.EquipmentAppearance{}
	p.EquipmentRevision++
	if !hasEntityChanged(p, before) || len(entityToProto(p).Appearances) != 0 {
		t.Fatal("reset not published through delta path")
	}
}
