package game

import (
	"fmt"
	"reflect"
	"sort"
	"testing"
)

func resumeEncounterSignatures(w *World, instance *DungeonInstance) []string {
	var result []string
	for _, e := range w.Entities {
		if e.InstanceID != instance.ID || e.Type != TypeEnemy {
			continue
		}
		for i, room := range instance.Layout.Rooms {
			if e.SpawnX >= room.X-room.Width/2 && e.SpawnX <= room.X+room.Width/2 && e.SpawnZ >= room.Z-room.Height/2 && e.SpawnZ <= room.Z+room.Height/2 {
				if !instance.RoomState.Rooms[i].Cleared {
					result = append(result, fmt.Sprintf("%d/%s/%d/%.8f/%.8f/%v/%v/%v/%v/%v/%v", i, e.SubType, e.Level, e.SpawnX, e.SpawnZ, e.MaxHealth, e.Damage, e.Speed, e.Scale, e.AttackSpeed, e.BaseStats))
				}
				break
			}
		}
	}
	sort.Strings(result)
	return result
}

func TestRestoredSeededDungeonPreservesUnclearedEncounterComposition(t *testing.T) {
	for _, dungeonType := range []string{"verdant_bastion_catacombs", "molten_core", "tempest_spire", "abyssal_well", "umbral_nexus", "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid"} {
		t.Run(dungeonType, func(t *testing.T) {
			w := NewWorld(nil)
			defer w.StopBackground()
			id := w.CreateDungeon("resume-composition", dungeonType, DifficultyNormal, 70)
			instance, _ := w.getDungeonInstance(id)
			// Include the exact earned Molten pack that exposed the discrepancy.
			if dungeonType == "molten_core" {
				for key, e := range w.Entities {
					if e.InstanceID == id {
						w.Grid.Remove(e)
						delete(w.Entities, key)
					}
				}
				instance.Layout = w.generateDungeonLayoutWithSeed(id, DifficultyNormal, dungeonType, -1634763615133968283)
				assignDungeonRoomHooks(&instance.Layout)
				instance.RoomState = NewDungeonRoomState(instance.Layout)
			}
			clearedRoom := 0
			if len(instance.Layout.Rooms) > 2 {
				clearedRoom = 1
			}
			instance.RoomState.MarkRoomCleared(clearedRoom)
			want := resumeEncounterSignatures(w, instance)
			if len(want) == 0 {
				t.Fatal("fixture has no pending encounters")
			}
			snapshot, _ := w.GetDungeonResumeSnapshot(id)
			restored := NewWorld(nil)
			defer restored.StopBackground()
			if err := restored.RestoreDungeon(snapshot); err != nil {
				t.Fatal(err)
			}
			gotInstance, _ := restored.getDungeonInstance(id)
			if got := resumeEncounterSignatures(restored, gotInstance); !reflect.DeepEqual(got, want) {
				t.Fatalf("restore changed enemy types, counts, positions or combat profiles:\n got %v\nwant %v", got, want)
			}
			for _, e := range restored.Entities {
				if e.InstanceID == id {
					room := instance.Layout.Rooms[clearedRoom]
					if e.SpawnX >= room.X-room.Width/2 && e.SpawnX <= room.X+room.Width/2 && e.SpawnZ >= room.Z-room.Height/2 && e.SpawnZ <= room.Z+room.Height/2 {
						t.Fatal("cleared encounter respawned")
					}
				}
			}
			after, _ := restored.GetDungeonResumeSnapshot(id)
			if !reflect.DeepEqual(snapshot, after) {
				t.Fatal("restore altered saved geometry, progress or timestamps")
			}
		})
	}
}

func TestRestoredEncounterReplayRejectsUnmatchedSavedGeometry(t *testing.T) {
	for _, variant := range []string{"old-version", "missing-seed", "changed-layout", "fallback"} {
		t.Run(variant, func(t *testing.T) {
			w := NewWorld(nil)
			defer w.StopBackground()
			id := w.CreateDungeon("resume-compatibility", "molten_core", DifficultyHeroic, 100)
			instance, _ := w.getDungeonInstance(id)
			switch variant {
			case "old-version":
				instance.Layout.GeneratorVersion--
			case "missing-seed":
				instance.Layout.GenerationSeed = ""
			case "changed-layout":
				instance.Layout.Rooms[1].Color++
			case "fallback":
				instance.Layout.GenerationFallback = true
			}
			before := len(w.Entities)
			if w.replayRestoredDungeonEncounters(instance) || len(w.Entities) != before {
				t.Fatal("unmatched replay affected live encounters")
			}
			snapshot, _ := w.GetDungeonResumeSnapshot(id)
			restored := NewWorld(nil)
			defer restored.StopBackground()
			if err := restored.RestoreDungeon(snapshot); err != nil {
				t.Fatal(err)
			}
			after, _ := restored.GetDungeonResumeSnapshot(id)
			if !reflect.DeepEqual(snapshot, after) {
				t.Fatal("compatibility restore changed authoritative save")
			}
			if len(restored.Entities) == 0 {
				t.Fatal("compatibility restore lost encounters")
			}
		})
	}
}
