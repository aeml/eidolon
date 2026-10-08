package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestPvPSaveSnapshotPreservesEntryResourcesAndPositionWithoutLiveLookup(t *testing.T) {
	t.Run("admitted-flat-floor", func(t *testing.T) { testPvPDetachedSaveProjection(t, 0) })
	t.Run("owned-jump-height", func(t *testing.T) { testPvPDetachedSaveProjection(t, 2) })
}

func testPvPDetachedSaveProjection(t *testing.T, entryHeight float64) {
	t.Helper()
	w := game.NewWorld(nil)
	defer w.StopBackground()
	a := &game.Entity{ID: "save-a", Type: game.TypePlayer, MaxHealth: 100, Health: 17, MaxMana: 80, Mana: 3, X: 12, Y: 2, Z: 200, WellRestedSeconds: 41}
	b := &game.Entity{ID: "save-b", Type: game.TypePlayer, MaxHealth: 100, Health: 100, X: 14, Z: 200}
	w.AddEntity(a)
	w.AddEntity(b)
	if a.Y != 0 {
		t.Fatal("flat-world admission retained a stale saved height")
	}
	if entryHeight != 0 {
		// Admission grounds old saves; a subsequent active jump owns its height.
		// Keep nonzero projection coverage instead of changing every expected Y to0.
		a.Y, a.State = entryHeight, "JUMPING"
	}
	challenge, err := w.RequestDuel(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.RespondDuel(b.ID, a.ID, challenge.ID, true); err != nil {
		t.Fatal(err)
	}
	a.Health, a.Mana, a.State = 0, 0, "DEAD"
	snapshot := w.GetEntityCopy(a.ID)
	if snapshot.PvPReturn == nil {
		t.Fatal("detached snapshot lost pre-match projection")
	}
	// A save may finish after the live match ends. Its projection must remain
	// self-contained instead of consulting a match map that no longer exists.
	w.ForfeitPvP(a.ID)
	char := characterSnapshot("save-a", snapshot, time.Now())
	bytes, err := json.Marshal(char)
	if err != nil {
		t.Fatal(err)
	}
	var restored database.Character
	if err := json.Unmarshal(bytes, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.InstanceID != "" || restored.X != 12 || restored.Y != entryHeight || restored.Z != 200 || restored.Resources.Health != 17 || restored.Resources.Mana != 3 || restored.Resources.Dead {
		t.Fatal("save persisted arena death/refill or temporary instance", restored.Resources)
	}
	if restored.WellRested.RemainingSeconds != 41 {
		t.Fatal("save changed actual rest bank")
	}
	if a.PvPReturn != nil || a.Health != 17 {
		t.Fatal("save projection mutated live player")
	}
}
