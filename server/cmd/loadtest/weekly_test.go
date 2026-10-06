package main

import (
	"errors"
	"math"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestRaidEntryBudgetLeavesDeliveryTimingCushion(t *testing.T) {
	r := &raidLoad{members: make([]raidLoadMember, 1)}
	start := time.Unix(100, 0)
	// Model the production policy's two-token, one-per30s server bucket.
	// Initial dispatch reaches the server500ms later, later requests100ms
	// later. WebSocket ordering is preserved; client/server budget epochs differ.
	tokens, serverAt := 2.0, start.Add(500*time.Millisecond)
	accepted := 0
	for _, seconds := range []int{0, 1, 30, 31, 32, 61, 62, 63} {
		dispatch := start.Add(time.Duration(seconds) * time.Second)
		if !r.admitEntry(0, dispatch) {
			continue
		}
		accepted++
		delay := 100 * time.Millisecond
		if seconds == 0 {
			delay = 500 * time.Millisecond
		}
		receive := dispatch.Add(delay)
		if receive.After(serverAt) {
			tokens = math.Min(2, tokens+receive.Sub(serverAt).Seconds()/30)
			serverAt = receive
		}
		if tokens < 1 {
			t.Fatal("client admitted entry before delayed server budget refilled")
		}
		tokens--
	}
	if accepted != 4 {
		t.Fatal("cushioned recovery stalled instead of making safe entries")
	}
}

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

func TestDungeonClericCanHealWhilePartyRecoveryPausesAttacks(t *testing.T) {
	p := raidEncounterFixture(t, "weekly_raid")
	now := time.Unix(101, 0)
	p.members[0].state.Health = 50
	p.members[2].state.Health = 0 // Another participant is recovering.
	me := p.members[1].state
	me.UnlockedSkills = []string{"Healing Light"}
	p.members[1].state = me
	casts := 0
	request := func(kind string, payload interface{}) error {
		if kind != "ability" {
			t.Fatal("recovery pause allowed an attack, progression or unrelated request")
		}
		cast := payload.(map[string]interface{})
		if cast["skillName"] != "Healing Light" || cast["targetId"] != p.members[0].id {
			t.Fatal("waiting cleric did not heal the wounded living party member")
		}
		casts++
		return nil
	}
	for tick := 0; tick < 2; tick++ {
		p.step(1, me, nil, now, time.Second, request, func(float64, float64) { t.Fatal("recovery pause moved toward combat") })
	}
	if p.failed || casts != 1 || p.members[1].pendingSkill != "Healing Light" || p.dungeonCounts().cleared != 0 {
		t.Fatal("party recovery suppressed healing, repeated a pending cast or fabricated clear")
	}
}

func TestDungeonClericWaitingHealRetainsNormalSafetyFences(t *testing.T) {
	now := time.Unix(101, 0)
	for _, test := range []struct {
		name   string
		change func(*partyLoad, *Entity)
	}{
		{"failed-party", func(p *partyLoad, _ *Entity) { p.failed = true }},
		{"dead", func(_ *partyLoad, me *Entity) { me.Health = 0 }},
		{"foreign-scene", func(_ *partyLoad, me *Entity) { me.InstanceID = "foreign" }},
		{"foreign-identity", func(_ *partyLoad, me *Entity) { me.ID = "foreign" }},
		{"wrong-class", func(_ *partyLoad, me *Entity) { me.SubType = "Fighter" }},
		{"no-mana", func(_ *partyLoad, me *Entity) { me.Mana = 0 }},
		{"locked-skill", func(_ *partyLoad, me *Entity) { me.UnlockedSkills = nil }},
		{"pending-skill", func(p *partyLoad, _ *Entity) { p.members[1].pendingSkill = "Healing Light" }},
		{"cooldown", func(p *partyLoad, _ *Entity) { p.members[1].readyAt["Healing Light"] = now.Add(time.Second) }},
		{"own-recovery", func(p *partyLoad, _ *Entity) { p.dungeon.members[1].recovering = true }},
		{"own-exit", func(p *partyLoad, _ *Entity) { p.dungeon.members[1].exitRequested = true }},
		{"missing-route", func(p *partyLoad, _ *Entity) { p.dungeon.route = nil }},
		{"out-of-range", func(p *partyLoad, _ *Entity) { p.members[0].state.X = 15 }},
		{"foreign-ally", func(p *partyLoad, _ *Entity) { p.members[0].state.InstanceID = "foreign" }},
		{"dead-ally", func(p *partyLoad, _ *Entity) { p.members[0].state.Health = 0 }},
		{"healthy-allies", func(p *partyLoad, _ *Entity) { p.members[0].state.Health = 100 }},
	} {
		t.Run(test.name, func(t *testing.T) {
			p := raidEncounterFixture(t, "weekly_raid")
			p.members[0].state.Health = 50
			me := p.members[1].state
			me.UnlockedSkills = []string{"Healing Light"}
			test.change(p, &me)
			p.mu.Lock()
			defer p.mu.Unlock()
			if p.healWaitingDungeon(1, me, now, func(string, interface{}) error {
				t.Fatal("waiting heal bypassed safety fence")
				return nil
			}) {
				t.Fatal("unsafe healing request accepted")
			}
		})
	}
	t.Run("request-failure", func(t *testing.T) {
		p := raidEncounterFixture(t, "weekly_raid")
		p.members[0].state.Health = 50
		me := p.members[1].state
		me.UnlockedSkills = []string{"Healing Light"}
		p.mu.Lock()
		defer p.mu.Unlock()
		p.healWaitingDungeon(1, me, now, func(string, interface{}) error { return errors.New("synthetic write failure") })
		if !p.failed || p.failureStage != failureDungeonRequest {
			t.Fatal("failed healing write did not fail the workload")
		}
	})
}

func TestRaidRecoveryWaitsForNormalEntryRateBudget(t *testing.T) {
	p := raidEncounterFixture(t, "weekly_raid")
	index := 1 // Initial follower entry was server-driven, not a sent request.
	m := &p.dungeon.members[index]
	me := p.members[index].state
	me.InstanceID, me.Health, me.Mana = "", me.MaxHealth, me.MaxMana
	m.dead, m.recovering, m.townScene = true, true, true
	now := time.Unix(100, 0)
	requests := 0
	request := func(kind string, _ interface{}) error {
		if kind != "raid_enter" {
			t.Fatal("unexpected recovery request")
		}
		requests++
		return nil
	}
	for attempt := 0; attempt < 2; attempt++ {
		p.dungeon.step(p, index, me, now, time.Second, request)
		m.pending = "" // Declared fixture acknowledgement; no runtime credit.
	}
	p.dungeon.step(p, index, me, now.Add(time.Second), time.Second, request)
	if p.failed || requests != 2 || m.reentries != 2 || m.pending != "" {
		t.Fatal("recovery sent a third request before the normal two-per-minute raid budget refilled")
	}
	p.dungeon.step(p, index, me, now.Add(30*time.Second), time.Second, request)
	if p.failed || requests != 2 || m.pending != "" {
		t.Fatal("entry omitted delivery cushion")
	}
	p.dungeon.step(p, index, me, now.Add(31*time.Second+time.Millisecond), time.Second, request)
	if p.failed || requests != 3 || m.reentries != 3 || m.pending != "enter" {
		t.Fatal("raid entry did not resume after cushioned token refill")
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
			want := map[string]string{
				"nil": "weekly_phase_envelope", "zero": "weekly_phase_envelope", "too-high": "weekly_phase_envelope",
				"wrong-instance": "weekly_phase_scene", "town": "weekly_phase_scene", "unprepared": "weekly_phase_scene",
				"wrong-eidolon": "weekly_phase_identity", "wrong-element": "weekly_phase_identity",
				"skipped": "weekly_phase_order", "regressed": "weekly_phase_order", "dead": "weekly_phase_inactive",
			}[scenario]
			if want != "" && p.failureCode() != want {
				t.Fatal("phase rejection lost its fixed safe cause", p.failureCode())
			}
		})
	}
}
