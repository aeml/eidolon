package game

import "testing"

func TestDungeonResumeSnapshotRestoresClearedRoomsAndEncounters(t *testing.T) {
	w := NewWorld(nil)
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"})
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: 0, Z: -100, Width: 40, Height: 40, Type: "normal"}, canonicalDungeonCorridorWidth)
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: 0, Z: -200, Width: 60, Height: 60, Type: "boss"}, canonicalDungeonCorridorWidth)
	state := NewDungeonRoomState(layout)
	state.MarkRoomCleared(1)
	instance := &DungeonInstance{
		ID: "dungeon_resume_test", PartyID: "party-player-a", Layout: layout,
		Difficulty: DifficultyHeroic, DungeonType: "verdant_bastion_catacombs", RunLevel: 60,
		RoomState: state, PlayerRoomSummary: make(map[string]DungeonRoomSummary),
	}
	w.storeDungeonInstance(instance.ID, instance)

	snapshot, ok := w.GetDungeonResumeSnapshot(instance.ID)
	if !ok || !snapshot.Rooms[1].Cleared {
		t.Fatalf("resume snapshot did not preserve cleared room: %+v", snapshot)
	}
	snapshot.Layout.Rooms[1].Type = "mutated"
	if layoutAfter, _ := w.GetInstanceLayout(instance.ID); layoutAfter.Rooms[1].Type != "normal" {
		t.Fatal("resume snapshot leaked mutable layout storage")
	}

	restoredWorld := NewWorld(nil)
	snapshot.Layout.Rooms[1].Type = "normal"
	if err := restoredWorld.RestoreDungeon(snapshot); err != nil {
		t.Fatalf("restore dungeon: %v", err)
	}
	if err := restoredWorld.RestoreDungeon(snapshot); err != nil {
		t.Fatalf("idempotent restore dungeon: %v", err)
	}
	summary, ok := restoredWorld.GetDungeonRoomSummary(instance.ID, "player-a")
	if !ok || !summary.Rooms[1].Cleared {
		t.Fatalf("restored summary lost cleared room: %+v", summary)
	}

	restoredWorld.Mu.RLock()
	bosses := 0
	clearedRoomEnemies := 0
	for _, entity := range restoredWorld.Entities {
		if entity.InstanceID != instance.ID || entity.Type != TypeEnemy {
			continue
		}
		if entity.SubType == "RootboundWarden" {
			bosses++
		}
		if entity.SpawnZ == -100 {
			clearedRoomEnemies++
		}
	}
	restoredWorld.Mu.RUnlock()
	if bosses != 1 || clearedRoomEnemies != 0 {
		t.Fatalf("restored encounters mismatch: bosses=%d clearedRoomEnemies=%d", bosses, clearedRoomEnemies)
	}
}

func TestRestoreDungeonRejectsUntrustedState(t *testing.T) {
	w := NewWorld(nil)
	for _, snapshot := range []DungeonResumeSnapshot{
		{},
		{ID: "overworld", RunLevel: 30, Layout: fallbackDungeonLayout("crypt")},
		{ID: "dungeon_bad", RunLevel: MaxPlayerLevel + 1, Layout: fallbackDungeonLayout("crypt")},
	} {
		if err := w.RestoreDungeon(snapshot); err == nil {
			t.Fatalf("expected invalid snapshot to fail: %+v", snapshot)
		}
	}
}
