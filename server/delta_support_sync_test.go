package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestEntitySnapshotTracksSpiritGuardiansForDeltaSync(t *testing.T) {
	entity := &game.Entity{
		ID:           "cleric-1",
		Type:         game.TypePlayer,
		SubType:      "Cleric",
		State:        "IDLE",
		TalentRanks:  map[string]int{},
		SpiritsActive: true,
	}

	snapshot := entityToSnapshot(entity)
	if snapshot == nil {
		t.Fatal("expected snapshot")
	}
	if !snapshot.SpiritsActive {
		t.Fatal("expected snapshot to track spiritsActive")
	}

	entity.SpiritsActive = false
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("expected spirit guardians delta change to be detected")
	}

	entity.SpiritsActive = true
	snapshot = entityToSnapshot(entity)
	entity.SpiritsActive = true
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("expected unchanged spirit guardians state to stay delta-stable")
	}
}
