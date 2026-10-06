package main

import (
	"math"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func loadDungeonLayout() game.DungeonLayout {
	return game.DungeonLayout{
		Rooms:     []game.DungeonRoom{{X: 0, Width: 40, Height: 40, Type: "start"}, {X: 100, Width: 40, Height: 40, Type: "boss"}, {X: 200, Width: 40, Height: 40, Type: "boss"}},
		WalkRects: []game.DungeonWalkRect{{Width: 40, Height: 40, Kind: "room", RoomIndex: 0}, {X: 100, Width: 40, Height: 40, Kind: "room", RoomIndex: 1}, {X: 200, Width: 40, Height: 40, Kind: "room", RoomIndex: 2}, {X: 50, Width: 70, Height: 20, Kind: "corridor"}, {X: 150, Width: 70, Height: 20, Kind: "corridor"}},
		Corridors: []game.DungeonCorridor{{FromRoomIndex: 0, ToRoomIndex: 1, Width: 20, WalkRectIndices: []int{3}}, {FromRoomIndex: 1, ToRoomIndex: 2, Width: 20, WalkRectIndices: []int{4}}},
	}
}

func loadDungeonSummary(layout game.DungeonLayout, clearThrough int) game.DungeonRoomSummary {
	state := game.NewDungeonRoomState(layout)
	for i := 0; i <= clearThrough; i++ {
		state.MarkRoomCleared(i)
	}
	summary := state.Summary(0, 0)
	summary.Difficulty, summary.RunLevel = "normal", 30
	return summary
}

func dungeonFixture(t *testing.T, enter bool) *partyLoad {
	t.Helper()
	p, _ := partyFixture()
	p.dungeon = &dungeonLoad{kind: "verdant_bastion_catacombs", level: 30, difficulty: game.DifficultyNormal, objective: -2}
	now := time.Unix(100, 0)
	for i := range p.members {
		me := p.members[i].state
		me.Mana, me.MaxMana = 100, 100
		p.state(i, me, now)
		p.receive(i, partyRoster(p, 4), now)
	}
	for i := range p.members {
		me := p.members[i].state
		p.step(i, me, nil, now, time.Second, func(kind string, payload interface{}) error {
			if kind != "get_dungeon_status" {
				t.Fatal("combat before entry status")
			}
			return nil
		}, func(float64, float64) { t.Fatal("movement before entry") })
		if !p.receive(i, partyMessage("get_dungeon_status", map[string]interface{}{"hasInstance": false, "isLeader": i == 0, "playerLevel": 30, "dungeonType": p.dungeon.kind}), now) {
			t.Fatal("valid status refused")
		}
	}
	entries := 0
	p.step(0, p.members[0].state, nil, now, time.Second, func(kind string, payload interface{}) error {
		entries++
		if kind != "enter_dungeon" {
			t.Fatal("not normal dungeon entry")
		}
		return nil
	}, func(float64, float64) { t.Fatal("movement before scene") })
	p.step(0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("uncertain entry retried"); return nil }, func(float64, float64) {})
	if entries != 1 || p.failed {
		t.Fatal("missing leader-owned launch")
	}
	if enter {
		layout := loadDungeonLayout()
		for i := range p.members {
			if !p.receive(i, dungeonScene(p, layout, loadDungeonSummary(layout, 0), 0), now) {
				t.Fatal("ordinary fresh entry scene refused")
			}
			if p.dungeon.members[i].entered {
				t.Fatal("scene alone counted as own entry")
			}
			me := p.members[i].state
			me.InstanceID = p.dungeon.instance
			p.state(i, me, now)
		}
		if p.failed || p.dungeonCounts().entered != 4 {
			t.Fatal("fresh own entry coverage incomplete")
		}
	}
	return p
}

func dungeonScene(p *partyLoad, layout game.DungeonLayout, summary game.DungeonRoomSummary, spawnRoom int) Message {
	room := layout.Rooms[spawnRoom]
	return partyMessage("enter_instance", map[string]interface{}{"instanceId": "dungeon_synthetic", "type": p.dungeon.kind, "layout": layout, "roomState": summary, "spawn": map[string]float64{"x": room.X, "y": 0, "z": room.Z}})
}

