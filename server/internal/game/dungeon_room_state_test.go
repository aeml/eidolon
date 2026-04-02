package game

import "testing"

func TestDungeonRoomStateTracksExplorationAndClears(t *testing.T) {
	layout := DungeonLayout{
		Rooms: []DungeonRoom{
			{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
			{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
			{X: 200, Z: 0, Width: 40, Height: 40, Type: "boss"},
		},
	}

	state := NewDungeonRoomState(layout)
	if got := state.CurrentRoomIndex(0, 0); got != 0 {
		t.Fatalf("expected start room index 0, got %d", got)
	}

	state.MarkExploredAt(0, 0)
	state.MarkExploredAt(100, 0)
	state.MarkRoomCleared(1)

	summary := state.Summary(100, 0)
	if len(summary.Rooms) != 3 {
		t.Fatalf("expected 3 room summaries, got %d", len(summary.Rooms))
	}
	if !summary.Rooms[0].Explored {
		t.Fatalf("expected room 0 to be explored")
	}
	if !summary.Rooms[1].Explored || !summary.Rooms[1].Cleared {
		t.Fatalf("expected room 1 to be explored and cleared")
	}
	if summary.Rooms[2].Explored || summary.Rooms[2].Cleared {
		t.Fatalf("expected untouched boss room to remain hidden/uncleared")
	}
	if summary.CurrentRoomIndex != 1 {
		t.Fatalf("expected current room index 1, got %d", summary.CurrentRoomIndex)
	}
	if summary.ObjectiveRoomIndex != 2 {
		t.Fatalf("expected boss room to be current objective, got %d", summary.ObjectiveRoomIndex)
	}
}

func TestWorldTracksDungeonRoomProgressForPlayers(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-1", Type: TypePlayer}
	w.AddEntity(player)

	instanceID := w.CreateDungeon("party-1", "verdant_bastion_catacombs", DifficultyNormal, 40)
	if err := w.EnterInstance(player.ID, instanceID); err != nil {
		t.Fatalf("enter instance: %v", err)
	}

	inst := w.InstanceLayouts[instanceID]
	if len(inst.Layout.Rooms) < 2 {
		t.Fatalf("expected generated dungeon to have multiple rooms")
	}

	start := inst.Layout.Rooms[0]
	next := inst.Layout.Rooms[1]

	w.UpdateDungeonRoomProgress(player.ID, start.X, start.Z)
	w.UpdateDungeonRoomProgress(player.ID, next.X, next.Z)
	w.MarkDungeonRoomCleared(instanceID, 1)

	summary, ok := w.GetDungeonRoomSummary(instanceID, player.ID)
	if !ok {
		t.Fatalf("expected dungeon room summary for player")
	}
	if !summary.Rooms[0].Explored {
		t.Fatalf("expected start room explored")
	}
	if !summary.Rooms[1].Explored || !summary.Rooms[1].Cleared {
		t.Fatalf("expected next room explored and cleared")
	}
	if summary.CurrentRoomIndex != 1 {
		t.Fatalf("expected current room index 1, got %d", summary.CurrentRoomIndex)
	}
	if summary.ObjectiveRoomIndex < 0 {
		t.Fatalf("expected a next objective room index")
	}
}
