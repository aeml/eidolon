package game

import (
	"testing"
)

func canonicalMovementTestLayout() DungeonLayout {
	return DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 100, Width: 40, Height: 40, Type: "boss"},
		},
		WalkRects: []DungeonWalkRect{
			{X: 0, Z: 0, Width: 40, Height: 40, Kind: "room", RoomIndex: 0},
			{X: 100, Z: 100, Width: 40, Height: 40, Kind: "room", RoomIndex: 1},
			{X: 57.5, Z: 0, Width: 85, Height: 20, Kind: "corridor"},
			{X: 100, Z: 45, Width: 20, Height: 90, Kind: "corridor"},
		},
		Corridors: []DungeonCorridor{
			{
				FromRoomIndex: 0,
				ToRoomIndex:   1,
				Width:         20,
				WalkRectIndices: []int{2, 3},
			},
		},
	}
}

func TestUpdateEntityPositionConstrainsPlayersInsideCanonicalDungeon(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID:     "dungeon_test",
		Layout: canonicalMovementTestLayout(),
	}

	player := &Entity{
		ID:         "player-1",
		Type:       TypePlayer,
		InstanceID: "dungeon_test",
		X:          0,
		Y:          0,
		Z:          0,
	}
	w.AddEntity(player)

	w.UpdateEntityPosition(player.ID, 50, 0, 50, 1.25)

	if player.X != 50 || player.Z != 10 {
		t.Fatalf("expected position to clamp to nearest canonical walk rect point, got (%v, %v)", player.X, player.Z)
	}
	if player.Rotation != 1.25 {
		t.Fatalf("expected rotation to update, got %v", player.Rotation)
	}
}

func TestUpdateEntityPositionLeavesOverworldMovementUnchanged(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:   "player-2",
		Type: TypePlayer,
		X:    1,
		Y:    0,
		Z:    2,
	}
	w.AddEntity(player)

	w.UpdateEntityPosition(player.ID, 25, 0, 30, 0.5)

	if player.X != 25 || player.Z != 30 {
		t.Fatalf("expected overworld move to remain unchanged, got (%v, %v)", player.X, player.Z)
	}
}

func TestUpdateEntityPositionLeavesEnemiesUnclampedForExplicitAIHandling(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID:     "dungeon_test",
		Layout: canonicalMovementTestLayout(),
	}

	enemy := &Entity{
		ID:         "enemy-1",
		Type:       TypeEnemy,
		InstanceID: "dungeon_test",
		X:          0,
		Y:          0,
		Z:          0,
	}
	w.AddEntity(enemy)

	w.UpdateEntityPosition(enemy.ID, 50, 0, 50, 0)

	if enemy.X != 50 || enemy.Z != 50 {
		t.Fatalf("expected non-player move path to remain unchanged, got (%v, %v)", enemy.X, enemy.Z)
	}
}

func TestDungeonEnemyUpdateKeepsChaseMovementInsideCanonicalWalkRects(t *testing.T) {
	w := NewWorld(nil)
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID:     "dungeon_test",
		Layout: canonicalMovementTestLayout(),
	}

	player := &Entity{
		ID:         "player-1",
		Type:       TypePlayer,
		InstanceID: "dungeon_test",
		X:          100,
		Z:          100,
	}
	enemy := &Entity{
		ID:         "enemy-1",
		Type:       TypeEnemy,
		InstanceID: "dungeon_test",
		X:          0,
		Z:          0,
		SpawnX:     0,
		SpawnZ:     0,
		TargetX:    0,
		TargetZ:    0,
		Speed:      200,
		Damage:     10,
		Health:     100,
		MaxHealth:  100,
		Scale:      1,
	}
	w.AddEntity(player)
	w.AddEntity(enemy)

	w.updateEntity(enemy, 1.0, []*Entity{player}, &deferredActions{})

	if !w.IsLocationInDungeon(enemy.InstanceID, enemy.X, enemy.Z) {
		t.Fatalf("expected chase movement to remain inside dungeon, got (%v, %v)", enemy.X, enemy.Z)
	}
}

func TestDungeonEnemyRoamTargetAndMovementStayInsideCanonicalWalkRects(t *testing.T) {
	w := NewWorld(nil)
	w.Entities = make(map[string]*Entity)
	w.Grid = NewSpatialMap(50.0)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID:     "dungeon_test",
		Layout: canonicalMovementTestLayout(),
	}

	enemy := &Entity{
		ID:         "enemy-roam-1",
		Type:       TypeEnemy,
		InstanceID: "dungeon_test",
		X:          0,
		Z:          0,
		SpawnX:     0,
		SpawnZ:     0,
		TargetX:    0,
		TargetZ:    0,
		Speed:      200,
		Damage:     10,
		Health:     100,
		MaxHealth:  100,
		Scale:      1,
	}
	w.AddEntity(enemy)

	w.updateEntity(enemy, 1.0, nil, &deferredActions{})

	if !w.IsLocationInDungeon(enemy.InstanceID, enemy.TargetX, enemy.TargetZ) {
		t.Fatalf("expected roam target to remain inside dungeon, got (%v, %v)", enemy.TargetX, enemy.TargetZ)
	}
	if !w.IsLocationInDungeon(enemy.InstanceID, enemy.X, enemy.Z) {
		t.Fatalf("expected roam movement to remain inside dungeon, got (%v, %v)", enemy.X, enemy.Z)
	}
}
