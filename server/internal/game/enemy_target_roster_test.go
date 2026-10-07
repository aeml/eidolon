package game

import (
	"math"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestEnemyTargetRosterPreservesCellsOrderThreatAndFrameMembership(t *testing.T) {
	grid := NewSpatialMap(50)
	near := &Entity{ID: "roster-near", Type: TypePlayer, X: 2, Z: 600}
	boundary := &Entity{ID: "roster-boundary", Type: TypePlayer, X: 25, Z: 600}
	coarse := &Entity{ID: "roster-coarse", Type: TypePlayer, X: 49, Z: 600}
	far := &Entity{ID: "roster-far", Type: TypePlayer, X: 800, Z: 600}
	tiny := &Entity{ID: "roster-tiny", Type: TypePlayer, X: -800, Z: 600}
	foreign := &Entity{ID: "roster-foreign", Type: TypePlayer, X: 2, Z: 600, InstanceID: CasinoInstanceID}
	newcomer := &Entity{ID: "roster-newcomer", Type: TypePlayer, X: 1, Z: 600}
	npc := &Entity{ID: "roster-npc", Type: TypeEnemy, X: 1, Z: 600}
	players := []*Entity{far, boundary, tiny, near, foreign, coarse}
	for _, actor := range append(append([]*Entity{}, players...), newcomer, npc) {
		grid.Add(actor)
	}
	roster := newEnemyTargetRoster(players)
	got := roster.candidatesLocked(grid, 0, 600, 25, "", map[string]float64{far.ID: 100, tiny.ID: .000001, newcomer.ID: 1000})
	if !reflect.DeepEqual(got, []*Entity{far, boundary, tiny, near, coarse}) {
		t.Fatal("lost distant/tiny threat, frame order or broadphase membership", got)
	}
	// Coarse cell overinclusion never extends the live acquisition range.
	w := &World{Entities: map[string]*Entity{coarse.ID: coarse}}
	w.Mu.RLock()
	valid := w.snapshotEnemyTargetForScanLocked(coarse, "", 0, 600, 25, nil)
	w.Mu.RUnlock()
	if valid.active {
		t.Fatal("coarse cell granted an out-of-range target")
	}
	// A replacement with the same ID is not a member of this frame's roster.
	grid.Remove(near)
	replacement := &Entity{ID: near.ID, Type: TypePlayer, X: 2, Z: 600}
	grid.Add(replacement)
	got = roster.candidatesLocked(grid, 0, 600, 25, "", nil)
	if !reflect.DeepEqual(got, []*Entity{boundary, coarse}) {
		t.Fatal("same-ID replacement acquired before its own frame")
	}
	if got := newEnemyTargetRoster(nil).candidatesLocked(grid, 0, 600, 25, "", nil); len(got) != 0 {
		t.Fatal("empty frame acquired players")
	}
}

func TestEnemyTargetRosterReadsFreshMovesAndTransfersWithoutCachingEligibility(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	p := &Entity{ID: "roster-moving", Type: TypePlayer, X: 500, Z: 600, State: "IDLE"}
	w.Entities[p.ID] = p
	w.Grid.Add(p)
	roster := newEnemyTargetRoster([]*Entity{p})
	check := func(scene string, want bool) {
		t.Helper()
		w.Mu.RLock()
		defer w.Mu.RUnlock()
		active := false
		for _, candidate := range roster.candidatesLocked(w.Grid, 0, 600, 25, scene, nil) {
			snapshot := w.snapshotEnemyTargetForScanLocked(candidate, scene, 0, 600, 25, nil)
			active = active || snapshot.active && !snapshot.hidden
		}
		if active != want {
			t.Fatal("cached position/scene/life/stealth instead of live authority", active, want)
		}
	}
	check("", false)
	p.Mu.Lock()
	oldX, oldZ := p.X, p.Z
	p.X = -25 // Exact negative boundary remains visible.
	w.Grid.Update(p, oldX, oldZ)
	p.Mu.Unlock()
	check("", true)
	p.Mu.Lock()
	p.StealthActive, p.StealthEndTime = true, time.Now().Add(time.Minute)
	p.Mu.Unlock()
	check("", false)
	p.Mu.Lock()
	p.StealthEndTime = time.Now().Add(-time.Minute)
	p.Mu.Unlock()
	check("", true)
	for _, state := range []string{"DEAD", "IDLE"} {
		p.Mu.Lock()
		p.State = state
		p.Mu.Unlock()
		check("", state == "IDLE")
	}
	w.Mu.Lock()
	p.Mu.Lock()
	w.Grid.Remove(p)
	p.InstanceID = "raid-live-transfer"
	w.Grid.Add(p)
	p.Mu.Unlock()
	w.Mu.Unlock()
	check("", false)
	check("raid-live-transfer", true)
	p.Mu.Lock()
	p.Disconnected = true
	p.Mu.Unlock()
	check("raid-live-transfer", false)
}

func TestEnemyTargetRosterConcurrentMoveAndSceneTransferRetainsLiveIsolation(t *testing.T) {
	w := &World{Entities: map[string]*Entity{}, Grid: NewSpatialMap(50)}
	p := &Entity{ID: "roster-concurrent", Type: TypePlayer, X: 1, Z: 600, State: "IDLE"}
	w.Entities[p.ID] = p
	w.Grid.Add(p)
	roster := newEnemyTargetRoster([]*Entity{p})
	var worker sync.WaitGroup
	worker.Add(1)
	go func() {
		defer worker.Done()
		for index := range 100 {
			if index%3 != 0 {
				// Ordinary movement does not own World.Mu; it publishes the cell
				// move while still owning the same player lock as its coordinates.
				p.Mu.Lock()
				oldX, oldZ := p.X, p.Z
				p.X = float64(index%4)*100 - 100
				w.Grid.Update(p, oldX, oldZ)
				p.Mu.Unlock()
				continue
			}
			w.Mu.Lock()
			p.Mu.Lock()
			w.Grid.Remove(p)
			p.InstanceID = []string{"", "raid-roster"}[index%2]
			p.X = float64(index%4)*100 - 100
			w.Grid.Add(p)
			p.Mu.Unlock()
			w.Mu.Unlock()
		}
	}()
	defer worker.Wait()
	for range 100 {
		w.Mu.RLock()
		for _, scene := range []string{"", "raid-roster"} {
			for _, candidate := range roster.candidatesLocked(w.Grid, 0, 600, 25, scene, nil) {
				snapshot := w.snapshotEnemyTargetForScanLocked(candidate, scene, 0, 600, 25, nil)
				if snapshot.active && (snapshot.instanceID != scene || math.Hypot(snapshot.x, snapshot.z-600) > 25) {
					t.Error("spatial candidate bypassed live scene/range")
				}
			}
		}
		w.Mu.RUnlock()
	}
}

func TestEnemyTargetRosterSkipsIrrelevantActorLocksAtActualAIConsumer(t *testing.T) {
	for _, indexed := range []bool{false, true} {
		t.Run(map[bool]string{false: "reference-scan", true: "spatial-scan"}[indexed], func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("roster-locked-foreign", "Fighter")
			p.InstanceID, p.X, p.Z = CasinoInstanceID, 1, 600
			enemy := &Entity{ID: "roster-actual-consumer", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
				X: 0, Z: 600, SpawnX: 0, SpawnZ: 600, Health: 100, MaxHealth: 100, AttackCooldown: time.Second}
			w.AddEntity(p)
			w.AddEntity(enemy)
			deferred := &deferredActions{}
			if indexed {
				deferred.enemyTargets = newEnemyTargetRoster([]*Entity{p})
			}
			p.Mu.Lock()
			done := make(chan struct{})
			go func() { w.updateEntity(enemy, .033, []*Entity{p}, deferred); close(done) }()
			var completed bool
			select {
			case <-done:
				completed = true
			case <-time.After(250 * time.Millisecond):
			}
			p.Mu.Unlock()
			select {
			case <-done:
			case <-time.After(2 * time.Second):
				t.Fatal("owned AI consumer failed to join")
			}
			if completed != indexed {
				t.Fatal("indexed AI still locks irrelevant scenes, or reference fixture failed to hold the actor")
			}
		})
	}
}

