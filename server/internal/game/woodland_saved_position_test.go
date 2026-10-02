package game

import (
	"strings"
	"testing"
)

func TestWoodlandSavedPositionEscapeIsAcceptedByMovementContext(t *testing.T) {
	w := NewWorld(nil)
	count := 0
	for _, trunk := range worldPopulationFootprints {
		if !strings.HasPrefix(trunk.SiteID, "tree:") {
			continue
		}
		player := &Entity{ID: "saved-" + trunk.SiteID, Type: TypePlayer, State: "IDLE",
			X: trunk.X, Z: trunk.Z, Speed: 5, MovementContext: "woodland-return", RecoveryContextReady: true}
		w.AddEntity(player)
		// The client's normal inside-box resolution steps just beyond the trunk
		// and hero radius, rather than rewriting a save or teleporting to town.
		x := trunk.X + trunk.Width/2 + 1.26
		if !w.UpdatePlayerMovementWithContext(player.ID, x, 0, trunk.Z, 0, "MOVING", 1, "woodland-return") {
			t.Fatalf("normal escape rejected: %s", trunk.SiteID)
		}
		if player.X != x || player.Z != trunk.Z || player.LastMoveSequence != 1 {
			t.Fatalf("escape position/acknowledgement changed: %s", trunk.SiteID)
		}
		count++
	}
	if count != 391 {
		t.Fatalf("expected all woodland trunks, got %d", count)
	}
}