func TestDungeonLoadRequiresEachClearAndOwnTownExit(t *testing.T) {
	p := dungeonFixture(t, true)
	now := time.Unix(100, 0)
	summary := loadDungeonSummary(p.dungeon.layout, 2)
	for i := 0; i < 3; i++ {
		if !p.receive(i, partyMessage("dungeon_room_state", summary), now) {
			t.Fatal("valid clear refused")
		}
	}
	p.step(0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("peer missing clear passed"); return nil }, func(float64, float64) {})
	if p.dungeonCounts().cleared != 3 || p.dungeonCounts().exited != 0 {
		t.Fatal("partial clear passed")
	}
	p.receive(3, partyMessage("dungeon_room_state", summary), now)
	for i := range p.members {
		requests := 0
		p.step(i, p.members[i].state, nil, now, time.Second, func(kind string, payload interface{}) error {
			requests++
			if kind != "recall" {
				t.Fatal("clear did not request ordinary recall")
			}
			return nil
		}, func(float64, float64) { t.Fatal("clear kept fighting/moving") })
		p.step(i, p.members[i].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("recall retried"); return nil }, func(float64, float64) {})
		if requests != 1 {
			t.Fatal("a peer's earlier exit stranded other clients")
		}
		p.receive(i, partyMessage("enter_instance", map[string]string{"instanceId": "", "type": "overworld"}), now)
		if p.dungeon.members[i].exited {
			t.Fatal("town scene without own state passed exit")
		}
		me := p.members[i].state
		me.InstanceID, me.X, me.Z = "", -1.25, 200
		p.state(i, me, now)
	}
	counts := p.dungeonCounts()
	if p.failed || counts.entered != 4 || counts.cleared != 4 || counts.exited != 4 || counts.rooms != 2 || counts.bosses != 2 {
		t.Fatal("all-client clear/exit coverage incorrect")
	}
}

func TestDungeonLoadDeathWaitsForRecoveryAndReturnsToLatestClearedBoss(t *testing.T) {
	p := dungeonFixture(t, true)
	now := time.Unix(100, 0)
	summary := loadDungeonSummary(p.dungeon.layout, 1) // Explicit checkpoint fixture, not an earned kill.
	for i := range p.members {
		p.receive(i, partyMessage("dungeon_room_state", summary), now)
	}
	me := p.members[0].state
	me.Health = 0
	p.state(0, me, now)
	p.receive(0, partyMessage("enter_instance", map[string]string{"instanceId": "", "type": "overworld"}), now)
	me.InstanceID, me.X, me.Z, me.Health, me.Mana = "", -1.25, 200, 100, 80
	p.state(0, me, now)
	p.step(0, me, nil, now, time.Second, func(string, interface{}) error { t.Fatal("insufficient town mana reentered"); return nil }, func(float64, float64) {})
	me.Mana = 100
	p.state(0, me, now)
	requests := 0
	p.step(0, me, nil, now, time.Second, func(kind string, payload interface{}) error {
		requests++
		if kind != "enter_dungeon" {
			t.Fatal("recovery reset or bypassed the run")
		}
		return nil
	}, func(float64, float64) {})
	p.step(0, me, nil, now, time.Second, func(string, interface{}) error { t.Fatal("reentry retried"); return nil }, func(float64, float64) {})
	if requests != 1 || !p.receive(0, dungeonScene(p, p.dungeon.layout, summary, 1), now) {
		t.Fatal("same-layout latest checkpoint refused")
	}
	me.InstanceID, me.X, me.Z = p.dungeon.instance, 100, 0
	p.state(0, me, now)
	counts := p.dungeonCounts()
	if p.failed || counts.reentries != 1 || counts.checkpointReturns != 1 || p.dungeon.members[0].dead {
		t.Fatal("fresh own checkpoint return missing")
	}
}

