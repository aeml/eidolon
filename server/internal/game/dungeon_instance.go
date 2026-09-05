package game

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type DungeonDifficulty string

const (
	DifficultyNormal DungeonDifficulty = "normal"
	DifficultyHeroic DungeonDifficulty = "heroic"
	DifficultyMythic DungeonDifficulty = "mythic"
)

// DifficultyMultipliers returns (healthMult, damageMult, lootMult, xpMult) for a difficulty
func DifficultyMultipliers(difficulty DungeonDifficulty) (float64, float64, float64, float64) {
	switch difficulty {
	case DifficultyHeroic:
		return 2.0, 1.5, 2.0, 2.0 // 2x health, 1.5x damage, 2x loot/xp
	case DifficultyMythic:
		return 4.0, 2.5, 4.0, 4.0 // 4x health, 2.5x damage, 4x loot/xp
	default:
		return 1.0, 1.0, 1.0, 1.0 // Normal
	}
}

// MinLevelForDifficulty returns the minimum party level required for a difficulty
func MinLevelForDifficulty(difficulty DungeonDifficulty, dungeonType string) int {
	switch difficulty {
	case DifficultyHeroic, DifficultyMythic:
		return EndgameDifficultyUnlockLevel
	default:
		return DungeonUnlockLevel
	}
}

type DungeonInstance struct {
	// Mu protects all mutable instance fields below. The world instance registry
	// has a separate lock so simulation work in one dungeon does not serialize
	// unrelated dungeon instances.
	Mu                sync.RWMutex
	ID                string
	Layout            DungeonLayout
	PartyID           string
	CreatedAt         time.Time
	EmptySince        time.Time
	PlayerCount       int
	Difficulty        DungeonDifficulty
	DungeonType       string
	RunLevel          int
	RoomState         *DungeonRoomState
	PlayerRoomSummary map[string]DungeonRoomSummary
}

// DungeonResumeSnapshot is the durable, implementation-neutral portion of a
// live dungeon. Enemy health is intentionally not persisted; on process
// restart, uncleared encounters are rebuilt while cleared rooms stay cleared.
type DungeonResumeSnapshot struct {
	ID                    string
	PartyID               string
	CreatedAt             time.Time
	Difficulty            DungeonDifficulty
	DungeonType           string
	RunLevel              int
	Layout                DungeonLayout
	Rooms                 []DungeonRoomProgress
	CurrentRoomIndexValue int
}

func (w *World) getDungeonInstance(instanceID string) (*DungeonInstance, bool) {
	w.InstanceMu.RLock()
	defer w.InstanceMu.RUnlock()
	instance, ok := w.InstanceLayouts[instanceID]
	return instance, ok
}

func (w *World) storeDungeonInstance(instanceID string, instance *DungeonInstance) {
	w.InstanceMu.Lock()
	w.InstanceLayouts[instanceID] = instance
	w.InstanceMu.Unlock()
}

func (w *World) dungeonInstancesSnapshot() map[string]*DungeonInstance {
	w.InstanceMu.RLock()
	defer w.InstanceMu.RUnlock()
	instances := make(map[string]*DungeonInstance, len(w.InstanceLayouts))
	for id, instance := range w.InstanceLayouts {
		instances[id] = instance
	}
	return instances
}

func cloneDungeonLayout(layout DungeonLayout) DungeonLayout {
	cloned := layout
	cloned.Rooms = append([]DungeonRoom(nil), layout.Rooms...)
	cloned.WalkRects = append([]DungeonWalkRect(nil), layout.WalkRects...)
	cloned.Corridors = append([]DungeonCorridor(nil), layout.Corridors...)
	return cloned
}

func (w *World) GetDungeonResumeSnapshot(instanceID string) (DungeonResumeSnapshot, bool) {
	instance, ok := w.getDungeonInstance(instanceID)
	if !ok {
		return DungeonResumeSnapshot{}, false
	}
	instance.Mu.RLock()
	defer instance.Mu.RUnlock()
	if instance.RoomState == nil {
		return DungeonResumeSnapshot{}, false
	}
	return DungeonResumeSnapshot{
		ID:                    instance.ID,
		PartyID:               instance.PartyID,
		CreatedAt:             instance.CreatedAt,
		Difficulty:            instance.Difficulty,
		DungeonType:           instance.DungeonType,
		RunLevel:              instance.RunLevel,
		Layout:                cloneDungeonLayout(instance.Layout),
		Rooms:                 append([]DungeonRoomProgress(nil), instance.RoomState.Rooms...),
		CurrentRoomIndexValue: instance.RoomState.CurrentRoomIndexValue,
	}, true
}

