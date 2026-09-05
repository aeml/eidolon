package game

import (
	"fmt"
	"math"
	"strings"
	"testing"
)

func validTwoRoomDungeonLayout() DungeonLayout {
	layout := DungeonLayout{}
	appendDungeonRoom(&layout, DungeonRoom{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"})
	appendDungeonRoomAndConnect(&layout, DungeonRoom{X: 100, Z: 0, Width: 40, Height: 40, Type: "boss"}, canonicalDungeonCorridorWidth)
	return layout
}

func TestValidateDungeonLayoutRejectsDisconnectedRoom(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 150, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
		WalkRects: []DungeonWalkRect{
			{X: 0, Z: 0, Width: 40, Height: 40, Kind: "room", RoomIndex: 0},
			{X: 150, Z: 0, Width: 40, Height: 40, Kind: "room", RoomIndex: 1},
		},
	}

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected disconnected layout to fail validation")
	}
	if !strings.Contains(err.Error(), "reachable") && !strings.Contains(err.Error(), "connection") {
		t.Fatalf("expected connectivity validation error, got %v", err)
	}
}

func TestValidateDungeonLayoutRejectsCorridorWithoutRoomOverlap(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 100, Width: 40, Height: 40, Type: "boss"},
		},
		WalkRects: []DungeonWalkRect{
			{X: 0, Z: 0, Width: 40, Height: 40, Kind: "room", RoomIndex: 0},
			{X: 100, Z: 100, Width: 40, Height: 40, Kind: "room", RoomIndex: 1},
			{X: 50, Z: 50, Width: 20, Height: 20, Kind: "corridor"},
		},
		Corridors: []DungeonCorridor{
			{
				FromRoomIndex:   0,
				ToRoomIndex:     1,
				Width:           20,
				WalkRectIndices: []int{2},
			},
		},
	}

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected invalid corridor attachment to fail validation")
	}
	if !strings.Contains(err.Error(), "overlap") && !strings.Contains(err.Error(), "attach") {
		t.Fatalf("expected overlap validation error, got %v", err)
	}
}

func TestIsLocationInDungeonUsesCanonicalWalkRects(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID: "dungeon_test",
		Layout: DungeonLayout{
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
					FromRoomIndex:   0,
					ToRoomIndex:     1,
					Width:           20,
					WalkRectIndices: []int{2, 3},
				},
			},
		},
	}

	if !w.IsLocationInDungeon("dungeon_test", 50, 0) {
		t.Fatal("expected point inside canonical corridor walk rect to be in dungeon")
	}
	if w.IsLocationInDungeon("dungeon_test", 50, 50) {
		t.Fatal("expected point outside canonical walk rects to be out of dungeon")
	}
}

func TestGeneratedDungeonLayoutsPopulateCanonicalGeometryAndValidate(t *testing.T) {
	w := NewWorld(nil)

	generators := map[string]func(string, DungeonDifficulty) DungeonLayout{
		"verdant_bastion": w.generateVerdantBastionLayout,
		"molten_core":     w.generateMoltenCoreLayout,
		"tempest_spire":   w.generateTempestSpireLayout,
		"abyssal_well":    w.generateAbyssalWellLayout,
	}

	for name, generator := range generators {
		for i := 0; i < 3; i++ {
			layout := generator(fmt.Sprintf("%s-validation-%d", name, i), DifficultyNormal)
			if len(layout.WalkRects) == 0 {
				t.Fatalf("%s: expected canonical walk rects", name)
			}
			if len(layout.Corridors) == 0 {
				t.Fatalf("%s: expected canonical corridors", name)
			}
			if err := ValidateDungeonLayout(layout); err != nil {
				t.Fatalf("%s: generated layout failed validation: %v", name, err)
			}
		}
	}
}

func TestGeneratedDungeonLayoutsKeepBossApproachLongEnoughForCanonicalCorridors(t *testing.T) {
	w := NewWorld(nil)

	generators := map[string]func(string, DungeonDifficulty) DungeonLayout{
		"verdant_bastion": w.generateVerdantBastionLayout,
		"molten_core":     w.generateMoltenCoreLayout,
		"tempest_spire":   w.generateTempestSpireLayout,
		"abyssal_well":    w.generateAbyssalWellLayout,
	}

	for name, generator := range generators {
		for i := 0; i < 5; i++ {
			layout := generator(fmt.Sprintf("%s-approach-%d", name, i), DifficultyNormal)
			for corridorIndex, corridor := range layout.Corridors {
				if corridor.ToRoomIndex <= 0 || corridor.ToRoomIndex >= len(layout.Rooms) {
					continue
				}
				toRoom := layout.Rooms[corridor.ToRoomIndex]
				if toRoom.Type != "boss" {
					continue
				}
				corridorRects := make([]DungeonWalkRect, 0, len(corridor.WalkRectIndices))
				for _, rectIndex := range corridor.WalkRectIndices {
					if rectIndex < 0 || rectIndex >= len(layout.WalkRects) {
						t.Fatalf("%s: corridor %d references invalid walk rect %d", name, corridorIndex, rectIndex)
					}
					corridorRects = append(corridorRects, layout.WalkRects[rectIndex])
				}
				if len(corridorRects) == 0 {
					t.Fatalf("%s: boss corridor %d has no canonical walk rects", name, corridorIndex)
				}

				approachRect := corridorRects[len(corridorRects)-1]
				if nearlyEqual(approachRect.X, toRoom.X) {
					approachLen := math.Abs(approachRect.Height-toRoom.Height) / 2
					if approachLen+0.001 < corridor.Width/2 {
						t.Fatalf("%s: boss corridor %d vertical approach %.2f is shorter than half corridor width %.2f for room width %.2f", name, corridorIndex, approachLen, corridor.Width/2, toRoom.Width)
					}
				} else if nearlyEqual(approachRect.Z, toRoom.Z) {
					approachLen := math.Abs(approachRect.Width-toRoom.Width) / 2
					if approachLen+0.001 < corridor.Width/2 {
						t.Fatalf("%s: boss corridor %d horizontal approach %.2f is shorter than half corridor width %.2f for room width %.2f", name, corridorIndex, approachLen, corridor.Width/2, toRoom.Width)
					}
				} else {
					t.Fatalf("%s: boss corridor %d terminal rect does not align with target room center axis", name, corridorIndex)
				}
			}
		}
	}
}

