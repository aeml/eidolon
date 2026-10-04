package main

import (
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func weeklyPhase(p *partyLoad, phase int) game.RaidPhaseEvent {
	identities := [4][2]string{{"Orun", "Earth"}, {"Neris", "Water"}, {"Pyralis", "Fire"}, {"Aeral", "Air"}}
	return game.RaidPhaseEvent{InstanceID: p.dungeon.instance, Phase: phase, Eidolon: identities[phase-1][0], Element: identities[phase-1][1]}
}

func weeklyClearSummary(p *partyLoad) game.DungeonRoomSummary {
	summary := loadDungeonSummary(p.dungeon.layout, len(p.dungeon.layout.Rooms)-1)
	summary.RunLevel, summary.Difficulty = p.raid.level, string(game.DifficultyMythic)
	return summary
}

func TestWeeklyLoadNeedsEveryOwnPhaseAndActualBossClear(t *testing.T) {
	p := raidEncounterFixture(t, "weekly_raid")
	now := time.Unix(100, 0)
	for phase := 1; phase <= 4; phase++ {
		for i := range p.members {
			if !p.receive(i, partyMessage("raid_phase", weeklyPhase(p, phase)), now) {
				t.Fatal("valid own ordered phase refused")
			}
		}
	}
	if p.weeklyCounts().members != 5 || p.weeklyCounts().minimum != 4 || p.dungeonCounts().cleared != 0 {
		t.Fatal("phase announcements substituted for earned boss clear")
	}
	for i := 0; i < 4; i++ {
		p.receive(i, partyMessage("dungeon_room_state", weeklyClearSummary(p)), now)
	}
	p.dungeon.step(p, 0, p.members[0].state, now, time.Second, func(string, interface{}) error { t.Fatal("exit before fifth own boss clear"); return nil })
	if p.failed || p.dungeonCounts().cleared != 4 || p.dungeonCounts().exited != 0 {
		t.Fatal("partial boss clear gates incorrect")
	}
	p.receive(4, partyMessage("dungeon_room_state", weeklyClearSummary(p)), now)
	if p.failed || p.dungeonCounts().cleared != 5 || p.dungeonCounts().exited != 0 {
		t.Fatal("all-own clear fabricated town exits")
	}
}

func TestWeeklyLoadBossClearDoesNotSubstituteForOwnPhases(t *testing.T) {
	p := raidEncounterFixture(t, "weekly_raid")
	now := time.Unix(100, 0)
	for i := range p.members {
		p.receive(i, partyMessage("dungeon_room_state", weeklyClearSummary(p)), now)
	}
	if p.failed || p.dungeonCounts().cleared != 0 || p.weeklyCounts().members != 0 {
		t.Fatal("boss-only clear passed the story phase gate")
	}
}

func TestWeeklyLoadRefusesForeignMissingOrHistoricalPhases(t *testing.T) {
	for _, scenario := range []string{"nil", "wrong-instance", "wrong-eidolon", "wrong-element", "zero", "too-high", "skipped", "regressed", "dead", "town", "unprepared", "repair-crystal"} {
		t.Run(scenario, func(t *testing.T) {
			p := raidEncounterFixture(t, "weekly_raid")
			now := time.Unix(100, 0)
			phase := weeklyPhase(p, 1)
			switch scenario {
			case "nil":
				p.receive(0, partyMessage("raid_phase", nil), now)
			case "repair-crystal":
				summary := weeklyClearSummary(p)
				summary.Crystal = &game.CrystalSanctumSnapshot{}
				p.receive(0, partyMessage("dungeon_room_state", summary), now)
			default:
				switch scenario {
				case "wrong-instance":
					phase.InstanceID = "foreign_raid"
				case "wrong-eidolon":
					phase.Eidolon = "Malachar"
				case "wrong-element":
					phase.Element = "Air"
				case "zero":
					phase.Phase = 0
				case "too-high":
					phase.Phase = 5
				case "skipped":
					phase = weeklyPhase(p, 4)
				case "regressed":
					p.receive(0, partyMessage("raid_phase", weeklyPhase(p, 1)), now)
					p.receive(0, partyMessage("raid_phase", weeklyPhase(p, 2)), now)
				case "dead":
					p.members[0].state.Health = 0 // Declared unit snapshot only.
				case "town":
					p.members[0].state.InstanceID = ""
				case "unprepared":
					p.raid.members[4].allReadySeen = false
				}
				p.receive(0, partyMessage("raid_phase", phase), now)
			}
			if !p.failed || p.weeklyCounts().members != 0 || p.dungeonCounts().cleared != 0 {
				t.Fatal("unproven/contradictory phase evidence passed")
			}
		})
	}
}
