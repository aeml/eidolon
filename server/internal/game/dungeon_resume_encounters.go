package game

import (
	"reflect"
	"strconv"
)

// Reuse the original seeded spawn decisions, never substitute regenerated
// geometry for the saved layout. Older generators, fallback layouts and edited
// layouts retain the legacy room-based reconstruction path.
func (w *World) replayRestoredDungeonEncounters(instance *DungeonInstance) bool {
	layout := instance.Layout
	if layout.GeneratorVersion != dungeonGeneratorVersion || layout.GenerationFallback {
		return false
	}
	seed, err := strconv.ParseInt(layout.GenerationSeed, 10, 64)
	if err != nil {
		return false
	}
	_, regular := supportedDungeonTypes[instance.DungeonType]
	_, elemental := ElementalRaidDefinitionForType(instance.DungeonType)
	if (!regular && !elemental && instance.DungeonType != "weekly_raid") || instance.DungeonType == "crypt" {
		return false
	}
	// A small, isolated spawn registry: no overworld, simulation or background
	// workers. It also prevents rejected replay candidates touching live actors.
	replay := &World{
		Entities:        make(map[string]*Entity),
		Grid:            NewSpatialMap(50),
		InstanceLayouts: map[string]*DungeonInstance{instance.ID: instance},
	}
	generated := replay.generateDungeonLayoutWithSeed(instance.ID, instance.Difficulty, instance.DungeonType, seed)
	assignDungeonRoomHooks(&generated)
	generated.GenerationAttempt = layout.GenerationAttempt
	if !reflect.DeepEqual(generated, layout) {
		return false
	}
	for _, enemy := range replay.Entities {
		for i, room := range layout.Rooms {
			if enemy.SpawnX < room.X-room.Width/2 || enemy.SpawnX > room.X+room.Width/2 || enemy.SpawnZ < room.Z-room.Height/2 || enemy.SpawnZ > room.Z+room.Height/2 {
				continue
			}
			if !instance.RoomState.Rooms[i].Cleared {
				w.Entities[enemy.ID] = enemy
				w.Grid.Add(enemy)
			}
			break
		}
	}
	return true
}
