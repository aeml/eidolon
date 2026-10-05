package game

import (
	"math"
	"testing"
)

func TestStashFacesEastBetweenSmithyAndForge(t *testing.T) {
	w := NewWorld(nil)
	defer w.StopBackground()
	stash, forge, quest := w.GetEntityCopy("stash-1"), w.GetEntityCopy("forge-1"), w.GetEntityCopy("quest-npc-1")
	if stash == nil || forge == nil || quest == nil || stash.X != forge.X || stash.Z <= quest.Z || stash.Z >= forge.Z ||
		stash.Rotation != math.Pi/2 || stash.Rotation != forge.Rotation || stash.Rotation != quest.Rotation {
		t.Fatal("stash is not between the western services facing their east-side lane")
	}
}

func TestQuestGiverSpawnsOutsideSmithyDoor(t *testing.T) {
	w := NewWorld(nil)
	npc := w.GetEntityCopy("quest-npc-1")
	if npc == nil {
		t.Fatal("quest giver was not spawned")
	}
	if npc.X != -20 || npc.Z != 200 {
		t.Fatalf("quest giver position = (%v, %v), want (-20, 200)", npc.X, npc.Z)
	}
	// The rotated smithy's eastern wall ends near x=-22.5. This keeps the
	// actor fully outside its doorway instead of intersecting the door mesh.
	if npc.X <= -22.5 {
		t.Fatalf("quest giver x=%v is not outside the smithy", npc.X)
	}
}
