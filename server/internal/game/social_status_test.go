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
