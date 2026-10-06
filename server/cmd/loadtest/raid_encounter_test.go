package main

import (
	"math"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func raidEncounterFixture(t *testing.T, kind string) *partyLoad {
	t.Helper()
	p := raidFixture(5, kind)
	p.dungeon = &dungeonLoad{kind: kind, difficulty: game.DifficultyNormal, level: p.raid.level, objective: -2}
	if kind == "weekly_raid" {
		p.dungeon.difficulty = game.DifficultyMythic
	}
	p.raid.converted, p.raid.checkSent = true, true
	ready := make([]bool, len(p.members))
	for i := range ready {
		ready[i] = true
		p.raid.members[i] = raidLoadMember{activeSeen: true, readySent: true, readySeen: true, allReadySeen: true}
	}
	now := time.Unix(100, 0)
	for i := range p.members {
		p.receive(i, raidRoster(p, len(p.members), false, ready), now)
		me := p.members[i].state
		me.Mana, me.MaxMana = 100, 100
		p.state(i, me, now)
	}
	for i := range p.members {
		p.step(i, p.members[i].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("entry before all raid participants ready"); return nil }, func(float64, float64) { t.Fatal("moved before raid entry") })
	}
	p.step(0, p.members[0].state, nil, now, time.Second, func(kind string, payload interface{}) error {
		if kind != "raid_enter" || payload.(map[string]string)["raidType"] != p.raid.kind {
			t.Fatal("not normal raid entry")
		}
		return nil
	}, func(float64, float64) { t.Fatal("moved before scene") })
	layout := loadDungeonLayout()
	layout.Rooms[1].Type = "normal"
	layout.Rooms[2].Width, layout.Rooms[2].Height = 270, 250
	layout.WalkRects[2].Width, layout.WalkRects[2].Height = 270, 250
	if err := game.ValidateDungeonLayout(layout); err != nil {
		t.Fatal("invalid synthetic raid floor", err)
	}
	summary := loadDungeonSummary(layout, 0)
	summary.RunLevel = p.raid.level
	summary.Difficulty = string(p.dungeon.difficulty)
	definition, _ := game.ElementalRaidDefinitionForType(kind)
	if kind != "weekly_raid" {
		summary.Crystal = &game.CrystalSanctumSnapshot{InstanceID: "dungeon_synthetic", RaidType: kind, Element: definition.Element, Name: definition.Crystal, Stage: "fractured", TotalWaves: 3, X: 200}
	}
	for i := range p.members {
		// Fresh normal raid responses do not contain a spawn field.
		scene := partyMessage("enter_instance", map[string]interface{}{"instanceId": "dungeon_synthetic", "type": kind, "layout": layout, "roomState": summary})
		if !p.receive(i, scene, now) {
			t.Fatalf("fresh normal raid scene refused: member=%d launched=%t instance_bound=%t summary_known=%t", i, p.dungeon.launched, p.dungeon.instance != "", p.dungeon.members[i].summaryKnown)
		}
		me := p.members[i].state
		me.InstanceID = p.dungeon.instance
		p.state(i, me, now)
	}
	if p.failed || p.dungeonCounts().entered != 5 {
		t.Fatal("fifth participant omitted from entry")
	}
	return p
}

func ritualSummary(p *partyLoad, wave int, restored bool) game.DungeonRoomSummary {
	summary := loadDungeonSummary(p.dungeon.layout, len(p.dungeon.layout.Rooms)-1)
	summary.RunLevel = p.raid.level
	definition, _ := game.ElementalRaidDefinitionForType(p.raid.kind)
	crystal := &game.CrystalSanctumSnapshot{InstanceID: p.dungeon.instance, RaidType: p.raid.kind, Element: definition.Element, Name: definition.Crystal, Stage: "repairing", Wave: wave, TotalWaves: 3, Progress: (wave - 1) * 33, X: 200}
	if restored {
		crystal.Stage, crystal.Wave, crystal.Progress = "restored", 3, 100
	} else {
		total, count := 0, 0
		switch crystal.Element {
		case "Earth":
			total, count = 8, 2
		case "Water":
			total, count = 2, 2
		case "Fire":
			total, count = 3, 3
		case "Air":
			total, count = 4, 4
		}
		objective := &game.CrystalVigilSnapshot{Total: total}
		for i := 0; i < count; i++ {
			point := game.CrystalVigilPoint{X: 200, Radius: 6, State: "active"}
			switch crystal.Element {
			case "Earth":
				point.Radius = 12
				if i == 1 {
					point.Radius, point.State = 18, "boundary"
				}
			case "Water":
				if i == 0 {
					point.X += 30
				} else {
					point.Radius = 10
				}
			case "Fire", "Air":
				angle := float64(i) * 2 * math.Pi / float64(count)
				point.X += math.Cos(angle) * 30
				point.Z += math.Sin(angle) * 30
			}
			objective.Points = append(objective.Points, point)
		}
		crystal.Objective = objective
	}
	summary.Crystal = crystal
	return summary
}

