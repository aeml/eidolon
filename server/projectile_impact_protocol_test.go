package main

import (
	"encoding/json"
	"testing"
)

func TestProjectileImpactWirePreservesExplicitZeroRadius(t *testing.T) {
	for _, radius := range []float64{0, 10} {
		payload, err := json.Marshal(ProjectileImpactPayload{ProjectileID: "wall-bolt", ProjectileType: "Fireball",
			InstanceID: "dungeon_wall", X: 30010, Z: 20000, Radius: radius, Terminal: true})
		if err != nil {
			t.Fatal(err)
		}
		wire := createMessage(MsgProjectileImpact, payload)
		var decoded struct {
			Type    string                 `json:"type"`
			Payload map[string]interface{} `json:"payload"`
		}
		if err := json.Unmarshal(wire, &decoded); err != nil {
			t.Fatal(err)
		}
		if value, exists := decoded.Payload["radius"]; !exists || value != radius {
			t.Fatalf("actual client protocol lost explicit damage radius %v: %s", radius, wire)
		}
	}
}
