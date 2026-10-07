package game

import (
	"fmt"
	"math"
	"sync"
	"testing"
	"time"
)

func TestSpatialSameCellUpdateDoesNotWaitForMembershipLock(t *testing.T) {
	for _, kind := range []EntityType{TypePlayer, TypeEnemy} {
		for _, x := range []float64{-49, .01, 50.01} {
			t.Run(fmt.Sprintf("%s/%g", kind, x), func(t *testing.T) {
				grid := NewSpatialMap(50)
				actor := &Entity{ID: "same-cell-live", Type: kind, InstanceID: "raid:spatial", X: x, Z: -49}
				grid.Add(actor)
				actor.Mu.Lock()
				defer actor.Mu.Unlock()
				oldX, oldZ := actor.X, actor.Z
				actor.X, actor.Z = x+.25, -48
				grid.Mu.Lock()
				var release sync.Once
				done := make(chan struct{})
				go func() { grid.Update(actor, oldX, oldZ); close(done) }()
				defer func() {
					release.Do(grid.Mu.Unlock)
					select {
					case <-done:
					case <-time.After(2 * time.Second):
						t.Error("owned spatial update did not join")
					}
				}()
				select {
				case <-done:
				case <-time.After(2 * time.Second):
					t.Fatal("same-cell move waited for an unrelated membership lock")
				}
				release.Do(grid.Mu.Unlock)
				got := grid.Nearby(actor.X, actor.Z, 0, actor.InstanceID)
				if len(got) != 1 || got[0] != actor {
					t.Fatal("same-cell move changed general membership or actor identity")
				}
				players := grid.nearbyType(actor.X, actor.Z, 0, actor.InstanceID, TypePlayer)
				if kind == TypePlayer && (len(players) != 1 || players[0] != actor) || kind != TypePlayer && len(players) != 0 {
					t.Fatal("same-cell move changed player-only membership")
				}
			})
		}
	}
}

func TestSpatialCellsNearbyMatchesOriginalSceneAndCellBounds(t *testing.T) {
	grid := NewSpatialMap(50)
	var actors []*Entity
	for sceneIndex, scene := range []string{"", "dungeon:negative", "casino", "陰影:floor"} {
		for positionIndex, x := range []float64{-100, -50.01, -50, -.01, 0, 49.99, 50, 200.01} {
			actor := &Entity{ID: fmt.Sprintf("spatial-%d-%d", sceneIndex, positionIndex), InstanceID: scene, X: x, Z: -x}
			actors = append(actors, actor)
			grid.Add(actor)
		}
	}
	for _, scene := range []string{"", "dungeon:negative", "casino", "陰影:floor", "missing"} {
		for _, query := range [][3]float64{{-.01, 0, 0}, {0, 0, .01}, {0, 0, 50}, {50, -50, 200}, {-200, 200, 199.9}} {
			want := make(map[string]*Entity)
			for _, actor := range actors {
				cx, cz := math.Floor(actor.X/50), math.Floor(actor.Z/50)
				if actor.InstanceID == scene && cx >= math.Floor((query[0]-query[2])/50) && cx <= math.Floor((query[0]+query[2])/50) &&
					cz >= math.Floor((query[1]-query[2])/50) && cz <= math.Floor((query[1]+query[2])/50) {
					want[actor.ID] = actor
				}
			}
			got := grid.Nearby(query[0], query[1], query[2], scene)
			if len(got) != len(want) {
				t.Fatal("spatial candidate cell bounds changed", scene, query, len(got), len(want))
			}
			for _, actor := range got {
				if want[actor.ID] != actor {
					t.Fatal("foreign, duplicated or substituted spatial candidate")
				}
				delete(want, actor.ID)
			}
		}
	}
}

func TestSpatialCellsMoveRemoveAndExplicitSceneTransfer(t *testing.T) {
	grid := NewSpatialMap(50)
	actor := &Entity{ID: "spatial-moving", X: -.01, Z: -50}
	grid.Add(actor)
	actor.X, actor.Z = -49, -50.01
	grid.Update(actor, -.01, -50)
	if len(grid.Nearby(-.01, -50, 0, "")) != 0 || len(grid.Nearby(-49, -50.01, 0, "")) != 1 {
		t.Fatal("negative boundary move left old membership")
	}
	actor.X = -48 // Same-cell move retains exactly one live reference.
	grid.Update(actor, -49, -50.01)
	grid.Remove(actor)
	actor.InstanceID = "dungeon:transfer"
	grid.Add(actor)
	if len(grid.Nearby(-48, -50.01, 0, "")) != 0 || len(grid.Nearby(-48, -50.01, 0, actor.InstanceID)) != 1 {
		t.Fatal("explicit scene transfer crossed scene isolation")
	}
	grid.Remove(actor)
	if len(grid.cells) != 0 {
		t.Fatal("empty spatial cells retained after removal")
	}
}

func TestSpatialCellsEmptyNearbyAllocatesOnlyResultNotCellKeys(t *testing.T) {
	grid := NewSpatialMap(50)
	var result []*Entity
	allocations := testing.AllocsPerRun(20, func() { result = grid.Nearby(-25, 25, 200, "casino:large") })
	if len(result) != 0 || allocations > 1 {
		t.Fatal("empty spatial query allocates keys per candidate cell", allocations)
	}
}

func TestSpatialCellsConcurrentMovesNeverDuplicateOrSubstituteActor(t *testing.T) {
	grid := NewSpatialMap(50)
	actor := &Entity{ID: "spatial-concurrent", InstanceID: "dungeon:concurrent"}
	grid.Add(actor)
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		for index := 0; index < 200; index++ {
			actor.Mu.Lock()
			oldX, oldZ := actor.X, actor.Z
			actor.X, actor.Z = float64(index%8)*50-200, float64(index%3)*50-100
			grid.Update(actor, oldX, oldZ)
			actor.Mu.Unlock()
		}
	}()
	for index := 0; index < 200; index++ {
		got := grid.Nearby(0, 0, 200, "dungeon:concurrent")
		if len(got) > 1 || len(got) == 1 && got[0] != actor {
			t.Error("move changed candidate identity or duplicated a live actor")
		}
	}
	workers.Wait()
	grid.Remove(actor)
	if len(grid.Nearby(0, 0, 200, "dungeon:concurrent")) != 0 {
		t.Fatal("removed actor remained a candidate")
	}
}
