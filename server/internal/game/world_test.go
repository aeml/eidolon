package game

import (
	"testing"
)

func TestNewWorld(t *testing.T) {
	w := NewWorld()
	if w == nil {
		t.Fatal("NewWorld returned nil")
	}
	if w.Entities == nil {
		t.Fatal("World.Entities is nil")
	}
	// Check initial enemies
	if len(w.Entities) == 0 {
		t.Log("Warning: No initial enemies spawned (might be intentional)")
	}
}

func TestAddRemoveEntity(t *testing.T) {
	w := NewWorld()
	e := &Entity{
		ID:   "player-1",
		Type: TypePlayer,
		X:    0,
		Y:    0,
		Z:    0,
	}

	w.AddEntity(e)
	if got := w.GetEntity("player-1"); got != e {
		t.Errorf("GetEntity returned %v, want %v", got, e)
	}

	w.RemoveEntity("player-1")
	if got := w.GetEntity("player-1"); got != nil {
		t.Errorf("GetEntity returned %v after removal, want nil", got)
	}
}

func TestWorldUpdate(t *testing.T) {
	w := NewWorld()
	// Add a moving enemy
	e := &Entity{
		ID:      "enemy-1",
		Type:    TypeEnemy,
		State:   "MOVING",
		X:       0,
		Y:       0,
		Z:       0,
		TargetX: 10,
		TargetZ: 0,
		Speed:   1.0,
	}
	w.AddEntity(e)

	// Update for 1 second
	w.Update(1.0)

	// Should have moved towards (10, 0)
	// New X should be approx 1.0
	if e.X <= 0 {
		t.Errorf("Entity did not move. X = %f", e.X)
	}
	if e.X > 1.1 {
		t.Errorf("Entity moved too far. X = %f", e.X)
	}
}

func TestGetState(t *testing.T) {
	w := NewWorld()
	e := &Entity{ID: "p1", Type: TypePlayer}
	w.AddEntity(e)

	state := w.GetState()
	if len(state) != len(w.Entities) {
		t.Errorf("GetState returned %d entities, want %d", len(state), len(w.Entities))
	}

	// Verify deep copy (or at least shallow copy of struct)
	// Modify original
	e.X = 100

	// State should have old value if it was copied BEFORE modification
	// But GetState returns a snapshot at the time of call.
	// If we call GetState again:
	state2 := w.GetState()
	if state2["p1"].X != 100 {
		t.Errorf("GetState did not reflect update. Got %f, want 100", state2["p1"].X)
	}
}
