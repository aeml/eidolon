package main

// Tests for 0.37.0: party_id and social_status in proto pipeline.
// Covers entityToSnapshot, hasEntityChanged, and entityToProto for the new fields.

import (
	"testing"

	"eidolon-server/internal/game"
)

// --- entityToSnapshot ---

func TestEntityToSnapshot_StoresPartyID(t *testing.T) {
	e := &game.Entity{
		ID:          "p1",
		Type:        game.TypePlayer,
		SubType:     "Fighter",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		PartyID:     "party-abc",
	}
	snap := entityToSnapshot(e)
	if snap.PartyID != "party-abc" {
		t.Fatalf("expected snapshot.PartyID=party-abc, got %q", snap.PartyID)
	}
}

func TestEntityToSnapshot_StoresSocialStatus(t *testing.T) {
	e := &game.Entity{
		ID:           "p2",
		Type:         game.TypePlayer,
		SubType:      "Fighter",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SocialStatus: "looking_for_party",
	}
	snap := entityToSnapshot(e)
	if snap.SocialStatus != "looking_for_party" {
		t.Fatalf("expected snapshot.SocialStatus=looking_for_party, got %q", snap.SocialStatus)
	}
}

func TestGuildIdentityReplicatesAndTriggersDelta(t *testing.T) {
	e := &game.Entity{
		ID: "guild-player", Type: game.TypePlayer, SubType: "Cleric", State: "IDLE",
		TalentRanks: map[string]int{}, GuildID: "guild-1", GuildTag: "DUSK",
	}
	snap := entityToSnapshot(e)
	if snap.GuildID != "guild-1" || snap.GuildTag != "DUSK" {
		t.Fatalf("snapshot guild identity = %q/%q", snap.GuildID, snap.GuildTag)
	}
	pb := entityToProto(e)
	if pb.GuildId != "guild-1" || pb.GuildTag != "DUSK" {
		t.Fatalf("protobuf guild identity = %q/%q", pb.GuildId, pb.GuildTag)
	}
	e.GuildTag = "DAWN"
	if !hasEntityChanged(e, snap) {
		t.Fatal("guild tag change must produce a state delta")
	}
}

func TestEntityToSnapshot_EmptyPartyAndStatusByDefault(t *testing.T) {
	e := &game.Entity{
		ID:          "p3",
		Type:        game.TypePlayer,
		SubType:     "Wizard",
		State:       "IDLE",
		TalentRanks: map[string]int{},
	}
	snap := entityToSnapshot(e)
	if snap.PartyID != "" {
		t.Fatalf("expected empty PartyID, got %q", snap.PartyID)
	}
	if snap.SocialStatus != "" {
		t.Fatalf("expected empty SocialStatus, got %q", snap.SocialStatus)
	}
}

// --- hasEntityChanged ---

func TestHasEntityChanged_PartyIDChange_ReturnsTrue(t *testing.T) {
	e := &game.Entity{
		ID:          "p4",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		PartyID:     "party-xyz",
	}
	snap := entityToSnapshot(e)

	// Simulate joining a different party
	e.PartyID = "party-new"
	if !hasEntityChanged(e, snap) {
		t.Fatal("expected hasEntityChanged=true when PartyID changes")
	}
}

func TestHasEntityChanged_PartyIDLeave_ReturnsTrue(t *testing.T) {
	e := &game.Entity{
		ID:          "p5",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		PartyID:     "party-xyz",
	}
	snap := entityToSnapshot(e)

	// Simulate leaving the party
	e.PartyID = ""
	if !hasEntityChanged(e, snap) {
		t.Fatal("expected hasEntityChanged=true when player leaves party (PartyID cleared)")
	}
}

func TestHasEntityChanged_PartyIDUnchanged_ReturnsFalse(t *testing.T) {
	e := &game.Entity{
		ID:          "p6",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		PartyID:     "party-stable",
	}
	snap := entityToSnapshot(e)

	if hasEntityChanged(e, snap) {
		t.Fatal("expected hasEntityChanged=false when PartyID is unchanged")
	}
}