// RestoreDungeon reconstructs one process-lost dungeon from persisted room
// state. It is idempotent so several reconnecting party members can race to
// restore the same instance safely.
func (w *World) RestoreDungeon(snapshot DungeonResumeSnapshot) error {
	if snapshot.ID == "" || len(snapshot.ID) > 200 || !strings.HasPrefix(snapshot.ID, "dungeon_") {
		return fmt.Errorf("invalid dungeon instance id")
	}
	if snapshot.RunLevel < 1 || snapshot.RunLevel > MaxPlayerLevel || len(snapshot.Layout.Rooms) == 0 {
		return fmt.Errorf("invalid dungeon resume state")
	}
	if err := ValidateDungeonLayout(snapshot.Layout); err != nil {
		return fmt.Errorf("invalid persisted dungeon layout: %w", err)
	}

	w.Mu.Lock()
	defer w.Mu.Unlock()
	if _, exists := w.getDungeonInstance(snapshot.ID); exists {
		return nil
	}

	layout := cloneDungeonLayout(snapshot.Layout)
	// Version-1 retry exhaustion saved only an empty starting room. It has no
	// completed encounter to preserve, but resuming it forever would strand the
	// party. Upgrade only this exact broken fallback shape; valid saved layouts
	// and their generator identity remain authoritative.
	if layout.GenerationFallback && len(layout.Rooms) == 1 && layout.Rooms[0].Type == "start" && len(snapshot.Rooms) <= 1 {
		repaired := fallbackDungeonLayout(snapshot.DungeonType)
		if len(repaired.Rooms) > 1 {
			repaired.GenerationFallback = true
			repaired.GenerationSeed, repaired.GenerationAttempt = layout.GenerationSeed, layout.GenerationAttempt
			repaired.GeneratorVersion = dungeonGeneratorVersion
			assignDungeonRoomHooks(&repaired)
			layout = repaired
		}
	}
	roomState := NewDungeonRoomState(layout)
	copy(roomState.Rooms, snapshot.Rooms)
	roomState.CurrentRoomIndexValue = snapshot.CurrentRoomIndexValue
	createdAt := snapshot.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	instance := &DungeonInstance{
		ID:                snapshot.ID,
		Layout:            layout,
		PartyID:           snapshot.PartyID,
		CreatedAt:         createdAt,
		EmptySince:        time.Now(),
		Difficulty:        snapshot.Difficulty,
		DungeonType:       snapshot.DungeonType,
		RunLevel:          snapshot.RunLevel,
		RoomState:         roomState,
		PlayerRoomSummary: make(map[string]DungeonRoomSummary),
	}
	if instance.Difficulty == "" {
		instance.Difficulty = DifficultyNormal
	}
	w.storeDungeonInstance(instance.ID, instance)
	w.spawnRestoredDungeonEncounters(instance)
	return nil
}

func (w *World) spawnRestoredDungeonEncounters(instance *DungeonInstance) {
	trash, elite, bosses := dungeonEncounterCatalog(instance.DungeonType)
	bossIndex := 0
	for roomIndex, room := range instance.Layout.Rooms {
		cleared := roomIndex < len(instance.RoomState.Rooms) && instance.RoomState.Rooms[roomIndex].Cleared
		if room.Type == "start" || cleared {
			if room.Type == "boss" {
				bossIndex++
			}
			continue
		}
		switch room.Type {
		case "boss":
			boss := bosses[min(bossIndex, len(bosses)-1)]
			bossIndex++
			w.spawnBossInInstance(boss, room.X, room.Z, instance.ID, instance.Difficulty)
		case "elite":
			w.spawnDungeonEnemyInInstance(elite, room.X, room.Z, instance.ID, instance.Difficulty, true)
		default:
			for offset := -1; offset <= 1; offset++ {
				w.spawnDungeonEnemyInInstance(trash, room.X+float64(offset*4), room.Z, instance.ID, instance.Difficulty, false)
			}
		}
	}
}

func dungeonEncounterCatalog(dungeonType string) (trash string, elite string, bosses []string) {
	switch dungeonType {
	case "molten_core":
		return "MagmaGolem", "InfernalBehemoth", []string{"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax"}
	case "tempest_spire":
		return "StormHarpy", "TempestGiant", []string{"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion"}
	case "abyssal_well":
		return "AquaGolem", "FrostGuardian", []string{"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath"}
	case "umbral_nexus":
		return "DissonantShade", "MemoryReaver", []string{"DissonantHerald", "NullArchitect", "EidolonDevourer"}
	case "weekly_raid":
		return "DissonantShade", "MemoryReaver", []string{"UmbraPrime"}
	case "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid":
		definition, _ := ElementalRaidDefinitionForType(dungeonType)
		return definition.Trash, definition.Elite, []string{definition.Boss}
	default:
		return "Skeleton", "DemonOrc", []string{"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel"}
	}
}

func difficultyPacingTag(difficulty DungeonDifficulty) string {
	switch difficulty {
	case DifficultyHeroic:
		return "heroic_pressure"
	case DifficultyMythic:
		return "mythic_trial"
	default:
		return "standard_route"
	}
}

func withDungeonSummaryContext(summary DungeonRoomSummary, difficulty DungeonDifficulty, runLevel int) DungeonRoomSummary {
	if difficulty == "" {
		difficulty = DifficultyNormal
	}
	summary.Difficulty = string(difficulty)
	summary.RunLevel = runLevel
	summary.DifficultyPacing = difficultyPacingTag(difficulty)
	return summary
}
