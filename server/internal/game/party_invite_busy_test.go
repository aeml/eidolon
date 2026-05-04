package game

// Tests for 0.37.4: CanReceivePartyInvite — busy blocks party invites.

import "testing"

func TestCanReceivePartyInvite_AvailablePlayer_ReturnsTrue(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-avail")
	p.SocialStatus = "available"
	w.AddEntity(p)

	ok, reason := w.CanReceivePartyInvite("player-avail")
	if !ok {
		t.Fatalf("expected ok=true for available player, got reason=%q", reason)
	}
	if reason != "" {
		t.Fatalf("expected empty reason, got %q", reason)
	}
}

func TestCanReceivePartyInvite_LookingPartyPlayer_ReturnsTrue(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-lfg")
	p.SocialStatus = "looking_party"
	w.AddEntity(p)

	ok, reason := w.CanReceivePartyInvite("player-lfg")
	if !ok {
		t.Fatalf("expected ok=true for looking_party player, got reason=%q", reason)
	}
}

func TestCanReceivePartyInvite_InRunPlayer_ReturnsTrue(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-inrun")
	p.SocialStatus = "in_run"
	w.AddEntity(p)

	ok, reason := w.CanReceivePartyInvite("player-inrun")
	if !ok {
		t.Fatalf("expected ok=true for in_run player, got reason=%q", reason)
	}
}

func TestCanReceivePartyInvite_BusyPlayer_ReturnsFalse(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-busy")
	p.SocialStatus = "busy"
	w.AddEntity(p)

	ok, reason := w.CanReceivePartyInvite("player-busy")
	if ok {
		t.Fatal("expected ok=false for busy player")
	}
	if reason != "busy" {
		t.Fatalf("expected reason=busy, got %q", reason)
	}
}

func TestCanReceivePartyInvite_UnknownStatusNormalizesToAvailable_ReturnsTrue(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-weird")
	p.SocialStatus = "some_invalid_status" // normalizes to "available"
	w.AddEntity(p)

	ok, _ := w.CanReceivePartyInvite("player-weird")
	if !ok {
		t.Fatal("expected ok=true for invalid (normalized to available) status")
	}
}

func TestCanReceivePartyInvite_NonExistentPlayer_ReturnsFalse(t *testing.T) {
	w := NewWorld(nil)

	ok, reason := w.CanReceivePartyInvite("ghost-id")
	if ok {
		t.Fatal("expected ok=false for non-existent player")
	}
	if reason != "not_found" {
		t.Fatalf("expected reason=not_found, got %q", reason)
	}
}

func TestCanReceivePartyInvite_EmptySocialStatus_NormalizesToAvailable_ReturnsTrue(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("player-empty")
	p.SocialStatus = "" // empty → normalizes to "available"
	w.AddEntity(p)

	ok, reason := w.CanReceivePartyInvite("player-empty")
	if !ok {
		t.Fatalf("expected ok=true for empty-status player (normalizes to available), got reason=%q", reason)
	}
}
