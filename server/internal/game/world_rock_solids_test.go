package game

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

func TestRockClientServerParity(t *testing.T) {
	solids := rockSolidsForTest(t)
	bytes, err := os.ReadFile("testdata/earth-outcrop-movement.json")
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Cases []struct {
			Name                 string
			Start, End, Position [2]float64
			Stopped              [2]float64
			Radius               float64
			Hit                  struct {
				At      float64
				Normal  [2]float64
				Blocked bool
			}
		}
	}
	if err := json.Unmarshal(bytes, &data); err != nil {
		t.Fatal(err)
	}
	if len(data.Cases) < 100 {
		t.Fatal("missing parity vectors")
	}
	for _, c := range data.Cases {
		t.Run(c.Name, func(t *testing.T) {
			start, end := rockPoint{c.Start[0], c.Start[1]}, rockPoint{c.End[0], c.End[1]}
			got := moveAroundRockSolids(solids, start, end, c.Radius)
			stopped := stopAtRockSolids(solids, start, end, c.Radius)
			if math.Hypot(stopped.X-c.Stopped[0], stopped.Z-c.Stopped[1]) > 1e-7 {
				t.Fatalf("client/server jump/dash endpoint diverged: got %+v want %+v", stopped, c.Stopped)
			}
			if math.Hypot(got.X-c.Position[0], got.Z-c.Position[1]) > 1e-7 {
				t.Fatalf("client/server movement diverged: got %+v want %+v", got, c.Position)
			}
			at, normal, hit := firstRockHit(solids, start, end, c.Radius)
			if hit != c.Hit.Blocked || math.Abs(at-c.Hit.At) > 1e-7 || math.Hypot(normal.X-c.Hit.Normal[0], normal.Z-c.Hit.Normal[1]) > 1e-7 {
				t.Fatalf("client/server hit query diverged: %v %+v %v vs %+v", at, normal, hit, c.Hit)
			}
		})
	}
}

func rockSolidsForTest(t *testing.T) []worldRockSolid {
	t.Helper()
	solids, err := readEarthOutcropSolids()
	if err != nil {
		t.Fatal(err)
	}
	if len(solids) != 18 {
		t.Fatalf("expected eighteen shared rock bodies, got %d", len(solids))
	}
	return solids
}

func TestRockRecoveryLeavesWholeFormationWithoutChangingDistantGround(t *testing.T) {
	solids := rockSolidsForTest(t)
	var data struct {
		Solids []struct {
			X, Z    float64
			Outline [][2]float64
		}
	}
	if err := json.Unmarshal(earthOutcropJSON, &data); err != nil {
		t.Fatal(err)
	}
	for _, solid := range data.Solids {
		points := append([][2]float64{{solid.X, solid.Z}}, solid.Outline...)
		for _, point := range points {
			start := rockPoint{point[0], point[1]}
			end := recoverRockPosition(solids, start, 1.25)
			if insideRockSolids(solids, end, 1.25) {
				t.Fatalf("recovery remained in overlapping rock at %+v", end)
			}
			if math.Hypot(end.X-start.X, end.Z-start.Z) > 25 {
				t.Fatal("recovery moved outside local formation")
			}
			if again := recoverRockPosition(solids, end, 1.25); again != end {
				t.Fatal("recovery is not stable")
			}
		}
	}
	for _, p := range []rockPoint{{0, 200}, {0, -260}, {800, 250}} {
		if recoverRockPosition(solids, p, 1.25) != p {
			t.Fatal("changed clear town/route/entrance position")
		}
	}
}

func TestRockSweepStopsTunnellingAndSlidesWithoutEnteringTheUnion(t *testing.T) {
	solids := rockSolidsForTest(t)
	start, target := rockPoint{-102, -345}, rockPoint{-102, -290}
	at, _, hit := firstRockHit(solids, start, target, 1.25)
	if !hit || at <= 0 || at >= 1 {
		t.Fatal("clear endpoint tunnel was not blocked")
	}
	if insideAt, _, insideHit := firstRockHit(solids, rockPoint{-102, -321}, target, 0); !insideHit || insideAt != 0 {
		t.Fatal("an origin inside solid geometry escaped the hit query")
	}
	end := moveAroundRockSolids(solids, start, target, 1.25)
	if end.Z >= -326 || end.X != start.X || insideRockSolids(solids, end, 1.25) {
		t.Fatalf("walk passed through shelf: %+v", end)
	}
	// Each direction exercises repeated walking against joined shoulders,
	// corners and glancing contacts, not only the main body's four AABB faces.
	for direction := 0; direction < 64; direction++ {
		angle := float64(direction) * math.Pi / 32
		p := rockPoint{-102 + math.Cos(angle)*22, -321 + math.Sin(angle)*22}
		for step := 0; step < 60; step++ {
			request := rockPoint{p.X - math.Cos(angle)*.75, p.Z - math.Sin(angle)*.75}
			next := moveAroundRockSolids(solids, p, request, 1.25)
			if insideRockSolids(solids, next, 1.249) {
				t.Fatalf("direction %d step %d entered union: %+v", direction, step, next)
			}
			if math.Hypot(next.X-p.X, next.Z-p.Z) > .751 {
				t.Fatal("ordinary contact injected a teleport")
			}
			p = next
		}
	}
	wallStart := rockPoint{-102, -327}
	if insideRockSolids(solids, wallStart, 1.25) {
		t.Fatal("glancing fixture starts inside a shoulder")
	}
	wallEnd := moveAroundRockSolids(solids, wallStart, rockPoint{-97, -323}, 1.25)
	if wallEnd.X <= wallStart.X+.5 || insideRockSolids(solids, wallEnd, 1.25) {
		t.Fatal("glancing walk could not slide along wall")
	}
}

