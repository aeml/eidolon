package main

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"go.mongodb.org/mongo-driver/bson"
	"google.golang.org/protobuf/proto"
)

func TestWardrobeClaimRejectsUnverifiedSeasonHistory(t *testing.T) {
	c, committer, _ := epWalletFixture(t)
	oldDB := db
	db = nil
	t.Cleanup(func() { db = oldDB })
	p := world.Entities[c.playerID]
	p.Equipment = map[string]game.Item{"neck": {ID: "owned-pendant", Name: "Pendant", Slot: "neck", Type: game.ItemNeck}}
	before := world.GetEntityCopy(c.playerID)
	c.handleWardrobe(Message{Type: MsgCollectAppearances, Payload: json.RawMessage(`{"medal":"Gold","season":"2026-Q3","settledAt":123,"rating":9999}`)})
	var message Message
	var result struct {
		Success  bool   `json:"success"`
		Message  string `json:"message"`
		PlayerID string `json:"playerID"`
	}
	select {
	case data := <-c.send:
		if err := json.Unmarshal(data, &message); err != nil || message.Type != MsgWardrobeResult {
			t.Fatal("missing wardrobe result", err)
		}
		if err := json.Unmarshal(message.Payload, &result); err != nil || result.PlayerID != c.playerID || result.Success || result.Message != "arena profile service unavailable" {
			t.Fatal("unverified claim acknowledged", result, err)
		}
	default:
		t.Fatal("missing claim failure")
	}
	if !reflect.DeepEqual(before, world.GetEntityCopy(c.playerID)) || committer.saved != nil {
		t.Fatal("failed history verification changed or saved a character")
	}
}

func TestWardrobePersistsAndReplicatesSeparateFromEquipment(t *testing.T) {
	look := game.EquipmentAppearance{BaseName: "Silk Hood", Rarity: game.RarityRare, Slot: "head"}
	medallion := game.SeasonCosmeticCatalogue()[2].Appearance
	p := &game.Entity{ID: "wardrobe-hero", Type: game.TypePlayer, Appearances: map[string]game.EquipmentAppearance{"head": look},
		AppearanceCollection: map[string]game.EquipmentAppearance{game.AppearanceKey(look): look},
		Equipment:            map[string]game.Item{"head": {ID: "combat-helm", Name: "Iron Helm", Stats: map[string]int{"defense": 99}}}}
	p.Appearances["neck"] = medallion
	p.AppearanceCollection[game.AppearanceKey(medallion)] = medallion
	p.Equipment["neck"] = game.Item{ID: "real-pendant", Name: "Pendant", Stats: map[string]int{"vitality": 7}}
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
	if decoded.Appearances["neck"].BaseName != medallion.BaseName || decoded.Equipment["neck"].Name != "Pendant" || decoded.Equipment["neck"].Stats["vitality"] != 7 {
		t.Fatal("earned medallion lost its selection or changed the combat item")
	}
	before := entityToSnapshot(p)
	p.Appearances = map[string]game.EquipmentAppearance{}
	p.EquipmentRevision++
	if !hasEntityChanged(p, before) || len(entityToProto(p).Appearances) != 0 {
		t.Fatal("reset not published through delta path")
	}
}
