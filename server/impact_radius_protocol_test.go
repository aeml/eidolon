package main

import (
	"eidolon-server/internal/game"
	"math"
	"testing"
)

func TestMeteorImpactRadiusProtocolAndDelta(t *testing.T) {
	e := &game.Entity{ID: "meteor-snapshot", Type: game.TypeProjectile, SubType: "Meteor", Radius: 17.6, Scale: 1}
	if math.Abs(float64(entityToProto(e).GetImpactRadius())-29.04) > 1e-5 {
		t.Fatal("cast-time footprint missing from protobuf")
	}
	snapshot := entityToSnapshot(e)
	if hasEntityChanged(e, snapshot) {
		t.Fatal("unchanged radius emitted a delta")
	}
	e.Radius = 30
	if !hasEntityChanged(e, snapshot) || entityToProto(e).GetImpactRadius() != 49.5 {
		t.Fatal("changed footprint missing from delta")
	}
}
