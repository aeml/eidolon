package game

import (
	"testing"
	"time"
)

// helpers ----------------------------------------------------------------

func newPlayerEntity(id string) *Entity {
	return &Entity{
		ID:   id,
		Type: TypePlayer,
		X:    10,
		Y:    0,
		Z:    20,
	}
}

// SetEntityDisconnected --------------------------------------------------

func TestSetEntityDisconnected_MarksEntity(t *testing.T) {
	w := NewWorld(nil)
	e := newPlayerEntity("player-alice")
	w.AddEntity(e)

	now := time.Now()
	ok := w.SetEntityDisconnected("player-alice", now)
	if !ok {
		t.Fatal("SetEntityDisconnected returned false for existing entity")
	}

	w.Mu.RLock()
	defer w.Mu.RUnlock()
	got := w.Entities["player-alice"]
	if got == nil {
		t.Fatal("entity was removed from world; expected it to remain")
	}
	if !got.Disconnected {
		t.Error("entity.Disconnected should be true")
	}
	if !got.DisconnectedAt.Equal(now) {
		t.Errorf("entity.DisconnectedAt = %v, want %v", got.DisconnectedAt, now)
	}
	if got.State != "IDLE" {
		t.Errorf("entity.State = %q, want IDLE", got.State)
	}
}

func TestSetEntityDisconnected_MissingEntity(t *testing.T) {
	w := NewWorld(nil)
	ok := w.SetEntityDisconnected("player-nobody", time.Now())
	if ok {
		t.Error("SetEntityDisconnected should return false for non-existent entity")
	}
}

// ClearEntityDisconnected ------------------------------------------------

func TestClearEntityDisconnected_ReturnsEntityAndClearsFlag(t *testing.T) {
	w := NewWorld(nil)
	e := newPlayerEntity("player-bob")
	w.AddEntity(e)
	w.SetEntityDisconnected("player-bob", time.Now())

	got, ok := w.ClearEntityDisconnected("player-bob")
	if !ok {
		t.Fatal("ClearEntityDisconnected returned false for disconnected entity")
	}
	if got == nil {
		t.Fatal("ClearEntityDisconnected returned nil entity")
	}
	if got.Disconnected {
		t.Error("entity.Disconnected should be false after clear")
	}
	if !got.DisconnectedAt.IsZero() {
		t.Errorf("entity.DisconnectedAt should be zero, got %v", got.DisconnectedAt)
	}
}

func TestClearEntityDisconnected_NotDisconnected(t *testing.T) {
	w := NewWorld(nil)
	e := newPlayerEntity("player-carol")
	w.AddEntity(e)

	// Entity exists but is NOT in disconnected state.
	_, ok := w.ClearEntityDisconnected("player-carol")
	if ok {
		t.Error("ClearEntityDisconnected should return false when entity is not disconnected")
	}
}

func TestClearEntityDisconnected_MissingEntity(t *testing.T) {
	w := NewWorld(nil)
	_, ok := w.ClearEntityDisconnected("player-nobody")
	if ok {
		t.Error("ClearEntityDisconnected should return false for non-existent entity")
	}
}

// CollectExpiredDisconnectedPlayers --------------------------------------

func TestCollectExpiredDisconnectedPlayers_RemovesExpired(t *testing.T) {
	w := NewWorld(nil)

	// Add two disconnected players: one expired, one not.
	expired := newPlayerEntity("player-expired")
	w.AddEntity(expired)
	w.SetEntityDisconnected("player-expired", time.Now().Add(-10*time.Minute))

	fresh := newPlayerEntity("player-fresh")
	w.AddEntity(fresh)
	w.SetEntityDisconnected("player-fresh", time.Now())

	// Window: 5 minutes; only "expired" should be collected.
	collected := w.CollectExpiredDisconnectedPlayers(5 * time.Minute)

	if len(collected) != 1 {
		t.Fatalf("expected 1 expired entity, got %d", len(collected))
	}
	if collected[0].ID != "player-expired" {
		t.Errorf("expected player-expired, got %s", collected[0].ID)
	}

	// "expired" should no longer be in the world.
	if w.GetEntity("player-expired") != nil {
		t.Error("player-expired should have been removed from world")
	}
	// "fresh" should still be in the world.
	if w.GetEntity("player-fresh") == nil {
		t.Error("player-fresh should still be in world")
	}
}

