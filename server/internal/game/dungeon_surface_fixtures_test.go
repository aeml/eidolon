package game

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// These are real production-generator layouts shared with client geometry and
// browser tests. Updating is explicit; ordinary test runs never rewrite them.
func TestProductionDungeonSurfaceFixtures(t *testing.T) {
	type fixture struct {
		DungeonType string        `json:"dungeonType"`
		Layout      DungeonLayout `json:"layout"`
	}
	fixtures := []fixture{}
	types := append(append([]string(nil), replayDungeonTypes...), "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid")
	for typeIndex, dungeonType := range types {
		for _, seed := range []int64{2026090501, 2026090502, 2026090503} {
			if typeIndex >= len(replayDungeonTypes) && seed != 2026090501 {
				continue
			}
			w := NewWorld(nil)
			layout := w.generateDungeonLayoutWithSeed("dungeon_surface_fixture", DifficultyNormal, dungeonType, seed)
			assignDungeonRoomHooks(&layout)
			if err := ValidateDungeonLayout(layout); err != nil {
				t.Fatalf("%s seed %d: %v", dungeonType, seed, err)
			}
			fixtures = append(fixtures, fixture{dungeonType, layout})
		}
	}
	fixturePath := filepath.Join("..", "..", "..", "tests", "fixtures", "production-dungeon-layouts.json")
	if os.Getenv("EIDOLON_UPDATE_DUNGEON_FIXTURES") == "1" {
		if err := os.MkdirAll(filepath.Dir(fixturePath), 0755); err != nil {
			t.Fatal(err)
		}
		data, err := json.Marshal(fixtures)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fixturePath, append(data, '\n'), 0644); err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	var saved []fixture
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(saved, fixtures) {
		t.Fatal("production generator changed: review seed/version and regenerate shared fixtures with EIDOLON_UPDATE_DUNGEON_FIXTURES=1")
	}
}
