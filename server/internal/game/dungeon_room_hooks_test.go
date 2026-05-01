package game

import "testing"

func TestAssignDungeonRoomHooksStagesTreasureEarlyAndShrineLate(t *testing.T) {
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

	if layout.Rooms[1].Hook != "chest" {
		t.Fatalf("expected earliest normal room to become chest hook, got %q", layout.Rooms[1].Hook)
	}
	if layout.Rooms[2].Hook != "elite_ambush" {
		t.Fatalf("expected first elite room to become elite ambush hook, got %q", layout.Rooms[2].Hook)
	}
	if layout.Rooms[3].Hook != "shrine" {
		t.Fatalf("expected deepest normal room to become shrine hook, got %q", layout.Rooms[3].Hook)
	}
	if layout.Rooms[0].Hook != "" || layout.Rooms[4].Hook != "" {
		t.Fatalf("expected start/boss rooms to remain unhooked, got start=%q boss=%q", layout.Rooms[0].Hook, layout.Rooms[4].Hook)
	}
	if layout.Rooms[3].Pacing != "boss_approach" {
		t.Fatalf("expected pre-boss room to carry boss approach pacing metadata, got %q", layout.Rooms[3].Pacing)
	}
}

func TestAssignDungeonRoomHooksKeepsApproachPacingSeparateFromRewardHooks(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 500, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	assignDungeonRoomHooks(&layout)

	if layout.Rooms[4].Pacing != "boss_approach" {
		t.Fatalf("expected final traversable room to be marked as boss approach, got %q", layout.Rooms[4].Pacing)
	}
	if layout.Rooms[4].Hook != "shrine" {
		t.Fatalf("expected boss approach pacing to preserve existing reward hook, got %q", layout.Rooms[4].Hook)
	}
	if layout.Rooms[3].Pacing != "" {
		t.Fatalf("expected only the immediate pre-boss room to carry approach pacing, got %q", layout.Rooms[3].Pacing)
	}
}

func TestAssignDungeonRoomHooksAddsSecondRewardAndLateAmbushForLongRuns(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 500, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 600, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	assignDungeonRoomHooks(&layout)

	if layout.Rooms[1].Hook != "chest" {
		t.Fatalf("expected first normal room to remain the early chest pocket, got %q", layout.Rooms[1].Hook)
	}
	if layout.Rooms[3].Hook != "chest" {
		t.Fatalf("expected a second deeper normal room to become a later chest pocket, got %q", layout.Rooms[3].Hook)
	}
	if layout.Rooms[2].Hook != "elite_ambush" {
		t.Fatalf("expected first elite room to stay an ambush spike, got %q", layout.Rooms[2].Hook)
	}
	if layout.Rooms[4].Hook != "elite_ambush" {
		t.Fatalf("expected deepest elite room to become a second late ambush spike, got %q", layout.Rooms[4].Hook)
	}
	if layout.Rooms[5].Hook != "shrine" {
		t.Fatalf("expected last normal room to remain the shrine reset, got %q", layout.Rooms[5].Hook)
	}
}

func TestDungeonRoomStateSummaryIncludesRoomHooks(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "shrine"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite", Hook: "elite_ambush"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal", Hook: "chest"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	assignDungeonRoomHooks(&layout)
	state := NewDungeonRoomState(layout)
	summary := state.Summary(100, 0)

	if summary.Rooms[1].Hook != "chest" {
		t.Fatalf("expected chest hook in summary, got %q", summary.Rooms[1].Hook)
	}
	if summary.Rooms[2].Hook != "elite_ambush" {
		t.Fatalf("expected elite ambush hook in summary, got %q", summary.Rooms[2].Hook)
	}
	if summary.Rooms[3].Hook != "shrine" {
		t.Fatalf("expected shrine hook in summary, got %q", summary.Rooms[3].Hook)
	}
	if summary.Rooms[3].Pacing != "boss_approach" {
		t.Fatalf("expected boss approach pacing in summary, got %q", summary.Rooms[3].Pacing)
	}
	if summary.Rooms[1].Identity != "treasure_cache" {
		t.Fatalf("expected chest room identity in summary, got %q", summary.Rooms[1].Identity)
	}
	if summary.Rooms[2].Identity != "ambush_chamber" {
		t.Fatalf("expected elite ambush identity in summary, got %q", summary.Rooms[2].Identity)
	}
	if summary.Rooms[3].Identity != "restorative_shrine" {
		t.Fatalf("expected shrine identity in summary, got %q", summary.Rooms[3].Identity)
	}
	if summary.Rooms[4].Identity != "boss_lair" {
		t.Fatalf("expected boss room identity in summary, got %q", summary.Rooms[4].Identity)
	}
}

func TestDungeonRoomStateSummaryIncludesExpandedLongRunHooks(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 300, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 400, Z: 0, Width: 40, Height: 40, Type: "elite"},
			{X: 500, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 600, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	assignDungeonRoomHooks(&layout)
	state := NewDungeonRoomState(layout)
	summary := state.Summary(100, 0)

	if summary.Rooms[1].Hook != "chest" {
		t.Fatalf("expected early chest hook in summary, got %q", summary.Rooms[1].Hook)
	}
	if summary.Rooms[3].Hook != "chest" {
		t.Fatalf("expected second chest hook in summary, got %q", summary.Rooms[3].Hook)
	}
	if summary.Rooms[4].Hook != "elite_ambush" {
		t.Fatalf("expected deeper ambush hook in summary, got %q", summary.Rooms[4].Hook)
	}
	if summary.Rooms[5].Hook != "shrine" {
		t.Fatalf("expected shrine hook in summary, got %q", summary.Rooms[5].Hook)
	}
	if summary.Rooms[3].Identity != "treasure_cache" {
		t.Fatalf("expected second chest room identity in summary, got %q", summary.Rooms[3].Identity)
	}
	if summary.Rooms[4].Identity != "ambush_chamber" {
		t.Fatalf("expected deeper ambush identity in summary, got %q", summary.Rooms[4].Identity)
	}
}