func TestRaidBossClearIsNotRestorationOrTownExit(t *testing.T) {
	p := raidEncounterFixture(t, "earth_crystal_raid")
	now := time.Unix(100, 0)
	for wave := 1; wave <= 3; wave++ {
		for i := range p.members {
			if !p.receive(i, partyMessage("dungeon_room_state", ritualSummary(p, wave, false)), now) {
				t.Fatal("valid wave snapshot refused")
			}
		}
	}
	if p.dungeonCounts().cleared != 0 || p.raidCounts().restored != 0 || p.raidCounts().minWaveViews != 3 {
		t.Fatal("assault/waves substituted for repair completion")
	}
	for i := 0; i < 4; i++ {
		p.receive(i, partyMessage("dungeon_room_state", ritualSummary(p, 3, true)), now)
	}
	p.dungeon.step(p, 0, p.members[0].state, now, time.Second, func(string, interface{}) error { t.Fatal("fifth player missing restoration passed exit"); return nil })
	if p.failed || p.dungeonCounts().cleared != 4 {
		t.Fatal("partial restoration coverage incorrect")
	}
	p.receive(4, partyMessage("dungeon_room_state", ritualSummary(p, 3, true)), now)
	for i := range p.members {
		p.dungeon.step(p, i, p.members[i].state, now, time.Second, func(kind string, _ interface{}) error {
			if kind != "recall" {
				t.Fatal("not ordinary town exit")
			}
			return nil
		})
		p.receive(i, partyMessage("enter_instance", map[string]string{"type": "overworld", "instanceId": ""}), now)
		me := p.members[i].state
		me.InstanceID, me.X, me.Z = "", -1.25, 200
		p.state(i, me, now)
	}
	if p.failed || p.dungeonCounts().exited != 5 || p.raidCounts().restored != 5 {
		t.Fatal("every-client repair/exit missing")
	}
}

func TestRaidCrystalRefusesForeignPrematureAndMalformedProof(t *testing.T) {
	for _, scenario := range []string{"missing", "foreign-scene", "foreign-raid", "wrong-element", "wrong-crystal", "wrong-position", "unknown-stage", "invalid-wave", "wrong-progress", "missing-objective", "off-floor", "bad-radius", "bad-total", "bad-current", "false-complete", "premature-restore", "skipped-wave"} {
		t.Run(scenario, func(t *testing.T) {
			p := raidEncounterFixture(t, "earth_crystal_raid")
			summary := ritualSummary(p, 1, false)
			c := summary.Crystal
			switch scenario {
			case "missing":
				summary.Crystal = nil
			case "foreign-scene":
				c.InstanceID = "dungeon_other"
			case "foreign-raid":
				c.RaidType = "water_crystal_raid"
			case "wrong-element":
				c.Element = "Air"
			case "wrong-crystal":
				c.Name = "another crystal"
			case "wrong-position":
				c.X += 1
			case "unknown-stage":
				c.Stage = "won"
			case "invalid-wave":
				c.Wave = 4
			case "wrong-progress":
				c.Progress = 100
			case "missing-objective":
				c.Objective = nil
			case "off-floor":
				c.Objective.Points[0].X += 500
			case "bad-radius":
				c.Objective.Points[0].Radius = 0
			case "bad-total":
				c.Objective.Total = 0
			case "bad-current":
				c.Objective.Current = 9
			case "false-complete":
				c.Objective.Complete = true
			case "premature-restore":
				summary = ritualSummary(p, 3, true)
			case "skipped-wave":
				p.receive(0, partyMessage("dungeon_room_state", ritualSummary(p, 3, false)), time.Unix(100, 0))
				summary = ritualSummary(p, 3, true)
			}
			if p.receive(0, partyMessage("dungeon_room_state", summary), time.Unix(100, 0)) || !p.failed || p.raidCounts().restored != 0 {
				t.Fatal("unproven/foreign repair accepted")
			}
		})
	}
}

func TestRaidVigilMovesFromLiveMarkersWithoutAuthoringProgress(t *testing.T) {
	for _, kind := range []string{"earth_crystal_raid", "water_crystal_raid", "fire_crystal_raid", "air_crystal_raid"} {
		t.Run(kind, func(t *testing.T) {
			p := raidEncounterFixture(t, kind)
			now := time.Unix(100, 0)
			for i := range p.members {
				p.receive(i, partyMessage("dungeon_room_state", ritualSummary(p, 1, false)), now)
			}
			m := &p.raid.members[3]
			me := p.members[3].state
			moves := 0
			move := func(x, z float64) {
				moves++
				if !p.dungeon.route.direct(dungeonPoint{m.crystal.X, m.crystal.Z}, dungeonPoint{x, z}) {
					t.Fatal("ritual requested off-floor move")
				}
			}
			handled := p.raid.vigilMove(p, 3, me, now, move)
			if kind == "earth_crystal_raid" {
				if handled || moves != 0 {
					t.Fatal("earth defense replaced by fake channel")
				}
			} else if !handled || moves != 1 {
				t.Fatal("missing ordinary marker movement")
			}
			if kind == "water_crystal_raid" {
				me.X, me.Z = m.crystal.Objective.Points[0].X, m.crystal.Objective.Points[0].Z
				p.raid.vigilMove(p, 3, me, now, move)
				p.raid.vigilMove(p, 3, me, now.Add(750*time.Millisecond), move)
				if !m.waterReturning {
					t.Fatal("carrier did not return after observed font visit")
				}
			}
			if p.failed || p.raidCounts().restored != 0 || m.crystal.Objective.Current != 0 {
				t.Fatal("movement authored ritual completion")
			}
		})
	}
}
