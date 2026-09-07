package main

import (
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
	"testing"
	"time"
)

func TestGuardianAreaProtocolSnapshotAndDelta(t *testing.T) {
	e := &game.Entity{ID: "guardian-snapshot", Type: game.TypePlayer, SubType: "Cleric", GuardianEmbraceActive: true, GuardianEmbraceRadius: 11.5, GuardianEmbraceEndTime: time.Now().Add(time.Minute)}
	data, err := proto.Marshal(entityToProto(e))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.GuardianEmbraceRadius != 11.5 || !decoded.GuardianEmbraceActive || decoded.GuardianEmbraceDuration <= 0 {
		t.Fatal("active aura missing from encoded snapshot")
	}
	snapshot := entityToSnapshot(e)
	if hasEntityChanged(e, snapshot) {
		t.Fatal("unchanged aura emitted delta")
	}
	e.GuardianEmbraceRadius = 10
	if !hasEntityChanged(e, snapshot) || entityToProto(e).GuardianEmbraceRadius != 10 {
		t.Fatal("radius-only delta missing")
	}
	e.GuardianEmbraceActive = false
	if entityToSnapshot(e).GuardianEmbraceRadius != 0 || entityToProto(e).GuardianEmbraceRadius != 0 {
		t.Fatal("inactive aura retained footprint")
	}
}
