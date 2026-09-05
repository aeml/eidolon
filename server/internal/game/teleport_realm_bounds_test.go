package game

import "testing"

func TestTeleportPreservesRealmAndDungeonCoordinates(t *testing.T) {
	for _, tc := range []struct {
		name, instance string
		x, z           float64
	}{
		{"Earth", "", 100, 300}, {"Air", "", 2100, 200},
		{"Fire", "", -2100, 200}, {"Water", "", 100, -1800},
		{"Dungeon", "dungeon_teleport", 20000, 20000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := NewWorld(nil)
			player := newTestPlayer("realm-teleport", "Wizard")
			player.X, player.Z, player.InstanceID = tc.x, tc.z, tc.instance
			player.Mana = 10000
			player.UnlockedSkills = []string{"Teleport"}
			if tc.instance != "" {
				w.InstanceLayouts[tc.instance] = &DungeonInstance{ID: tc.instance, Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: tc.x, Z: tc.z, Width: 100, Height: 100}}}}
			}
			w.AddEntity(player)
			result := w.PerformAbility(player.ID, tc.x+10, tc.z, "", "Teleport")
			if !result.Accepted || player.X != tc.x+10 || player.Z != tc.z || player.InstanceID != tc.instance {
				t.Fatalf("teleport changed realms or missed target: result=%+v at=(%f,%f) instance=%s", result, player.X, player.Z, player.InstanceID)
			}
		})
	}
}