func TestHasEntityChanged_SocialStatusChange_ReturnsTrue(t *testing.T) {
	e := &game.Entity{
		ID:           "p7",
		Type:         game.TypePlayer,
		SubType:      "Cleric",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SocialStatus: "available",
	}
	snap := entityToSnapshot(e)

	e.SocialStatus = "in_run"
	if !hasEntityChanged(e, snap) {
		t.Fatal("expected hasEntityChanged=true when SocialStatus changes")
	}
}

func TestHasEntityChanged_SocialStatusUnchanged_ReturnsFalse(t *testing.T) {
	e := &game.Entity{
		ID:           "p8",
		Type:         game.TypePlayer,
		SubType:      "Cleric",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SocialStatus: "busy",
	}
	snap := entityToSnapshot(e)

	if hasEntityChanged(e, snap) {
		t.Fatal("expected hasEntityChanged=false when SocialStatus is unchanged")
	}
}

// --- entityToProto ---

func TestEntityToProto_PopulatesPartyId(t *testing.T) {
	e := &game.Entity{
		ID:          "p9",
		Type:        game.TypePlayer,
		SubType:     "Fighter",
		State:       "IDLE",
		TalentRanks: map[string]int{},
		PartyID:     "party-proto",
	}
	pb := entityToProto(e)
	if pb == nil {
		t.Fatal("entityToProto returned nil")
	}
	if pb.PartyId != "party-proto" {
		t.Fatalf("expected pb.PartyId=party-proto, got %q", pb.PartyId)
	}
}

func TestEntityToProto_PopulatesSocialStatus(t *testing.T) {
	e := &game.Entity{
		ID:           "p10",
		Type:         game.TypePlayer,
		SubType:      "Wizard",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SocialStatus: "looking_for_party",
	}
	pb := entityToProto(e)
	if pb == nil {
		t.Fatal("entityToProto returned nil")
	}
	if pb.SocialStatus != "looking_for_party" {
		t.Fatalf("expected pb.SocialStatus=looking_for_party, got %q", pb.SocialStatus)
	}
}

func TestEntityToProto_EmptyPartyAndStatusByDefault(t *testing.T) {
	e := &game.Entity{
		ID:          "p11",
		Type:        game.TypePlayer,
		SubType:     "Rogue",
		State:       "IDLE",
		TalentRanks: map[string]int{},
	}
	pb := entityToProto(e)
	if pb.PartyId != "" {
		t.Fatalf("expected empty pb.PartyId, got %q", pb.PartyId)
	}
	if pb.SocialStatus != "" {
		t.Fatalf("expected empty pb.SocialStatus, got %q", pb.SocialStatus)
	}
}

func TestEntityToProto_PopulatesJumpMetadata(t *testing.T) {
	e := &game.Entity{
		ID:           "p12",
		Type:         game.TypePlayer,
		SubType:      "Fighter",
		State:        "JUMPING",
		TalentRanks:  map[string]int{},
		JumpStartX:   1,
		JumpStartY:   2,
		JumpStartZ:   3,
		JumpTargetX:  11,
		JumpTargetY:  2,
		JumpTargetZ:  13,
		JumpDuration: 0.75,
		JumpHeight:   8.5,
		JumpProgress: 0.4,
	}
	pb := entityToProto(e)
	if pb == nil {
		t.Fatal("entityToProto returned nil")
	}
	if pb.JumpStartX != 1 || pb.JumpStartY != 2 || pb.JumpStartZ != 3 {
		t.Fatalf("expected jump start (1,2,3), got (%.2f,%.2f,%.2f)", pb.JumpStartX, pb.JumpStartY, pb.JumpStartZ)
	}
	if pb.JumpTargetX != 11 || pb.JumpTargetY != 2 || pb.JumpTargetZ != 13 {
		t.Fatalf("expected jump target (11,2,13), got (%.2f,%.2f,%.2f)", pb.JumpTargetX, pb.JumpTargetY, pb.JumpTargetZ)
	}
	if pb.JumpDuration != 0.75 || pb.JumpHeight != 8.5 || pb.JumpProgress != 0.4 {
		t.Fatalf("expected jump timing metadata, got duration=%.2f height=%.2f progress=%.2f", pb.JumpDuration, pb.JumpHeight, pb.JumpProgress)
	}
}
