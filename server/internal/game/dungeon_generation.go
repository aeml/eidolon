package game

import (
	"fmt"
	"hash/fnv"
	"strconv"
)

// Bump when generation rules or random draw order change. Persisted geometry
// remains authoritative; this identity is for diagnostics/replay, not a reason
// to regenerate an existing party's saved run.
const dungeonGeneratorVersion = 1

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