func TestCollectExpiredDisconnectedPlayers_IgnoresConnectedPlayers(t *testing.T) {
	w := NewWorld(nil)

	connected := newPlayerEntity("player-connected")
	w.AddEntity(connected)
	// Do NOT call SetEntityDisconnected — entity is connected.

	collected := w.CollectExpiredDisconnectedPlayers(0)
	for _, e := range collected {
		if e.ID == "player-connected" {
			t.Error("connected player should not be collected")
		}
	}
}

func TestCollectExpiredDisconnectedPlayers_IgnoresNonPlayers(t *testing.T) {
	w := NewWorld(nil)

	npc := &Entity{
		ID:   "npc-1",
		Type: TypeEnemy,
	}
	w.AddEntity(npc)

	// Manually mark it disconnected (shouldn't happen in practice, but test defensiveness).
	w.Mu.Lock()
	if e, ok := w.Entities["npc-1"]; ok {
		e.Disconnected = true
		e.DisconnectedAt = time.Now().Add(-1 * time.Hour)
	}
	w.Mu.Unlock()

	collected := w.CollectExpiredDisconnectedPlayers(0)
	for _, e := range collected {
		if e.ID == "npc-1" {
			t.Error("non-player entity should not be collected")
		}
	}
}

// Full round-trip: disconnect then resume ---------------------------------

func TestDisconnectAndResume_RoundTrip(t *testing.T) {
	w := NewWorld(nil)

	playerID := "player-dave"
	e := newPlayerEntity(playerID)
	e.Health = 80
	w.AddEntity(e)

	// Disconnect.
	if ok := w.SetEntityDisconnected(playerID, time.Now()); !ok {
		t.Fatal("SetEntityDisconnected failed")
	}

	// Entity should still be in world.
	if w.GetEntity(playerID) == nil {
		t.Fatal("entity should still be in world after disconnect")
	}

	// Resume: clear disconnected flag, get live pointer.
	resumed, ok := w.ClearEntityDisconnected(playerID)
	if !ok {
		t.Fatal("ClearEntityDisconnected failed")
	}
	if resumed.Health != 80 {
		t.Errorf("resumed entity health = %d, want 80", resumed.Health)
	}
	if resumed.Disconnected {
		t.Error("resumed entity should not be marked disconnected")
	}

	// Entity is still in world and usable.
	if w.GetEntity(playerID) == nil {
		t.Fatal("entity should still be in world after resume")
	}
}

// 0.36.4 — double-resume guard -------------------------------------------

// TestDoubleResume_SecondAttemptFails verifies that a second call to
// ClearEntityDisconnected on an already-resumed entity returns false,
// preventing a stale token from rebinding a live session.
func TestDoubleResume_SecondAttemptFails(t *testing.T) {
	w := NewWorld(nil)

	playerID := "player-eve"
	e := newPlayerEntity(playerID)
	w.AddEntity(e)

	w.SetEntityDisconnected(playerID, time.Now())

	// First resume succeeds.
	_, ok := w.ClearEntityDisconnected(playerID)
	if !ok {
		t.Fatal("first ClearEntityDisconnected should succeed")
	}

	// Second resume (stale token path) must fail — entity is no longer disconnected.
	_, ok2 := w.ClearEntityDisconnected(playerID)
	if ok2 {
		t.Error("second ClearEntityDisconnected should return false: entity is already active")
	}
}

// TestResumeAfterWindow_EntityRemoved verifies that an entity removed by the
// sweep goroutine (expired window) cannot be resumed.
func TestResumeAfterWindow_EntityRemoved(t *testing.T) {
	w := NewWorld(nil)

	playerID := "player-frank"
	e := newPlayerEntity(playerID)
	w.AddEntity(e)

	// Disconnect with a timestamp well outside the 5-minute window.
	w.SetEntityDisconnected(playerID, time.Now().Add(-10*time.Minute))

	// Sweep removes the expired entity.
	collected := w.CollectExpiredDisconnectedPlayers(5 * time.Minute)
	if len(collected) == 0 {
		t.Fatal("expected expired entity to be collected by sweep")
	}

	// A resume attempt after sweep must fail.
	_, ok := w.ClearEntityDisconnected(playerID)
	if ok {
		t.Error("ClearEntityDisconnected should fail for an entity already removed by the sweep")
	}
	if w.GetEntity(playerID) != nil {
		t.Error("entity should not be in world after sweep removes it")
	}
}
