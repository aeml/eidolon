package game

import (
	"fmt"
	"testing"
)

func TestDungeonSpawnNeverOverwritesAnExistingActorID(t *testing.T) {
	for _, family := range []string{"regional", "fire", "air"} {
		for _, elite := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/elite=%v", family, elite), func(t *testing.T) {
				w := NewWorld(nil)
				instanceID, subtype := "dungeon_identity", "Skeleton"
				prefix := subtype + "-" + instanceID + "-"
				if elite {
					prefix = "elite-" + prefix
				}
				// Occupy every old random suffix, guaranteeing a collision
				// without seeding or monkey-patching global randomness.
				marker := &Entity{Health: 123}
				for suffix := 0; suffix < 10000; suffix++ {
					w.Entities[fmt.Sprintf("%s%d", prefix, suffix)] = marker
				}
				before := len(w.Entities)
				switch family {
				case "fire":
					w.spawnFireDungeonEnemy(subtype, 20000, 20000, instanceID, elite, DifficultyNormal)
				case "air":
					w.spawnAirDungeonEnemy(subtype, 20000, 20000, instanceID, elite, DifficultyNormal)
				default:
					w.spawnDungeonEnemyInInstance(subtype, 20000, 20000, instanceID, DifficultyNormal, elite)
				}
				if len(w.Entities) != before+1 {
					t.Fatal("spawning replaced an existing actor instead of adding an encounter")
				}
				for suffix := 0; suffix < 10000; suffix++ {
					if w.Entities[fmt.Sprintf("%s%d", prefix, suffix)] != marker {
						t.Fatal("an existing actor was overwritten")
					}
				}
				nearby := w.Grid.Nearby(20000, 20000, 5, instanceID)
				if len(nearby) != 1 || w.Entities[nearby[0].ID] != nearby[0] {
					t.Fatal("spawn registry and spatial index disagree")
				}
			})
		}
	}
}
