package database

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestItemBSONRoundTripPreservesVisualAndGameplayMetadata(t *testing.T) {
	original := Item{
		ID:               "persistent-item",
		Name:             "Ruby Ring",
		Type:             "ACCESSORY",
		Slot:             "ring",
		Rarity:           "Legendary",
		Level:            100,
		Stats:            map[string]int{"strength": 20},
		Potency:          5,
		Sockets:          2,
		SetID:            "crusader_zeal",
		UniqueEffect:     "vampiric",
		GemType:          "Ruby",
		GemQuality:       "Perfect",
		StatScaleVersion: 1,
		Gems: []SocketedGem{
			{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 4}},
		},
	}

	encoded, err := bson.Marshal(original)
	if err != nil {
		t.Fatalf("marshal item: %v", err)
	}
	var restored Item
	if err := bson.Unmarshal(encoded, &restored); err != nil {
		t.Fatalf("unmarshal item: %v", err)
	}
	if !reflect.DeepEqual(restored, original) {
		t.Fatalf("BSON round trip changed item metadata:\nwant %#v\n got %#v", original, restored)
	}
}
