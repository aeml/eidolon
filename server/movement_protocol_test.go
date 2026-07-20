package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestEntityToProtoCarriesMovementAcknowledgement(t *testing.T) {
	entity := &game.Entity{
		ID:               "player-movement-protocol",
		Type:             game.TypePlayer,
		State:            "MOVING",
		X:                4,
		Z:                8,
		LastMoveSequence: 928,
	}

	encoded := entityToProto(entity)
	if encoded == nil {
		t.Fatal("expected encoded player")
	}
	if encoded.MoveSequence != 928 {
		t.Fatalf("expected movement acknowledgement 928, got %d", encoded.MoveSequence)
	}
}
