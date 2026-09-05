package game

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"
)

func TestDungeonFallbackContainsEveryRequiredEncounterRoom(t *testing.T) {
	types := append(append([]string(nil), replayDungeonTypes...), "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid")
	for _, dungeonType := range types {
		t.Run(dungeonType, func(t *testing.T) {
			layout := fallbackDungeonLayout(dungeonType)
			if err := ValidateDungeonLayout(layout); err != nil {
				t.Fatal(err)
			}
			_, _, bosses := dungeonEncounterCatalog(dungeonType)
			bossRooms, ordinaryRooms := 0, 0
			for _, room := range layout.Rooms {
				if room.Type == "boss" {
					bossRooms++
				}
				if room.Type == "normal" || room.Type == "elite" {
					ordinaryRooms++
				}
			}
			if bossRooms != len(bosses) || ordinaryRooms < 2 {
				t.Fatalf("fallback cannot finish the adventure: bosses=%d want=%d ordinary=%d", bossRooms, len(bosses), ordinaryRooms)
			}
			if _, raid := ElementalRaidDefinitionForType(dungeonType); raid && layout.Rooms[len(layout.Rooms)-1].Hook != "crystal_vigil" {
				t.Fatal("fallback lost the defended crystal-repair event")
			}
		})
	}
}

func TestRetryExhaustionBuildsAndPopulatesFullFallback(t *testing.T) {
	types := append(append([]string(nil), replayDungeonTypes...), "weekly_raid", "earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid")
	for _, dungeonType := range types {
		for _, difficulty := range []DungeonDifficulty{DifficultyNormal, DifficultyHeroic, DifficultyMythic} {
			t.Run(dungeonType+"/"+string(difficulty), func(t *testing.T) {
				w := NewWorld(nil)
				instance := &DungeonInstance{ID: "dungeon_forced_fallback", PartyID: "fallback-party", DungeonType: dungeonType, Difficulty: difficulty, RunLevel: 100, PlayerRoomSummary: make(map[string]DungeonRoomSummary)}
				w.storeDungeonInstance(instance.ID, instance)
				foreign := &Entity{ID: "unrelated-actor", InstanceID: "another-run", Type: TypeEnemy, Health: 123}
				w.AddEntity(foreign)
				attempts := 0
				w.Mu.Lock()
				w.buildDungeonInstanceLayoutLocked(instance, func(id string, difficulty DungeonDifficulty, kind string, seed int64) DungeonLayout {
					attempts++
					layout := w.generateDungeonLayoutWithSeed(id, difficulty, kind, seed)
					// Geometry is valid but a required encounter is missing. The
					// retry gate must reject it and clean up all other trial actors.
					_, _, bosses := dungeonEncounterCatalog(kind)
					bossID := fmt.Sprintf("%s-%s", bosses[0], id)
					w.Grid.Remove(w.Entities[bossID])
					delete(w.Entities, bossID)
					return layout
				})
				w.Mu.Unlock()
				if attempts != 8 || !instance.Layout.GenerationFallback || instance.Layout.GenerationAttempt != 7 {
					t.Fatalf("retry exhaustion not recorded: attempts=%d layout=%+v", attempts, instance.Layout)
				}
				if instance.Layout.GenerationSeed != strconv.FormatInt(dungeonLayoutSeed(instance.ID, 7), 10) || instance.Layout.GeneratorVersion != dungeonGeneratorVersion {
					t.Fatal("fallback lost the final failing seed/version")
				}
				if err := validateDungeonProgressionLayout(dungeonType, instance.Layout); err != nil {
					t.Fatal(err)
				}
				if err := w.validateGeneratedDungeonBosses(instance, instance.Layout); err != nil {
					t.Fatal(err)
				}
				_, _, bosses := dungeonEncounterCatalog(dungeonType)
				count := 0
				for _, actor := range w.Entities {
					if actor.InstanceID != instance.ID {
						continue
					}
					count++
					if !isPointInDungeonLayout(instance.Layout, actor.X, actor.Z) || actor.Health <= 0 || actor.Level != 100 {
						t.Fatalf("invalid fallback actor: %s", actor.SubType)
					}
				}
				// Each boss block has three normal enemies, one elite, one boss.
				if count != len(bosses)*5 {
					t.Fatalf("failed-attempt actors leaked or fallback actors missing: %d", count)
				}
				if w.Entities[foreign.ID] != foreign || foreign.Health != 123 {
					t.Fatal("generation touched another instance")
				}
				for _, room := range instance.RoomState.Rooms {
					if room.Cleared || room.Rewarded {
						t.Fatal("fallback bypassed encounters or granted rewards")
					}
				}
			})
		}
	}
}

func TestGenerationRetriesCanRecoverWithoutFallback(t *testing.T) {
	w := NewWorld(nil)
	instance := &DungeonInstance{ID: "dungeon_retry_recovery", DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal, RunLevel: 30}
	w.storeDungeonInstance(instance.ID, instance)
	attempts := 0
	w.Mu.Lock()
	w.buildDungeonInstanceLayoutLocked(instance, func(id string, difficulty DungeonDifficulty, kind string, seed int64) DungeonLayout {
		attempts++
		layout := w.generateDungeonLayoutWithSeed(id, difficulty, kind, seed)
		if attempts < 3 {
			layout.Rooms = nil
		}
		return layout
	})
	w.Mu.Unlock()
	if attempts != 3 || instance.Layout.GenerationFallback || instance.Layout.GenerationAttempt != 2 {
		t.Fatal("successful retry did not stop the fallback path")
	}
	if err := w.validateGeneratedDungeonBosses(instance, instance.Layout); err != nil {
		t.Fatal(err)
	}
}