func TestDungeonLoadRejectsOldRunsChangedScenesAndMissingReplies(t *testing.T) {
	for _, scenario := range []string{"entry-timeout", "exit-timeout", "changed-instance", "changed-layout", "old-clear", "regressed-clear", "bad-objective", "wrong-checkpoint", "unrequested-town"} {
		t.Run(scenario, func(t *testing.T) {
			p := dungeonFixture(t, scenario != "entry-timeout" && scenario != "old-clear")
			now := time.Unix(100, 0)
			layout := loadDungeonLayout()
			summary := loadDungeonSummary(layout, 0)
			switch scenario {
			case "entry-timeout":
				p.step(1, p.members[1].state, nil, now.Add(time.Second), time.Second, func(string, interface{}) error { t.Fatal("entry retried"); return nil }, func(float64, float64) {})
			case "exit-timeout":
				for i := range p.members {
					p.receive(i, partyMessage("dungeon_room_state", loadDungeonSummary(layout, 2)), now)
				}
				p.step(0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { return nil }, func(float64, float64) {})
				p.step(0, p.members[0].state, nil, now.Add(time.Second), time.Second, func(string, interface{}) error { t.Fatal("exit retried"); return nil }, func(float64, float64) {})
			case "changed-instance":
				me := p.members[0].state
				me.InstanceID = "dungeon-other"
				p.state(0, me, now)
			case "unrequested-town":
				p.receive(0, partyMessage("enter_instance", map[string]string{"instanceId": "", "type": "overworld"}), now)
			case "regressed-clear":
				p.receive(0, partyMessage("dungeon_room_state", loadDungeonSummary(layout, 1)), now)
				p.receive(0, partyMessage("dungeon_room_state", summary), now)
			case "bad-objective":
				summary.ObjectiveRoomIndex = -1
				p.receive(0, partyMessage("dungeon_room_state", summary), now)
			case "old-clear":
				p.receive(0, dungeonScene(p, layout, loadDungeonSummary(layout, 2), 0), now)
			case "wrong-checkpoint", "changed-layout":
				p.dungeon.members[0].scene = false
				p.dungeon.members[0].pending = "enter"
				if scenario == "changed-layout" {
					layout.GenerationSeed = "different-seed"
				}
				p.receive(0, dungeonScene(p, layout, summary, 1), now)
			}
			if !p.counts().failed {
				t.Fatal("unsafe or incomplete dungeon passed")
			}
		})
	}
	for _, scenario := range []string{"existing", "missing", "wrong-leader", "under-level", "wrong-type"} {
		t.Run("status/"+scenario, func(t *testing.T) {
			p, _ := partyFixture()
			p.dungeon = &dungeonLoad{kind: "verdant_bastion_catacombs", level: 30, difficulty: game.DifficultyNormal}
			p.dungeon.members[0].pending = "status"
			status := map[string]interface{}{"hasInstance": false, "isLeader": true, "playerLevel": 30, "dungeonType": p.dungeon.kind}
			switch scenario {
			case "existing":
				status["activeRun"] = map[string]string{"instanceId": "old-run"}
			case "missing":
				delete(status, "hasInstance")
			case "wrong-leader":
				status["isLeader"] = false
			case "under-level":
				status["playerLevel"] = 29
			case "wrong-type":
				status["dungeonType"] = "molten_core"
			}
			if p.receive(0, partyMessage("get_dungeon_status", status), time.Unix(100, 0)) || !p.counts().failed {
				t.Fatal("invalid or existing status admitted")
			}
		})
	}
}

func TestDungeonLoadLivingRecoveryUsesRecallAndNormalTownResourceWait(t *testing.T) {
	p := dungeonFixture(t, true)
	now := time.Unix(100, 0)
	me := p.members[2].state
	me.Mana = 10
	p.state(2, me, now)
	requests := 0
	p.step(2, me, nil, now, time.Second, func(kind string, payload interface{}) error {
		requests++
		if kind != "recall" {
			t.Fatal("living recovery used mana-refilling respawn or a grant")
		}
		return nil
	}, func(float64, float64) { t.Fatal("empty-mana character kept fighting") })
	if requests != 1 || !p.dungeon.members[2].recovering {
		t.Fatal("living recovery missing")
	}
	p.receive(2, partyMessage("enter_instance", map[string]string{"instanceId": "", "type": "overworld"}), now)
	me.InstanceID, me.X, me.Z = "", -1.25, 200
	p.state(2, me, now)
	p.step(2, me, nil, now, time.Second, func(string, interface{}) error { t.Fatal("low resource return bypassed town regeneration"); return nil }, func(float64, float64) {})
	me.Mana = 100
	p.state(2, me, now)
	p.step(2, me, nil, now, time.Second, func(kind string, payload interface{}) error {
		if kind != "enter_dungeon" {
			t.Fatal("town return did not resume normally")
		}
		return nil
	}, func(float64, float64) {})
	if p.failed || p.dungeon.members[2].pending != "enter" {
		t.Fatal("town recovery did not resume the same run")
	}
}