func TestValidateDungeonLayoutRejectsRoomWalkRectThatDoesNotExactlyMatchRoom(t *testing.T) {
	layout := validTwoRoomDungeonLayout()
	layout.WalkRects[0].X += 1

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected room walk rect mismatch to fail validation")
	}
	if !strings.Contains(err.Error(), "exactly match") {
		t.Fatalf("expected exact-match validation error, got %v", err)
	}
}

func TestValidateDungeonLayoutRejectsUnreferencedCorridorWalkRect(t *testing.T) {
	layout := validTwoRoomDungeonLayout()
	layout.WalkRects = append(layout.WalkRects, DungeonWalkRect{
		X:      250,
		Z:      0,
		Width:  20,
		Height: 20,
		Kind:   "corridor",
	})

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected stray corridor walk rect to fail validation")
	}
	if !strings.Contains(err.Error(), "unreferenced corridor walk rect") {
		t.Fatalf("expected unreferenced corridor walk rect error, got %v", err)
	}
}

func TestValidateDungeonLayoutRejectsDuplicateCorridorWalkRectReference(t *testing.T) {
	layout := validTwoRoomDungeonLayout()
	dupIndex := layout.Corridors[0].WalkRectIndices[0]
	layout.Corridors[0].WalkRectIndices = append(layout.Corridors[0].WalkRectIndices, dupIndex)

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected duplicate corridor walk rect reference to fail validation")
	}
	if !strings.Contains(err.Error(), "referenced more than once") {
		t.Fatalf("expected duplicate corridor walk rect reference error, got %v", err)
	}
}

func TestValidateDungeonLayoutRejectsMultipleStartRooms(t *testing.T) {
	layout := validTwoRoomDungeonLayout()
	layout.Rooms[1].Type = "start"

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected multiple start rooms to fail validation")
	}
	if !strings.Contains(err.Error(), "exactly one start room") {
		t.Fatalf("expected exactly-one-start-room error, got %v", err)
	}
}

func TestValidateDungeonLayoutRejectsStartRoomOutsideIndexZero(t *testing.T) {
	layout := validTwoRoomDungeonLayout()
	layout.Rooms[0].Type = "normal"
	layout.Rooms[1].Type = "start"

	err := ValidateDungeonLayout(layout)
	if err == nil {
		t.Fatal("expected non-zero start room index to fail validation")
	}
	if !strings.Contains(err.Error(), "room 0") {
		t.Fatalf("expected start-room-index validation error, got %v", err)
	}
}

func TestDungeonFallbackLayoutUsesDungeonTypeOffsets(t *testing.T) {
	tests := []struct {
		name        string
		dungeonType string
		wantX       float64
		wantZ       float64
	}{
		{name: "default crypt", dungeonType: "crypt", wantX: 0, wantZ: 0},
		{name: "verdant bastion", dungeonType: "verdant_bastion_catacombs", wantX: 20000, wantZ: 20000},
		{name: "molten core", dungeonType: "molten_core", wantX: 30000, wantZ: 20000},
		{name: "tempest spire", dungeonType: "tempest_spire", wantX: 40000, wantZ: 20000},
		{name: "abyssal well", dungeonType: "abyssal_well", wantX: 50000, wantZ: 20000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layout := fallbackDungeonLayout(tt.dungeonType)
			if len(layout.Rooms) != 1 {
				t.Fatalf("expected one fallback room, got %d", len(layout.Rooms))
			}
			if got := layout.Rooms[0]; got.Type != "start" || got.X != tt.wantX || got.Z != tt.wantZ {
				t.Fatalf("unexpected fallback room: %+v", got)
			}
			if err := ValidateDungeonLayout(layout); err != nil {
				t.Fatalf("fallback layout should validate: %v", err)
			}
		})
	}
}