func TestQAFallbackUsesNormalEntryGatesAndIsConsumedOnce(t *testing.T) {
	w := NewWorld(nil)
	player := newTestPlayer("fallback-qa", "Wizard")
	w.AddEntity(player)
	w.SetPlayerLevel(player.ID, 1)
	party := w.CreateParty(player.ID)
	if !w.ArmPlayerQADungeonFallback(player.ID) {
		t.Fatal("could not arm fallback for the town leader")
	}
	if _, _, err := w.EnterPartyDungeon(player.ID, "verdant_bastion_catacombs", DifficultyNormal, 30); err == nil {
		t.Fatal("fallback bypassed the level gate")
	}
	if !player.QADungeonFallbackNext {
		t.Fatal("failed entry consumed the fallback selection")
	}
	w.SetPlayerLevel(player.ID, 100)
	run, _, err := w.EnterPartyDungeon(player.ID, "verdant_bastion_catacombs", DifficultyNormal, 30)
	if err != nil {
		t.Fatal(err)
	}
	layout, _ := w.GetInstanceLayout(run.InstanceID)
	if !layout.GenerationFallback || player.QADungeonFallbackNext {
		t.Fatal("fresh entry did not consume exactly one fallback selection")
	}
	w.PerformRecall(player.ID)
	if err := w.ResetDungeon(party.ID); err != nil {
		t.Fatal(err)
	}
	run, _, err = w.EnterPartyDungeon(player.ID, "verdant_bastion_catacombs", DifficultyNormal, 30)
	if err != nil {
		t.Fatal(err)
	}
	layout, _ = w.GetInstanceLayout(run.InstanceID)
	if layout.GenerationFallback {
		t.Fatal("fallback selection leaked into later normal runs")
	}
}

func TestFallbackResumeRetainsGeometryAndClearedEncounters(t *testing.T) {
	w := NewWorld(nil)
	instance := &DungeonInstance{ID: "dungeon_saved_fallback", PartyID: "saved-fallback", DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyHeroic, RunLevel: 100}
	w.storeDungeonInstance(instance.ID, instance)
	w.Mu.Lock()
	w.buildDungeonInstanceLayoutLocked(instance, func(string, DungeonDifficulty, string, int64) DungeonLayout { return DungeonLayout{} })
	w.Mu.Unlock()
	// This test covers persistence of an already-cleared encounter, not combat.
	instance.RoomState.Rooms[1].Cleared, instance.RoomState.Rooms[1].Rewarded = true, true
	instance.RoomState.Rooms[3].Cleared = true
	snapshot, _ := w.GetDungeonResumeSnapshot(instance.ID)
	snapshot.Layout.GeneratorVersion = 1 // A valid older layout must not be regenerated.
	restoredWorld := NewWorld(nil)
	if err := restoredWorld.RestoreDungeon(snapshot); err != nil {
		t.Fatal(err)
	}
	restored, _ := restoredWorld.GetDungeonResumeSnapshot(instance.ID)
	if !reflect.DeepEqual(restored.Layout, snapshot.Layout) {
		t.Fatal("restoration changed the saved fallback geometry or identity")
	}
	if !restored.Rooms[1].Rewarded || !restored.Rooms[3].Cleared {
		t.Fatal("restoration lost encounter progress")
	}
	if restoredWorld.Entities["RootboundWarden-"+instance.ID] != nil {
		t.Fatal("restoration respawned a cleared boss")
	}
	if restoredWorld.Entities["HollowSentinel-"+instance.ID] == nil {
		t.Fatal("restoration lost the final boss")
	}
}

func TestRestoreRepairsOnlyTheOldEmptyFallback(t *testing.T) {
	for _, dungeonType := range replayDungeonTypes {
		t.Run(dungeonType, func(t *testing.T) {
			full := fallbackDungeonLayout(dungeonType)
			old := DungeonLayout{GenerationFallback: true, GeneratorVersion: 1, GenerationSeed: "9223372036854775807", GenerationAttempt: 7}
			start := full.Rooms[0]
			start.Width, start.Height = 40, 40
			appendDungeonRoom(&old, start)
			snapshot := DungeonResumeSnapshot{ID: "dungeon_old_fallback", PartyID: "legacy-fallback", DungeonType: dungeonType, Difficulty: DifficultyNormal, RunLevel: 100, Layout: old, Rooms: []DungeonRoomProgress{{Explored: true}}}
			w := NewWorld(nil)
			if err := w.RestoreDungeon(snapshot); err != nil {
				t.Fatal(err)
			}
			repaired, _ := w.GetDungeonResumeSnapshot(snapshot.ID)
			if len(repaired.Layout.Rooms) != len(full.Rooms) || repaired.Layout.GenerationSeed != old.GenerationSeed || repaired.Layout.GeneratorVersion != dungeonGeneratorVersion {
				t.Fatal("legacy empty fallback remained stranded or lost its failed-seed reference")
			}
			if !repaired.Rooms[0].Explored {
				t.Fatal("lost starting-room exploration")
			}
			_, _, bosses := dungeonEncounterCatalog(dungeonType)
			if w.Entities[bosses[len(bosses)-1]+"-"+snapshot.ID] == nil {
				t.Fatal("restored fallback has no terminal boss")
			}
		})
	}
}