func TestDungeonLoadSelectionRefusesRaidsUnknownAndUnderlevelRegionalRuns(t *testing.T) {
	_, creds := partyFixture()
	for _, selection := range []struct {
		kind, difficulty string
		level            int
	}{{"weekly_raid", "normal", 100}, {"missing", "normal", 30}, {"molten_core", "normal", 30}, {"abyssal_well", "normal", 50}, {"verdant_bastion_catacombs", "easy", 30}, {"verdant_bastion_catacombs", "normal", 31}} {
		if !newDungeonParty(creds, selection.kind, selection.level, selection.difficulty).counts().failed {
			t.Fatal("unsupported or lowered run accepted")
		}
	}
}

func TestDungeonRouteTraversesCanonicalGeneratedRegionalFloors(t *testing.T) {
	w := game.NewWorld(nil)
	t.Cleanup(w.StopBackground)
	for _, kind := range []string{"verdant_bastion_catacombs", "abyssal_well", "molten_core", "tempest_spire"} {
		t.Run(kind, func(t *testing.T) {
			id := w.CreateDungeon("synthetic-route-"+kind, kind, game.DifficultyNormal, 70)
			layout, ok := w.GetInstanceLayout(id)
			if !ok {
				t.Fatal("actual generator omitted layout")
			}
			route, ok := newDungeonRoute(layout)
			if !ok {
				t.Fatal("actual canonical geometry refused")
			}
			from := dungeonPoint{layout.Rooms[0].X, layout.Rooms[0].Z}
			for _, room := range layout.Rooms[1:] {
				to := dungeonPoint{room.X, room.Z}
				steps := 0
				for math.Hypot(from.x-to.x, from.z-to.z) > .01 {
					next, ok := route.next(from, to)
					if !ok || !route.direct(from, next) {
						t.Fatal("route cut a missing floor or failed connected rooms")
					}
					distance := math.Hypot(next.x-from.x, next.z-from.z)
					if distance < 1e-8 {
						t.Fatal("route stalled at doorway")
					}
					step := math.Min(4, distance)
					from = dungeonPoint{from.x + (next.x-from.x)*step/distance, from.z + (next.z-from.z)*step/distance}
					steps++
					if steps > 5000 {
						t.Fatal("route did not reach target within fixture bound")
					}
				}
			}
		})
	}
}

func TestDungeonRouteRefusesDiagonalWallShortcutsAndInvalidGeometry(t *testing.T) {
	layout := loadDungeonLayout()
	layout.Rooms = layout.Rooms[:2]
	layout.Rooms[1].Z = 100
	layout.WalkRects = []game.DungeonWalkRect{{Width: 40, Height: 40, Kind: "room"}, {X: 100, Z: 100, Width: 40, Height: 40, Kind: "room", RoomIndex: 1}, {X: 57.5, Width: 85, Height: 20, Kind: "corridor"}, {X: 100, Z: 45, Width: 20, Height: 90, Kind: "corridor"}}
	layout.Corridors = []game.DungeonCorridor{{FromRoomIndex: 0, ToRoomIndex: 1, Width: 20, WalkRectIndices: []int{2, 3}}}
	route, ok := newDungeonRoute(layout)
	if !ok {
		t.Fatal("canonical L hallway refused")
	}
	if route.direct(dungeonPoint{0, 0}, dungeonPoint{100, 100}) {
		t.Fatal("diagonal wall shortcut accepted")
	}
	if _, ok := route.next(dungeonPoint{50, 50}, dungeonPoint{100, 100}); ok {
		t.Fatal("off-floor start invented a teleport")
	}
	if _, ok := route.next(dungeonPoint{0, 0}, dungeonPoint{math.NaN(), 100}); ok {
		t.Fatal("NaN route accepted")
	}
	layout.WalkRects[0].X = math.Inf(1)
	if _, ok := newDungeonRoute(layout); ok {
		t.Fatal("nonfinite geometry accepted")
	}
}
