package game

import "testing"

func TestStartPlayerJumpClampsTargetInsideCanonicalDungeon(t *testing.T) {
	w := NewWorld(nil)
	w.InstanceLayouts["dungeon_test"] = &DungeonInstance{
		ID:     "dungeon_test",
		Layout: canonicalMovementTestLayout(),
	}

	player := &Entity{
		ID:         "player-1",
		Type:       TypePlayer,
		InstanceID: "dungeon_test",
		X:          0,
		Y:          0,
		Z:          0,
		State:      "IDLE",
	}
	w.AddEntity(player)

	started := w.StartPlayerJump(player.ID, 50, 0, 50)
	if !started {
		t.Fatalf("expected jump request to start")
	}

	if player.State != "JUMPING" {
		t.Fatalf("expected player state JUMPING, got %q", player.State)
	}
	if player.JumpTargetX != 50 || player.JumpTargetZ != 10 {
		t.Fatalf("expected jump target to clamp to nearest walkable point (50,10), got (%.2f, %.2f)", player.JumpTargetX, player.JumpTargetZ)
	}
	if player.JumpProgress != 0 {
		t.Fatalf("expected jump progress to start at 0, got %.2f", player.JumpProgress)
	}
	if player.JumpHeight < 14 {
		t.Fatalf("expected higher jump arc for long jumps, got height %.2f", player.JumpHeight)
	}
	if player.JumpDuration < 1.1 {
		t.Fatalf("expected longer airtime for long jumps, got duration %.2f", player.JumpDuration)
	}
}

func TestWorldUpdateAdvancesJumpAndLandsPlayer(t *testing.T) {
	w := NewWorld(nil)
	player := &Entity{
		ID:           "player-2",
		Type:         TypePlayer,
		X:            0,
		Y:            0,
		Z:            0,
		State:        "JUMPING",
		JumpStartX:   0,
		JumpStartY:   0,
		JumpStartZ:   0,
		JumpTargetX:  12,
		JumpTargetY:  0,
		JumpTargetZ:  0,
		JumpDuration: 0.5,
		JumpElapsed:  0,
		JumpHeight:   6,
		JumpProgress: 0,
		TargetX:      0,
		TargetZ:      0,
	}
	w.AddEntity(player)

	w.Update(0.25)
	if player.State != "JUMPING" {
		t.Fatalf("expected player to still be jumping mid-flight, got %q", player.State)
	}
	if player.X <= 0 || player.X >= 12 {
		t.Fatalf("expected player to advance mid-jump, got X=%.2f", player.X)
	}
	if player.Y <= 0 {
		t.Fatalf("expected player to gain airborne height, got Y=%.2f", player.Y)
	}
	if player.JumpProgress <= 0 || player.JumpProgress >= 1 {
		t.Fatalf("expected partial jump progress, got %.2f", player.JumpProgress)
	}

	w.Update(0.25)
	if player.State != "IDLE" {
		t.Fatalf("expected landed player to return to IDLE, got %q", player.State)
	}
	if player.X != 12 || player.Z != 0 {
		t.Fatalf("expected landed position (12,0), got (%.2f, %.2f)", player.X, player.Z)
	}
	if player.Y != 0 {
		t.Fatalf("expected landed Y=0, got %.2f", player.Y)
	}
	if player.JumpProgress != 1 {
		t.Fatalf("expected final jump progress 1, got %.2f", player.JumpProgress)
	}
}
