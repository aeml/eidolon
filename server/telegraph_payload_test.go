package main

import (
	"eidolon-server/internal/game"
	"encoding/json"
	"testing"
)

func TestTelegraphPayloadPreservesDungeonEncounterPresentation(t *testing.T) {
	payload := TelegraphPayload{
		SourceID:   "Thalorath-instance",
		X:          50,
		Z:          -20,
		Radius:     12.5,
		Duration:   2,
		Theme:      "abyssal_well",
		Attack:     "undertow_crush",
		ThreatTier: "boss",
		Label:      "UNDERTOW CRUSH",
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal telegraph payload: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal telegraph payload: %v", err)
	}
	for key, expected := range map[string]string{
		"theme":      payload.Theme,
		"attack":     payload.Attack,
		"threatTier": payload.ThreatTier,
		"label":      payload.Label,
	} {
		if decoded[key] != expected {
			t.Fatalf("expected %s=%q in telegraph wire payload, got %#v", key, expected, decoded[key])
		}
	}
}

func TestTelegraphBroadcastKeepsPatternGuidanceAndInstance(t *testing.T) {
	for _, instanceID := range []string{"", "dungeon_party_a"} {
		event := game.TelegraphEvent{InstanceID: instanceID, SourceID: "warden", X: 60000,
			Z: 60010, Radius: 6, Duration: 2, Hint: "Step sideways out of the fissure line.",
			Silent: true, Theme: "verdant_bastion_catacombs", Attack: "root_quake", Label: "ROOT QUAKE"}
		message, err := telegraphBroadcast(event)
		if err != nil || message.Type != MsgTelegraph || message.InstanceID != instanceID {
			t.Fatalf("wrong routing: %+v %v", message, err)
		}
		var envelope Message
		if err := json.Unmarshal(message.Data, &envelope); err != nil {
			t.Fatal(err)
		}
		var decoded game.TelegraphEvent
		if err := json.Unmarshal(envelope.Payload, &decoded); err != nil {
			t.Fatal(err)
		}
		if decoded != event || envelope.Type != MsgTelegraph {
			t.Fatalf("wire lost encounter contract: %+v", decoded)
		}
		var fields map[string]interface{}
		if err := json.Unmarshal(envelope.Payload, &fields); err != nil {
			t.Fatal(err)
		}
		if fields["instanceId"] != instanceID {
			t.Fatal("empty overworld scope must be explicit")
		}
		for _, recipient := range []string{"", "dungeon_party_a", "dungeon_party_b"} {
			if broadcastMatchesInstance(message, recipient) != (recipient == instanceID) {
				t.Fatalf("warning leaked between instances: %q -> %q", instanceID, recipient)
			}
		}
	}
	if !broadcastMatchesInstance(BroadcastMessage{Type: MsgChat}, "dungeon_party_a") {
		t.Fatal("ordinary global broadcasts must remain global")
	}
}
