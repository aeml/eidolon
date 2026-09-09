package game

import "testing"

func TestSafeZonePvECombatFeedbackMatchesAuthority(t *testing.T) {
	w := &World{SafeZones: NewSafeZoneRegistry()}
	for _, tc := range []struct {
		name, scene string
		x, z        float64
		want        CombatRelationship
	}{
		{"observed-town-edge-stall", "", 83.5115856, 296.3999514, RelationshipNeutral},
		{"fence-is-protected", "", 100, 200, RelationshipNeutral},
		{"ordinary-departure", "", 115, 200, RelationshipHostile},
		{"same-coordinates-in-dungeon", "dungeon", 83.5115856, 296.3999514, RelationshipHostile},
	} {
		t.Run(tc.name, func(t *testing.T) {
			player := &Entity{ID: "player", Type: TypePlayer, InstanceID: tc.scene, X: tc.x, Z: tc.z}
			enemy := &Entity{ID: "enemy", Type: TypeEnemy, InstanceID: tc.scene, X: 110, Z: 310}
			if got := w.CombatRelationship(player, enemy); got != tc.want {
				t.Fatalf("player to enemy: got %v, want %v", got, tc.want)
			}
			if got := w.CombatRelationship(enemy, player); got != tc.want {
				t.Fatalf("enemy to player: got %v, want %v", got, tc.want)
			}
		})
	}
}
