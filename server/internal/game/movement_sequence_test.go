package game

import "testing"

func TestUpdatePlayerMovementAcknowledgesNewestSequenceAndRejectsStaleInput(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-sequenced", Type: TypePlayer, State: "IDLE"}
	w.AddEntity(player)

	if accepted := w.UpdatePlayerMovement(player.ID, 4, 0, 2, 0.5, "MOVING", 2); !accepted {
		t.Fatal("expected newest movement sample to be accepted")
	}
	if player.LastMoveSequence != 2 || player.X != 4 || player.Z != 2 || player.State != "MOVING" {
		t.Fatalf("unexpected accepted movement state: sequence=%d position=(%v,%v) state=%s", player.LastMoveSequence, player.X, player.Z, player.State)
	}

	if accepted := w.UpdatePlayerMovement(player.ID, -30, 0, -30, -1, "IDLE", 1); accepted {
		t.Fatal("expected stale movement sample to be rejected")
	}
	if player.LastMoveSequence != 2 || player.X != 4 || player.Z != 2 || player.State != "MOVING" {
		t.Fatalf("stale input changed authoritative movement: sequence=%d position=(%v,%v) state=%s", player.LastMoveSequence, player.X, player.Z, player.State)
	}
}

func TestUpdatePlayerMovementAcknowledgesCanonicalDungeonClamp(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["dungeon_movement_sequence"] = &DungeonInstance{
		ID:     "dungeon_movement_sequence",
		Layout: canonicalMovementTestLayout(),
	}
	player := &Entity{
		ID:         "player-clamped-sequence",
		Type:       TypePlayer,
		InstanceID: "dungeon_movement_sequence",
		State:      "MOVING",
	}
	w.AddEntity(player)

	if accepted := w.UpdatePlayerMovement(player.ID, 50, 0, 50, 0, "IDLE", 7); !accepted {
		t.Fatal("expected clamped movement sample to be accepted")
	}
	if player.X != 50 || player.Z != 10 {
		t.Fatalf("expected canonical clamp to (50,10), got (%v,%v)", player.X, player.Z)
	}
	if player.LastMoveSequence != 7 {
		t.Fatalf("expected clamp acknowledgement sequence 7, got %d", player.LastMoveSequence)
	}
	if player.State != "IDLE" {
		t.Fatalf("expected accepted idle edge, got %s", player.State)
	}
}
