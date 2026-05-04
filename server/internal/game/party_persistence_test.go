package game

import (
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// RejoinParty
// ---------------------------------------------------------------------------

func TestRejoinParty_SuccessfullyAddsPlayerToExistingParty(t *testing.T) {
	w := NewWorld(nil)

	leader := newPlayerEntity("player-leader")
	member := newPlayerEntity("player-member")
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("player-leader")
	if party == nil {
		t.Fatal("CreateParty returned nil")
	}

	// Simulate member having left (e.g. logout) and then rejoining.
	if err := w.RejoinParty("player-member", party.ID); err != nil {
		t.Fatalf("RejoinParty failed: %v", err)
	}

	p := w.GetParty(party.ID)
	if p == nil {
		t.Fatal("party not found after RejoinParty")
	}
	_, _, members := p.GetSnapshot()
	found := false
	for _, mid := range members {
		if mid == "player-member" {
			found = true
		}
	}
	if !found {
		t.Error("player-member not in party.Members after RejoinParty")
	}

	// Entity PartyID must be set.
	w.Mu.RLock()
	e := w.Entities["player-member"]
	w.Mu.RUnlock()
	if e.PartyID != party.ID {
		t.Errorf("entity.PartyID = %q, want %q", e.PartyID, party.ID)
	}
}

func TestRejoinParty_PartyNotFound(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-x")
	w.AddEntity(p)

	err := w.RejoinParty("player-x", "party-nonexistent")
	if err == nil {
		t.Error("RejoinParty should return error when party does not exist")
	}
}

func TestRejoinParty_PartyFull(t *testing.T) {
	w := NewWorld(nil)

	// Create a 5-member party to fill it.
	ids := []string{"player-p0", "player-p1", "player-p2", "player-p3", "player-p4"}
	for _, id := range ids {
		w.AddEntity(newPlayerEntity(id))
	}
	party := w.CreateParty("player-p0")
	if party == nil {
		t.Fatal("CreateParty returned nil")
	}
	for _, id := range ids[1:] {
		if err := w.JoinParty(party.ID, id); err != nil {
			t.Fatalf("JoinParty(%s) failed: %v", id, err)
		}
	}

	// One more player tries to rejoin a full party.
	extra := newPlayerEntity("player-extra")
	w.AddEntity(extra)
	err := w.RejoinParty("player-extra", party.ID)
	if err == nil {
		t.Error("RejoinParty should return error when party is full")
	}
}

func TestRejoinParty_PlayerNotFound(t *testing.T) {
	w := NewWorld(nil)
	leader := newPlayerEntity("player-leader2")
	w.AddEntity(leader)
	party := w.CreateParty("player-leader2")

	err := w.RejoinParty("player-ghost", party.ID)
	if err == nil {
		t.Error("RejoinParty should return error when player entity does not exist")
	}
}

// ---------------------------------------------------------------------------
// RemoveExpiredMemberFromParty
// ---------------------------------------------------------------------------

func TestRemoveExpiredMemberFromParty_RemovesMemberFromParty(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(newPlayerEntity("player-a"))
	w.AddEntity(newPlayerEntity("player-b"))

	party := w.CreateParty("player-a")
	if err := w.JoinParty(party.ID, "player-b"); err != nil {
		t.Fatal(err)
	}

	// Simulate expiry sweep: entity is already gone from world.
	w.Mu.Lock()
	delete(w.Entities, "player-b")
	w.Mu.Unlock()

	w.RemoveExpiredMemberFromParty("player-b", party.ID)

	p := w.GetParty(party.ID)
	if p == nil {
		t.Fatal("party should still exist after non-leader member removed")
	}
	_, _, members := p.GetSnapshot()
	for _, mid := range members {
		if mid == "player-b" {
			t.Error("player-b should have been removed from party.Members")
		}
	}
}

func TestRemoveExpiredMemberFromParty_DisbandWhenEmpty(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(newPlayerEntity("player-sole"))
	party := w.CreateParty("player-sole")

	// Remove the sole member from the world, then expire them.
	w.Mu.Lock()
	delete(w.Entities, "player-sole")
	w.Mu.Unlock()

	w.RemoveExpiredMemberFromParty("player-sole", party.ID)

	if w.GetParty(party.ID) != nil {
		t.Error("empty party should have been disbanded")
	}
}

func TestRemoveExpiredMemberFromParty_PromotesLeaderWhenLeaderExpires(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(newPlayerEntity("player-lead"))
	w.AddEntity(newPlayerEntity("player-follower"))

	party := w.CreateParty("player-lead")
	if err := w.JoinParty(party.ID, "player-follower"); err != nil {
		t.Fatal(err)
	}

	// Expire the leader.
	w.Mu.Lock()
	delete(w.Entities, "player-lead")
	w.Mu.Unlock()

	w.RemoveExpiredMemberFromParty("player-lead", party.ID)

	p := w.GetParty(party.ID)
	if p == nil {
		t.Fatal("party should still exist")
	}
	_, leaderID, _ := p.GetSnapshot()
	if leaderID != "player-follower" {
		t.Errorf("new leader should be player-follower, got %q", leaderID)
	}
}

func TestRemoveExpiredMemberFromParty_NoopWhenPartyGone(t *testing.T) {
	w := NewWorld(nil)
	// Should not panic when the party doesn't exist.
	w.RemoveExpiredMemberFromParty("player-x", "party-nonexistent")
}

// ---------------------------------------------------------------------------
// Party slot retained during resume window (0.37.1)
// ---------------------------------------------------------------------------

// TestPartySlotRetainedDuringResumeWindow verifies that calling
// SetEntityDisconnected does NOT remove the player from their party.
func TestPartySlotRetainedDuringResumeWindow(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(newPlayerEntity("player-g"))
	w.AddEntity(newPlayerEntity("player-h"))

	party := w.CreateParty("player-g")
	if err := w.JoinParty(party.ID, "player-h"); err != nil {
		t.Fatal(err)
	}

	// player-h disconnects — entity stays in world with Disconnected=true.
	w.SetEntityDisconnected("player-h", time.Now())

	p := w.GetParty(party.ID)
	if p == nil {
		t.Fatal("party should still exist after member disconnects")
	}
	_, _, members := p.GetSnapshot()
	found := false
	for _, mid := range members {
		if mid == "player-h" {
			found = true
		}
	}
	if !found {
		t.Error("player-h should remain in party while inside the resume window")
	}
}

// TestPartyCleanedUpAfterSweepExpiry verifies that a party membership is
// cleaned up when the resume window expires (caller invokes
// RemoveExpiredMemberFromParty after CollectExpiredDisconnectedPlayers).
func TestPartyCleanedUpAfterSweepExpiry(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(newPlayerEntity("player-i"))
	w.AddEntity(newPlayerEntity("player-j"))

	party := w.CreateParty("player-i")
	if err := w.JoinParty(party.ID, "player-j"); err != nil {
		t.Fatal(err)
	}

	// player-j disconnects well outside the resume window.
	w.SetEntityDisconnected("player-j", time.Now().Add(-10*time.Minute))

	// Sweep collects player-j (5-minute window).
	expired := w.CollectExpiredDisconnectedPlayers(5 * time.Minute)
	if len(expired) != 1 || expired[0].ID != "player-j" {
		t.Fatalf("expected player-j to be collected, got %v", expired)
	}

	// Caller cleans up party membership (mirrors sweep goroutine in main.go).
	for _, e := range expired {
		if e.PartyID != "" {
			w.RemoveExpiredMemberFromParty(e.ID, e.PartyID)
		}
	}

	p := w.GetParty(party.ID)
	if p == nil {
		t.Fatal("party should still exist (leader player-i is still online)")
	}
	_, _, members := p.GetSnapshot()
	for _, mid := range members {
		if mid == "player-j" {
			t.Error("player-j should have been removed from party after sweep expiry")
		}
	}
}
