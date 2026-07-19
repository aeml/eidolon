package game

import "testing"

func TestWorldSetsAndNormalizesPlayerSocialStatus(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-1", Type: TypePlayer}
	w.AddEntity(player)

	status, ok := w.SetPlayerSocialStatus("player-1", "looking_party")
	if !ok {
		t.Fatal("expected social status update to succeed")
	}
	if status != "looking_party" {
		t.Fatalf("expected looking_party status, got %q", status)
	}

	status, ok = w.SetPlayerSocialStatus("player-1", "unexpected")
	if !ok {
		t.Fatal("expected invalid status normalization to still update player")
	}
	if status != DefaultSocialStatus {
		t.Fatalf("expected invalid status to normalize to %q, got %q", DefaultSocialStatus, status)
	}
}

func TestWorldCopiesPlayerSocialStatus(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{ID: "player-1", Type: TypePlayer, SocialStatus: "busy"}
	w.AddEntity(player)

	copy := w.GetEntityCopy("player-1")
	if copy == nil {
		t.Fatal("expected entity copy")
	}
	if copy.SocialStatus != "busy" {
		t.Fatalf("expected copied social status, got %q", copy.SocialStatus)
	}
}

func TestStateForPlayerCopiesPartySocialAndJumpReplication(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(&Entity{ID: "viewer", Type: TypePlayer, X: 0, Z: 0})
	w.AddEntity(&Entity{
		ID:           "member",
		Type:         TypePlayer,
		X:            10,
		Z:            0,
		PartyID:      "party-viewer",
		SocialStatus: "looking_party",
		State:        "JUMPING",
		JumpStartX:   10,
		JumpStartZ:   0,
		JumpTargetX:  20,
		JumpTargetZ:  5,
		JumpDuration: 0.75,
		JumpHeight:   8,
		JumpProgress: 0.4,
	})

	member := w.GetStateForPlayer("viewer", 200)["member"]
	if member == nil {
		t.Fatal("expected nearby party member in player state")
	}
	if member.PartyID != "party-viewer" || member.SocialStatus != "looking_party" {
		t.Fatalf("state copy lost party/social fields: party=%q status=%q", member.PartyID, member.SocialStatus)
	}
	if member.JumpTargetX != 20 || member.JumpTargetZ != 5 || member.JumpProgress != 0.4 {
		t.Fatalf("state copy lost jump metadata: target=(%.1f, %.1f) progress=%.2f", member.JumpTargetX, member.JumpTargetZ, member.JumpProgress)
	}
}
