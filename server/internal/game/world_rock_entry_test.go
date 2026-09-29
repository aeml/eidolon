package game

import (
	"testing"
	"time"
)

func TestRockCandidateStartupRecoversPopulationAndRetainsDefaultWorld(t *testing.T) {
	legacy := newRockWorldForTest(t)
	if len(legacy.rockSolids) != 0 || legacy.TerrainProfile() != "flat-v1" {
		t.Fatal("normal world activated candidate")
	}
	w, err := NewWorldWithElevationCandidate(nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if len(w.rockSolids) != 18 || w.TerrainProfile() != "earth-elevation-rocks-v1" {
		t.Fatal("candidate failed to negotiate matching solids")
	}
	for _, e := range w.Entities {
		if e.Type != TypeEnemy {
			continue
		}
		if insideRockSolids(w.rockSolids, rockPoint{e.X, e.Z}, e.ReplicatedBodyRadius()) {
			t.Fatalf("initial population in rock: %s", e.ID)
		}
		assertActorOnElevation(t, w, e)
		if w.Grid.cells[w.Grid.key(e.X, e.Z, e.InstanceID)][e.ID] != e {
			t.Fatal("incorrect initial grid cell")
		}
	}
}

func TestRockReconnectAndLootRecoverBeforePublication(t *testing.T) {
	w := newRockWorldForTest(t)
	w.rockSolids = rockSolidsForTest(t)
	w.Grid = NewSpatialMap(.25)
	p := newTestPlayer("rock-resume", "Fighter")
	p.X, p.Z = -102, -340
	w.AddEntity(p)
	if !w.SetEntityDisconnected(p.ID, time.Now()) {
		t.Fatal("disconnect failed")
	}
	// Simulate a retained actor from an old geometry revision, not a new login.
	w.Grid.Remove(p)
	p.X, p.Z = -102, -321
	w.Grid.Add(p)
	if _, ok := w.ClearEntityDisconnected(p.ID); !ok {
		t.Fatal("resume failed")
	}
	if insideRockSolids(w.rockSolids, rockPoint{p.X, p.Z}, p.ReplicatedBodyRadius()) ||
		w.Grid.cells[w.Grid.key(p.X, p.Z, "")][p.ID] != p || w.Grid.cells[w.Grid.key(-102, -321, "")][p.ID] != nil {
		t.Fatal("resume published stale rock position")
	}
	loot := &Entity{ID: "rock-loot", Type: TypeLoot, X: -102, Z: -321, Y: .5}
	w.AddEntity(loot)
	if insideRockSolids(w.rockSolids, rockPoint{loot.X, loot.Z}, .5) || w.Grid.cells[w.Grid.key(loot.X, loot.Z, "")][loot.ID] != loot {
		t.Fatal("loot inaccessible or stale grid")
	}
	if w.adminLandingClearLocked(AdminTeleportPlan{X: -102, Z: -321}, p.ID) {
		t.Fatal("admin landing allowed inside formation")
	}
	if err := w.PerformRecall(p.ID, "rock-recall"); err != nil {
		t.Fatal(err)
	}
	if p.X != -1.25 || p.Z != 200 || p.MovementContext != "rock-recall" {
		t.Fatal("recall town/context changed")
	}
}
