package game

// Tests for 0.37.4: SetPlayerSocialStatusAutomatic — system-driven status
// transitions respect "busy" on entry and revert only from "in_run" on exit.

import "testing"

// ── Entry: set "in_run" ───────────────────────────────────────────────────────

func TestAutoStatus_EntryFromAvailable_SetsInRun(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p1")
	p.SocialStatus = "available"
	w.AddEntity(p)

	status, changed := w.SetPlayerSocialStatusAutomatic("p1", "in_run")
	if !changed {
		t.Fatal("expected changed=true")
	}
	if status != "in_run" {
		t.Fatalf("expected in_run, got %q", status)
	}
	got := w.GetEntityCopy("p1")
	if got.SocialStatus != "in_run" {
		t.Fatalf("entity SocialStatus not persisted: got %q", got.SocialStatus)
	}
}

func TestAutoStatus_EntryFromLookingParty_SetsInRun(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p2")
	p.SocialStatus = "looking_party"
	w.AddEntity(p)

	status, changed := w.SetPlayerSocialStatusAutomatic("p2", "in_run")
	if !changed {
		t.Fatal("expected changed=true")
	}
	if status != "in_run" {
		t.Fatalf("expected in_run, got %q", status)
	}
}

func TestAutoStatus_EntryFromBusy_DoesNotChange(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p3")
	p.SocialStatus = "busy"
	w.AddEntity(p)

	status, changed := w.SetPlayerSocialStatusAutomatic("p3", "in_run")
	if changed {
		t.Fatal("expected changed=false when player is busy")
	}
	if status != "busy" {
		t.Fatalf("expected returned status=busy, got %q", status)
	}
	got := w.GetEntityCopy("p3")
	if got.SocialStatus != "busy" {
		t.Fatalf("busy status must not be overwritten; got %q", got.SocialStatus)
	}
}

// ── Exit: set "available" ────────────────────────────────────────────────────

func TestAutoStatus_ExitFromInRun_SetsAvailable(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p4")
	p.SocialStatus = "in_run"
	w.AddEntity(p)

	status, changed := w.SetPlayerSocialStatusAutomatic("p4", "available")
	if !changed {
		t.Fatal("expected changed=true")
	}
	if status != "available" {
		t.Fatalf("expected available, got %q", status)
	}
	got := w.GetEntityCopy("p4")
	if got.SocialStatus != "available" {
		t.Fatalf("entity SocialStatus not persisted: got %q", got.SocialStatus)
	}
}

func TestAutoStatus_ExitFromAvailable_DoesNotChange(t *testing.T) {
	// Player manually cleared to available before returning — don't clobber.
	w := NewWorld(nil)
	p := newPlayerEntity("p5")
	p.SocialStatus = "available"
	w.AddEntity(p)

	status, changed := w.SetPlayerSocialStatusAutomatic("p5", "available")
	if changed {
		t.Fatal("expected changed=false when already available")
	}
	if status != "available" {
		t.Fatalf("expected returned status=available, got %q", status)
	}
}

func TestAutoStatus_ExitFromBusy_DoesNotChange(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p6")
	p.SocialStatus = "busy"
	w.AddEntity(p)

	_, changed := w.SetPlayerSocialStatusAutomatic("p6", "available")
	if changed {
		t.Fatal("expected changed=false when player is busy, not in_run")
	}
	got := w.GetEntityCopy("p6")
	if got.SocialStatus != "busy" {
		t.Fatalf("busy status must not be reverted to available; got %q", got.SocialStatus)
	}
}

func TestAutoStatus_ExitFromLookingParty_DoesNotChange(t *testing.T) {
	w := NewWorld(nil)
	p := newPlayerEntity("p7")
	p.SocialStatus = "looking_party"
	w.AddEntity(p)

	_, changed := w.SetPlayerSocialStatusAutomatic("p7", "available")
	if changed {
		t.Fatal("expected changed=false: only revert in_run → available")
	}
	got := w.GetEntityCopy("p7")
	if got.SocialStatus != "looking_party" {
		t.Fatalf("looking_party must not be reverted; got %q", got.SocialStatus)
	}
}

// ── Edge cases ───────────────────────────────────────────────────────────────

func TestAutoStatus_NonExistentPlayer_ReturnsFalse(t *testing.T) {
	w := NewWorld(nil)
	_, changed := w.SetPlayerSocialStatusAutomatic("ghost", "in_run")
	if changed {
		t.Fatal("expected changed=false for unknown player")
	}
}

func TestAutoStatus_NpcIgnored_ReturnsFalse(t *testing.T) {
	w := NewWorld(nil)
	npc := &Entity{ID: "npc-1", Type: TypeNPC, SocialStatus: "available"}
	w.AddEntity(npc)

	_, changed := w.SetPlayerSocialStatusAutomatic("npc-1", "in_run")
	if changed {
		t.Fatal("expected changed=false for NPC entity")
	}
}
