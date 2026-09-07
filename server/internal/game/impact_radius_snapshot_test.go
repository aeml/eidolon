package game

import (
	"math"
	"testing"
)

func TestMeteorImpactRadiusSurvivesBothSnapshotPaths(t *testing.T) {
	w := newTestWorld()
	e := &Entity{ID: "meteor-footprint", Type: TypeProjectile, SubType: "Meteor", Radius: 17.6, Scale: 1}
	w.AddEntity(e)
	for _, snapshot := range []*Entity{w.GetEntityCopy(e.ID), w.copyEntity(e)} {
		if math.Abs(snapshot.ImpactRadius-29.04) > 1e-8 || math.Abs(snapshot.ReplicatedImpactRadius()-29.04) > 1e-8 {
			t.Fatal("copy lost impact footprint")
		}
	}
}
