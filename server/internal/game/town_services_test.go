package game

import "testing"

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
