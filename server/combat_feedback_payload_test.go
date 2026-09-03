package main

import (
	"encoding/json"
	"testing"
)

func TestDamagePayloadPreservesAuthoritativeFeedbackContext(t *testing.T) {
	payload := DamagePayload{
		TargetID: "enemy-1", SourceID: "player-wizard", Amount: 84,
		Kind: "arcane", InstanceID: "dungeon-feedback",
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal damage payload: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal damage payload: %v", err)
	}
	if decoded["kind"] != "arcane" || decoded["instanceId"] != "dungeon-feedback" {
		t.Fatalf("damage feedback context missing from wire payload: %#v", decoded)
	}
}

func TestHealPayloadShapePreservesAuthoritativeFeedbackContext(t *testing.T) {
	payload := DamagePayload{
		TargetID: "player-fighter", SourceID: "player-fighter", Amount: 22,
		Kind: "lifesteal", InstanceID: "dungeon-feedback",
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal heal payload: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal heal payload: %v", err)
	}
	if decoded["kind"] != "lifesteal" || decoded["instanceId"] != "dungeon-feedback" {
		t.Fatalf("heal feedback context missing from wire payload: %#v", decoded)
	}
}
