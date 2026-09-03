package main

import (
	"encoding/json"
	"testing"
)

func TestProjectileImpactPayloadPreservesAuthoritativeVisualContract(t *testing.T) {
	payload := ProjectileImpactPayload{
		ProjectileID: "proj-meteor-1", ProjectileType: "Meteor",
		SourceID: "player-wizard", TargetID: "enemy-1", InstanceID: "dungeon-impact",
		SkillName: "Meteor Drop", X: 12, Y: 0, Z: -7,
		DirectionX: 0, DirectionZ: -1, Radius: 39.6, Terminal: true,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal projectile impact payload: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal projectile impact payload: %v", err)
	}
	for key, expected := range map[string]string{
		"projectileId": payload.ProjectileID, "projectileType": payload.ProjectileType,
		"sourceId": payload.SourceID, "targetId": payload.TargetID,
		"instanceId": payload.InstanceID, "skillName": payload.SkillName,
	} {
		if decoded[key] != expected {
			t.Fatalf("expected %s=%q in impact wire payload, got %#v", key, expected, decoded[key])
		}
	}
	if decoded["radius"] != payload.Radius || decoded["terminal"] != true {
		t.Fatalf("impact footprint/lifecycle missing from wire payload: %#v", decoded)
	}
}
