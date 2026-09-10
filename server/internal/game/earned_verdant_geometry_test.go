package game

import (
	"encoding/json"
	"math"
	"testing"
)

// Recorded ordinary failed run44188, generator2. This reproduces geometry,
// not live enemy positions or a native replay of the failed fight.
func TestEarnedVerdantFailureGeometry(t *testing.T) {
	w := NewWorld(nil)
	layout := w.generateDungeonLayoutWithSeed("dungeon_earned_geometry", DifficultyNormal,
		"verdant_bastion_catacombs", -1263584004433865125)
	if err := ValidateDungeonLayout(layout); err != nil {
		t.Fatal(err)
	}
	const deathX, deathZ = 20035.233783749074, 19771.176993562265
	deathRoom, firstBoss := -1, -1
	for i, room := range layout.Rooms {
		if math.Abs(deathX-room.X) <= room.Width/2 && math.Abs(deathZ-room.Z) <= room.Height/2 {
			deathRoom = i
		}
		if room.Type == "boss" && firstBoss == -1 {
			firstBoss = i
		}
	}
	if deathRoom < 0 || firstBoss < 0 {
		t.Fatalf("missing recorded death room or first boss: %d/%d", deathRoom, firstBoss)
	}
	if deathRoom != 1 || firstBoss != 3 || layout.Rooms[deathRoom].Z != 19820 || layout.Rooms[firstBoss].Z != 19460 {
		t.Fatal("recorded generator2 geometry changed; review the failed seed before updating this evidence")
	}
	data, err := json.Marshal(map[string]any{
		"seed": layout.GenerationSeed, "generator": layout.GeneratorVersion,
		"deathRoomIndex": deathRoom, "deathRoom": layout.Rooms[deathRoom],
		"firstBossIndex": firstBoss, "firstBossRoom": layout.Rooms[firstBoss],
		"distanceFromBossRoomCenter": math.Hypot(deathX-layout.Rooms[firstBoss].X, deathZ-layout.Rooms[firstBoss].Z),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("[earned-death-geometry] %s", data)
}
