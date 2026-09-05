package game

import (
	"fmt"
	"hash/fnv"
	"log"
	"strconv"
)

// Bump when generation rules or random draw order change. Persisted geometry
// remains authoritative; this identity is for diagnostics/replay, not a reason
// to regenerate an existing party's saved run.
const dungeonGeneratorVersion = 2

type dungeonLayoutGenerator func(string, DungeonDifficulty, string, int64) DungeonLayout

// Ordinary runs use the seeded generator. Tests and the allowlisted, one-shot
// QA command can force retry exhaustion. Callers own the world lock and registry.
func (w *World) buildDungeonInstanceLayoutLocked(instance *DungeonInstance, generate dungeonLayoutGenerator) {
	const maxAttempts = 8
	var layout DungeonLayout
	var generationErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		seed := dungeonLayoutSeed(instance.ID, attempt)
		layout = generate(instance.ID, instance.Difficulty, instance.DungeonType, seed)
		layout.GenerationSeed = strconv.FormatInt(seed, 10)
		layout.GeneratorVersion = dungeonGeneratorVersion
		layout.GenerationAttempt = attempt
		generationErr = validateDungeonProgressionLayout(instance.DungeonType, layout)
		if generationErr == nil {
			generationErr = w.validateGeneratedDungeonBosses(instance, layout)
		}
		if generationErr == nil {
			break
		}
		for id, entity := range w.Entities {
			if entity.InstanceID == instance.ID {
				w.Grid.Remove(entity)
				delete(w.Entities, id)
			}
		}
	}
	if generationErr != nil {
		log.Printf("CreateDungeon: %s exhausted %d attempts: %v; building full fallback route", instance.DungeonType, maxAttempts, generationErr)
		lastSeed := layout.GenerationSeed
		layout = fallbackDungeonLayout(instance.DungeonType)
		layout.GenerationSeed, layout.GeneratorVersion = lastSeed, dungeonGeneratorVersion
		layout.GenerationAttempt, layout.GenerationFallback = maxAttempts-1, true
	}
	assignDungeonRoomHooks(&layout)
	instance.Layout = layout
	instance.RoomState = NewDungeonRoomState(layout)
	if layout.GenerationFallback {
		w.spawnRestoredDungeonEncounters(instance)
	}
}

func validateDungeonProgressionLayout(dungeonType string, layout DungeonLayout) error {
	if err := ValidateDungeonLayout(layout); err != nil {
		return err
	}
	_, _, catalog := dungeonEncounterCatalog(dungeonType)
	bosses := 0
	for _, room := range layout.Rooms {
		if room.Type == "boss" {
			bosses++
		}
	}
	if bosses != len(catalog) {
		return fmt.Errorf("got %d boss rooms, need %d", bosses, len(catalog))
	}
	if _, raid := ElementalRaidDefinitionForType(dungeonType); raid && layout.Rooms[len(layout.Rooms)-1].Hook != "crystal_vigil" {
		return fmt.Errorf("missing terminal crystal-repair Vigil")
	}
	return nil
}

func (w *World) validateGeneratedDungeonBosses(instance *DungeonInstance, layout DungeonLayout) error {
	_, _, catalog := dungeonEncounterCatalog(instance.DungeonType)
	index := 0
	for _, room := range layout.Rooms {
		if room.Type != "boss" {
			continue
		}
		boss := w.Entities[fmt.Sprintf("%s-%s", catalog[index], instance.ID)]
		index++
		if boss == nil || boss.Type != TypeEnemy || boss.InstanceID != instance.ID ||
			boss.X < room.X-room.Width/2 || boss.X > room.X+room.Width/2 ||
			boss.Z < room.Z-room.Height/2 || boss.Z > room.Z+room.Height/2 {
			return fmt.Errorf("required boss %s missing from its room", catalog[index-1])
		}
	}
	return nil
}

func dungeonLayoutSeed(instanceID string, attempt int) int64 {
	hash := fnv.New64a()
	fmt.Fprintf(hash, "eidolon-layout-v%d:%s:%d", dungeonGeneratorVersion, instanceID, attempt)
	return int64(hash.Sum64())
}

// No global random draws determine geometry. Enemy IDs and combat/loot can use
// their own randomness without changing a layout's rooms or spawn positions.
func (w *World) generateDungeonLayoutWithSeed(instanceID string, difficulty DungeonDifficulty, dungeonType string, seed int64) DungeonLayout {
	var layout DungeonLayout
	switch dungeonType {
	case "verdant_bastion_catacombs":
		layout = w.generateVerdantBastionLayoutWithSeed(instanceID, difficulty, seed)
	case "molten_core":
		layout = w.generateMoltenCoreLayoutWithSeed(instanceID, difficulty, seed)
	case "tempest_spire":
		layout = w.generateTempestSpireLayoutWithSeed(instanceID, difficulty, seed)
	case "abyssal_well":
		layout = w.generateAbyssalWellLayoutWithSeed(instanceID, difficulty, seed)
	case "umbral_nexus":
		layout = w.generateUmbralNexusLayout(instanceID, difficulty)
	case "weekly_raid":
		layout = w.generateWeeklyRaidLayout(instanceID, difficulty)
	default:
		layout = w.generateElementalRaidLayout(instanceID, difficulty, dungeonType)
	}
	layout.GenerationSeed = strconv.FormatInt(seed, 10) // String avoids JavaScript's 53-bit integer limit.
	layout.GeneratorVersion = dungeonGeneratorVersion
	return layout
}

func (w *World) generateVerdantBastionLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	return w.generateDungeonLayoutWithSeed(instanceID, difficulty, "verdant_bastion_catacombs", dungeonLayoutSeed(instanceID, 0))
}

func (w *World) generateMoltenCoreLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	return w.generateDungeonLayoutWithSeed(instanceID, difficulty, "molten_core", dungeonLayoutSeed(instanceID, 0))
}

func (w *World) generateTempestSpireLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	return w.generateDungeonLayoutWithSeed(instanceID, difficulty, "tempest_spire", dungeonLayoutSeed(instanceID, 0))
}

func (w *World) generateAbyssalWellLayout(instanceID string, difficulty DungeonDifficulty) DungeonLayout {
	return w.generateDungeonLayoutWithSeed(instanceID, difficulty, "abyssal_well", dungeonLayoutSeed(instanceID, 0))
}