func TestSpatialPlayerQueryEmptyAllocatesNoResultOrPerCellKeys(t *testing.T) {
	grid := NewSpatialMap(50)
	var got []*Entity
	if allocations := testing.AllocsPerRun(20, func() { got = grid.nearbyType(-25, 25, 200, "", TypePlayer) }); len(got) != 0 || allocations != 0 {
		t.Fatal("empty AI candidate query allocated", allocations)
	}
}

func TestSpatialPlayerIndexMirrorsGeneralCellsAcrossMoveRemoveAndSceneTransfer(t *testing.T) {
	grid := NewSpatialMap(50)
	p := &Entity{ID: "indexed-player", Type: TypePlayer, X: -50.01, Z: -1}
	npc := &Entity{ID: "indexed-npc", Type: TypeEnemy, X: -50.01, Z: -1}
	grid.Add(p)
	grid.Add(npc)
	check := func() {
		t.Helper()
		grid.Mu.RLock()
		defer grid.Mu.RUnlock()
		count := 0
		for key, cell := range grid.playerCells {
			for id, actor := range cell {
				count++
				if actor != p || grid.cells[key][id] != actor {
					t.Fatal("player index differs from authoritative cell membership")
				}
			}
		}
		if count != 1 {
			t.Fatal("player missing or duplicated across cells", count)
		}
	}
	check()
	for _, x := range []float64{-49.99, -.01, 0, 49.99, 50, 200} {
		oldX, oldZ := p.X, p.Z
		p.X = x
		grid.Update(p, oldX, oldZ)
		check()
	}
	grid.Remove(p)
	p.InstanceID = "indexed-scene"
	grid.Add(p)
	check()
	if len(grid.nearbyType(p.X, p.Z, 200, "", TypePlayer)) != 0 || len(grid.nearbyType(p.X, p.Z, 200, p.InstanceID, TypePlayer)) != 1 {
		t.Fatal("player-only index leaked the old scene or omitted the new scene")
	}
	grid.Remove(p)
	if len(grid.playerCells) != 0 || len(grid.Nearby(npc.X, npc.Z, 0, "")) != 1 {
		t.Fatal("empty player cells retained, or general NPC spatial membership lost")
	}
	grid.Remove(npc)
	if len(grid.cells) != 0 {
		t.Fatal("general empty cells retained")
	}
}
