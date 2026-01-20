package game

import (
	"testing"
)

func TestCreateParty(t *testing.T) {
	w := NewWorld(nil)

	// Create a player
	player := &Entity{
		ID:   "player-1",
		Type: TypePlayer,
	}
	w.AddEntity(player)

	party := w.CreateParty("player-1")
	if party == nil {
		t.Fatal("CreateParty returned nil")
	}

	if party.LeaderID != "player-1" {
		t.Errorf("Expected leader to be player-1, got %s", party.LeaderID)
	}

	if len(party.Members) != 1 {
		t.Errorf("Expected 1 member, got %d", len(party.Members))
	}

	if party.Members[0] != "player-1" {
		t.Errorf("Expected first member to be player-1, got %s", party.Members[0])
	}

	if party.MaxSize != 5 {
		t.Errorf("Expected max size 5, got %d", party.MaxSize)
	}

	// Verify player has party ID set
	if player.PartyID != party.ID {
		t.Errorf("Player PartyID not set correctly")
	}
}

func TestCreatePartyNonexistentPlayer(t *testing.T) {
	w := NewWorld(nil)

	party := w.CreateParty("nonexistent")
	if party != nil {
		t.Error("Expected nil for nonexistent player")
	}
}

func TestCreatePartyAlreadyInParty(t *testing.T) {
	w := NewWorld(nil)

	player := &Entity{
		ID:      "player-1",
		Type:    TypePlayer,
		PartyID: "existing-party",
	}
	w.AddEntity(player)

	party := w.CreateParty("player-1")
	if party != nil {
		t.Error("Expected nil for player already in party")
	}
}

func TestJoinParty(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member := &Entity{ID: "member", Type: TypePlayer}
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("leader")
	if party == nil {
		t.Fatal("Failed to create party")
	}

	err := w.JoinParty(party.ID, "member")
	if err != nil {
		t.Errorf("JoinParty failed: %v", err)
	}

	if len(party.Members) != 2 {
		t.Errorf("Expected 2 members, got %d", len(party.Members))
	}

	if member.PartyID != party.ID {
		t.Error("Member PartyID not set")
	}
}

func TestJoinPartyNotFound(t *testing.T) {
	w := NewWorld(nil)

	player := &Entity{ID: "player", Type: TypePlayer}
	w.AddEntity(player)

	err := w.JoinParty("nonexistent-party", "player")
	if err == nil {
		t.Error("Expected error for nonexistent party")
	}
}

func TestJoinPartyPlayerNotFound(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	w.AddEntity(leader)
	party := w.CreateParty("leader")

	err := w.JoinParty(party.ID, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent player")
	}
}

func TestJoinPartyAlreadyInParty(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member := &Entity{ID: "member", Type: TypePlayer, PartyID: "other-party"}
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("leader")

	err := w.JoinParty(party.ID, "member")
	if err == nil {
		t.Error("Expected error for player already in party")
	}
}

func TestJoinPartyFull(t *testing.T) {
	w := NewWorld(nil)

	// Create party with leader
	leader := &Entity{ID: "leader", Type: TypePlayer}
	w.AddEntity(leader)
	party := w.CreateParty("leader")

	// Fill up the party (max 5)
	for i := 1; i < 5; i++ {
		member := &Entity{ID: "member-" + string(rune('0'+i)), Type: TypePlayer}
		w.AddEntity(member)
		w.JoinParty(party.ID, member.ID)
	}

	// Try to add 6th member
	extra := &Entity{ID: "extra", Type: TypePlayer}
	w.AddEntity(extra)

	err := w.JoinParty(party.ID, "extra")
	if err == nil {
		t.Error("Expected error for full party")
	}
}

func TestLeaveParty(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member := &Entity{ID: "member", Type: TypePlayer}
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("leader")
	w.JoinParty(party.ID, "member")

	// Member leaves
	updatedParty, err := w.LeaveParty("member")
	if err != nil {
		t.Errorf("LeaveParty failed: %v", err)
	}

	if updatedParty == nil {
		t.Fatal("Expected party to be returned")
	}

	if len(updatedParty.Members) != 1 {
		t.Errorf("Expected 1 member remaining, got %d", len(updatedParty.Members))
	}

	if member.PartyID != "" {
		t.Error("Member PartyID should be empty")
	}
}

func TestLeavePartyLeaderTransfer(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member := &Entity{ID: "member", Type: TypePlayer}
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("leader")
	w.JoinParty(party.ID, "member")

	// Leader leaves - should transfer leadership
	updatedParty, err := w.LeaveParty("leader")
	if err != nil {
		t.Errorf("LeaveParty failed: %v", err)
	}

	if updatedParty == nil {
		t.Fatal("Expected party to be returned")
	}

	if updatedParty.LeaderID != "member" {
		t.Errorf("Expected new leader to be 'member', got %s", updatedParty.LeaderID)
	}
}

func TestLeavePartyDisband(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	w.AddEntity(leader)

	party := w.CreateParty("leader")
	partyID := party.ID

	// Leader leaves - party should disband
	updatedParty, err := w.LeaveParty("leader")
	if err != nil {
		t.Errorf("LeaveParty failed: %v", err)
	}

	if updatedParty != nil {
		t.Error("Expected nil (disbanded)")
	}

	// Verify party is gone
	if _, exists := w.Parties[partyID]; exists {
		t.Error("Party should have been deleted")
	}
}

func TestLeavePartyNotInParty(t *testing.T) {
	w := NewWorld(nil)

	player := &Entity{ID: "player", Type: TypePlayer}
	w.AddEntity(player)

	_, err := w.LeaveParty("player")
	if err == nil {
		t.Error("Expected error for player not in party")
	}
}

func TestKickPartyMember(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member := &Entity{ID: "member", Type: TypePlayer}
	w.AddEntity(leader)
	w.AddEntity(member)

	party := w.CreateParty("leader")
	w.JoinParty(party.ID, "member")

	// Leader kicks member
	updatedParty, err := w.KickPartyMember("leader", "member")
	if err != nil {
		t.Errorf("KickPartyMember failed: %v", err)
	}

	if updatedParty == nil {
		t.Fatal("Expected party to be returned")
	}

	if len(updatedParty.Members) != 1 {
		t.Errorf("Expected 1 member, got %d", len(updatedParty.Members))
	}

	if member.PartyID != "" {
		t.Error("Kicked member should have empty PartyID")
	}
}

func TestKickPartyMemberNotLeader(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	member1 := &Entity{ID: "member1", Type: TypePlayer}
	member2 := &Entity{ID: "member2", Type: TypePlayer}
	w.AddEntity(leader)
	w.AddEntity(member1)
	w.AddEntity(member2)

	party := w.CreateParty("leader")
	w.JoinParty(party.ID, "member1")
	w.JoinParty(party.ID, "member2")

	// Non-leader tries to kick
	_, err := w.KickPartyMember("member1", "member2")
	if err == nil {
		t.Error("Expected error when non-leader tries to kick")
	}
}

func TestPartyMaxSize(t *testing.T) {
	w := NewWorld(nil)

	leader := &Entity{ID: "leader", Type: TypePlayer}
	w.AddEntity(leader)
	party := w.CreateParty("leader")

	if party.MaxSize != 5 {
		t.Errorf("Expected max party size 5, got %d", party.MaxSize)
	}
}
