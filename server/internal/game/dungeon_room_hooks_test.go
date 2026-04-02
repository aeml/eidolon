package game

import "testing"

func TestAssignDungeonRoomHooksAddsChestShrineAndEliteAmbushHooks(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	assignDungeonRoomHooks(&layout)

	if layout.Rooms[1].Hook != "shrine" {
		t.Fatalf("expected first normal room to become shrine hook, got %q", layout.Rooms[1].Hook)
	}
	if layout.Rooms[2].Hook != "elite_ambush" {
		t.Fatalf("expected first elite room to become elite ambush hook, got %q", layout.Rooms[2].Hook)
	}
	if layout.Rooms[3].Hook != "chest" {
		t.Fatalf("expected last normal room to become chest hook, got %q", layout.Rooms[3].Hook)
	}
	if layout.Rooms[0].Hook != "" || layout.Rooms[4].Hook != "" {
		t.Fatalf("expected start/boss rooms to remain unhooked, got start=%q boss=%q", layout.Rooms[0].Hook, layout.Rooms[4].Hook)
	}
}

func TestDungeonRoomStateSummaryIncludesRoomHooks(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "shrine"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite", Hook: "elite_ambush"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "chest"},
		},
	}

	state := NewDungeonRoomState(layout)
	summary := state.Summary(100, 0)

	if summary.Rooms[1].Hook != "shrine" {
		t.Fatalf("expected shrine hook in summary, got %q", summary.Rooms[1].Hook)
	}
	if summary.Rooms[2].Hook != "elite_ambush" {
		t.Fatalf("expected elite ambush hook in summary, got %q", summary.Rooms[2].Hook)
	}
	if summary.Rooms[3].Hook != "chest" {
		t.Fatalf("expected chest hook in summary, got %q", summary.Rooms[3].Hook)
	}
}