func TestRockMovementKeepsSequencingSceneOwnershipAndGrounding(t *testing.T) {
	w, err := NewWorldWithElevationCandidate(nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	if len(w.rockSolids) != 18 || w.TerrainProfile() != "earth-elevation-rocks-v1" {
		t.Fatal("opt-in terrain startup did not install negotiated rock integration")
	}
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-movement", "Fighter")
	p.X, p.Z, p.MovementContext, p.RecoveryContextReady = -102, -345, "rock-test", true
	w.AddEntity(p)
	if !w.UpdatePlayerMovementWithContext(p.ID, -102, 999, -290, .5, "MOVING", 9, "rock-test") {
		t.Fatal("movement rejected instead of acknowledged/clipped")
	}
	if p.Z >= -326 || p.X != -102 || p.LastMoveSequence != 9 {
		t.Fatal("collision or acknowledgement lost")
	}
	assertActorOnElevation(t, w, p)
	before := rockPoint{p.X, p.Z}
	if w.UpdatePlayerMovementWithContext(p.ID, -80, 0, -321, 0, "MOVING", 8, "rock-test") ||
		w.UpdatePlayerMovementWithContext(p.ID, -80, 0, -321, 0, "MOVING", 10, "old-scene") {
		t.Fatal("stale movement accepted")
	}
	if (rockPoint{p.X, p.Z}) != before {
		t.Fatal("rejected packet moved actor")
	}
	if w.UpdatePlayerMovement(p.ID, math.NaN(), 0, 0, 0, "MOVING", 10) {
		t.Fatal("nonfinite candidate move accepted")
	}
	p.InstanceID = "dungeon_rock-scene"
	if !w.UpdatePlayerMovement(p.ID, -80, 8, -321, 0, "MOVING", 10) || p.X != -80 || p.Y != 8 {
		t.Fatal("overworld rock interfered with instance-owned coordinates")
	}
	p.InstanceID = ""
	w.rockSolids = nil
	if !w.UpdatePlayerMovement(p.ID, -125, 0, -321, 0, "MOVING", 11) || p.X != -125 {
		t.Fatal("inactive rocks altered legacy movement")
	}
}

func TestRockAdmissionRecoversSavedPositionBeforeGridPublication(t *testing.T) {
	w, err := NewWorldWithElevationCandidate(nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.StopBackground)
	w.rockSolids = rockSolidsForTest(t)
	p := newTestPlayer("rock-saved", "Rogue")
	p.X, p.Y, p.Z = -102, 0, -321
	// Small cells force the correction across a grid boundary in this fixture.
	w.Grid = NewSpatialMap(.25)
	w.AddEntity(p)
	if insideRockSolids(w.rockSolids, rockPoint{p.X, p.Z}, 1.25) {
		t.Fatal("saved character admitted inside rock")
	}
	assertActorOnElevation(t, w, p)
	if w.Grid.cells[w.Grid.key(p.X, p.Z, p.InstanceID)][p.ID] != p {
		t.Fatal("corrected position was not published into the spatial grid")
	}
	if w.Grid.cells[w.Grid.key(-102, -321, "")][p.ID] != nil {
		t.Fatal("saved inside-rock position leaked into the spatial grid")
	}
	if math.Hypot(p.X+102, p.Z+321) > 25 {
		t.Fatal("saved character unnecessarily sent away")
	}
	// Rejoining an unchanged safe point must not repeat the correction.
	before := rockPoint{p.X, p.Z}
	w.AddEntity(p)
	if (rockPoint{p.X, p.Z}) != before {
		t.Fatal("rejoin repeatedly moved saved character")
	}
}
