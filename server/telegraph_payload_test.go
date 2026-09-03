package main

import (
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
