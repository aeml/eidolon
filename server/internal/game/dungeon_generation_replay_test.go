package game

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"testing"
)

var replayDungeonTypes = []string{"verdant_bastion_catacombs", "molten_core", "tempest_spire", "abyssal_well", "umbral_nexus"}

func TestReportedDungeonSeed(t *testing.T) {
	seedText := os.Getenv("EIDOLON_REPLAY_SEED")
	if seedText == "" {
		t.Skip("set the recorded seed, dungeon type, and generator version to replay a report")
	}
	if os.Getenv("EIDOLON_REPLAY_GENERATOR") != strconv.Itoa(dungeonGeneratorVersion) {
		t.Fatal("recorded generator version differs; use the matching source version before replaying")
	}
	seed, err := strconv.ParseInt(seedText, 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	dungeonType := os.Getenv("EIDOLON_REPLAY_DUNGEON")
	known := false
	for _, candidate := range append(append([]string(nil), replayDungeonTypes...), "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid") {
		if candidate == dungeonType {
			known = true
		}
	}
	if !known {
		t.Fatal("unknown EIDOLON_REPLAY_DUNGEON")
	}
	w := NewWorld(nil)
	layout := w.generateDungeonLayoutWithSeed("dungeon_report_replay", DifficultyNormal, dungeonType, seed)
	assignDungeonRoomHooks(&layout)
	if err := ValidateDungeonLayout(layout); err != nil {
		t.Fatalf("generator=%d seed=%s: %v", dungeonGeneratorVersion, seedText, err)
	}
	data, err := json.Marshal(layout)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Replay %s generator=%d seed=%s: %s", dungeonType, dungeonGeneratorVersion, seedText, data)
}

func TestProductionDungeonSeedSweep(t *testing.T) {
	for _, dungeonType := range replayDungeonTypes {
		for _, difficulty := range []DungeonDifficulty{DifficultyNormal, DifficultyHeroic, DifficultyMythic} {
			t.Run(dungeonType+"/"+string(difficulty), func(t *testing.T) {
				w := NewWorld(nil)
				for seed := int64(1); seed <= 100; seed++ {
					// Generation has no running simulation. Reset only this test's
					// entity/instance containers between independent seeded runs.
					w.Entities = make(map[string]*Entity)
					w.Grid = NewSpatialMap(50)
					w.InstanceLayouts = make(map[string]*DungeonInstance)
					id := fmt.Sprintf("dungeon_sweep_%s_%s_%d", dungeonType, difficulty, seed)
					w.InstanceLayouts[id] = &DungeonInstance{ID: id, DungeonType: dungeonType, Difficulty: difficulty, RunLevel: 100}
					layout := w.generateDungeonLayoutWithSeed(id, difficulty, dungeonType, seed)
					if err := ValidateDungeonLayout(layout); err != nil {
						t.Fatalf("generator=%d seed=%d: %v", dungeonGeneratorVersion, seed, err)
					}
					if layout.GenerationSeed != strconv.FormatInt(seed, 10) || layout.GeneratorVersion != dungeonGeneratorVersion || layout.GenerationFallback {
						t.Fatalf("seed=%d: missing or incorrect replay identity", seed)
					}
					bosses := 0
					for _, room := range layout.Rooms {
						if room.Type == "boss" {
							bosses++
						}
					}
					wantBosses := map[string]int{"verdant_bastion_catacombs": 4, "umbral_nexus": 3}[dungeonType]
					if wantBosses == 0 {
						wantBosses = 5
					}
					if bosses != wantBosses {
						t.Fatalf("seed=%d: got %d boss rooms, want %d", seed, bosses, wantBosses)
					}
				}
			})
		}
	}
}

func TestDungeonReplayIdentitySurvivesPersistenceAndJSON(t *testing.T) {
	w := NewWorld(nil)
	id := w.CreateDungeon("replay-party", "molten_core", DifficultyHeroic, 100)
	snapshot, ok := w.GetDungeonResumeSnapshot(id)
	if !ok || snapshot.Layout.GenerationSeed == "" || snapshot.Layout.GenerationFallback {
		t.Fatal("production creation did not record a successful replay identity")
	}
	seed, err := strconv.ParseInt(snapshot.Layout.GenerationSeed, 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	w2 := NewWorld(nil)
	if err := w2.RestoreDungeon(snapshot); err != nil {
		t.Fatal(err)
	}
	restored, _ := w2.GetDungeonResumeSnapshot(id)
	if !reflect.DeepEqual(restored.Layout, snapshot.Layout) {
		t.Fatal("restore changed saved geometry/replay identity")
	}
	replay := w2.generateDungeonLayoutWithSeed("dungeon_diagnostic_replay", DifficultyHeroic, "molten_core", seed)
	assignDungeonRoomHooks(&replay)
	replay.GenerationAttempt = snapshot.Layout.GenerationAttempt
	if !reflect.DeepEqual(replay, snapshot.Layout) {
		t.Fatal("saved seed did not reproduce production geometry")
	}
	data, err := json.Marshal(snapshot.Layout)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]interface{}
	if err := json.Unmarshal(data, &wire); err != nil {
		t.Fatal(err)
	}
	if wire["generationSeed"] != snapshot.Layout.GenerationSeed {
		t.Fatal("seed was not serialized as an exact string")
	}
}

func TestDungeonGenerationDoesNotDependOnGlobalRandomTraffic(t *testing.T) {
	for _, dungeonType := range []string{"verdant_bastion_catacombs", "molten_core", "tempest_spire", "abyssal_well"} {
		t.Run(dungeonType, func(t *testing.T) {
			generate := func() DungeonLayout {
				w := NewWorld(nil)
				generators := map[string]func(string, DungeonDifficulty) DungeonLayout{
					"verdant_bastion_catacombs": w.generateVerdantBastionLayout,
					"molten_core":               w.generateMoltenCoreLayout,
					"tempest_spire":             w.generateTempestSpireLayout,
					"abyssal_well":              w.generateAbyssalWellLayout,
				}
				return generators[dungeonType]("dungeon_replay_same_identity", DifficultyNormal)
			}
			first := generate()
			for i := 0; i < 1000; i++ {
				_ = rand.Float64() // Other players' combat/loot must not change this layout.
			}
			second := generate()
			if !reflect.DeepEqual(first, second) {
				t.Fatal("same dungeon identity changed layout when replayed after unrelated random traffic")
			}
		})
	}
}
