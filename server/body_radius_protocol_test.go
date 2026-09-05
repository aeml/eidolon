package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestBodyRadiusProtocolAndDeltaDetection(t *testing.T) {
	entity := &game.Entity{ID: "boss", Type: game.TypeEnemy, Scale: 4}
	if got := entityToProto(entity).GetBodyRadius(); got != 5 {
		t.Fatalf("body radius=%f want 5", got)
	}
	snapshot := entityToSnapshot(entity)
	if hasEntityChanged(entity, snapshot) {
		t.Fatal("unchanged entity should not produce a delta")
	}
	entity.Radius = 2.75
	if !hasEntityChanged(entity, snapshot) || entityToProto(entity).GetBodyRadius() != 2.75 {
		t.Fatal("explicit collision change not replicated")
	}
	snapshot = entityToSnapshot(entity)
	entity.Scale = 5
	if !hasEntityChanged(entity, snapshot) {
		t.Fatal("visual scale change with stable body radius not replicated")
	}
}
