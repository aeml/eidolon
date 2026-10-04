package main

import (
	"encoding/json"
	"math/bits"

	"eidolon-server/internal/game"
)

func raidLoadLevel(kind string) (int, bool) {
	if kind == "weekly_raid" {
		return game.MaxPlayerLevel, true
	}
	definition, valid := game.ElementalRaidDefinitionForType(kind)
	return definition.RequiredLevel, valid
}

func (r *raidLoad) encounterObserved(index int) bool {
	if r.kind == "weekly_raid" {
		return r.members[index].phasesSeen == 15
	}
	return r.members[index].restored
}

// Retain only each participant's ordered phase mask, not story or actor history.
// Global announcements outside the actual own raid cannot prove participation.
func (r *raidLoad) receivePhase(p *partyLoad, index int, message Message) bool {
	var phase *game.RaidPhaseEvent
	me := p.members[index].state
	reject := func(stage loadFailureStage) bool { p.failAt(stage); return false }
	if json.Unmarshal(message.Payload, &phase) != nil || phase == nil || phase.Phase < 1 || phase.Phase > 4 ||
		len(phase.Title) > 256 || len(phase.Dialogue) > 4096 || len(phase.Effect) > 1024 || len(phase.Color) > 16 {
		return reject(failureWeeklyPhaseEnvelope)
	}
	if r.kind != "weekly_raid" || !r.prepared() || p.dungeon == nil || p.dungeon.instance == "" ||
		phase.InstanceID != p.dungeon.instance || me.InstanceID != phase.InstanceID {
		return reject(failureWeeklyPhaseScene)
	}
	if me.Health <= 0 || me.State == "DEAD" {
		return reject(failureWeeklyPhaseInactive)
	}
	expected := [4][2]string{{"Orun", "Earth"}, {"Neris", "Water"}, {"Pyralis", "Fire"}, {"Aeral", "Air"}}[phase.Phase-1]
	if phase.Eidolon != expected[0] || phase.Element != expected[1] {
		return reject(failureWeeklyPhaseIdentity)
	}
	m := &r.members[index]
	seen := bits.OnesCount8(m.phasesSeen)
	if phase.Phase != seen && phase.Phase != seen+1 {
		return reject(failureWeeklyPhaseOrder) // No missing phase, out-of-order replay or claimed finale.
	}
	m.phasesSeen |= 1 << (phase.Phase - 1)
	if r.encounterObserved(index) && p.dungeon.members[index].entered && p.dungeon.members[index].summaryKnown && p.dungeon.members[index].summary.ObjectiveRoomIndex == -1 {
		p.dungeon.members[index].clear = true // Still requires actual all-room clear.
	}
	return true
}

type weeklyLoadCounts struct{ members, minimum uint64 }

func (p *partyLoad) weeklyCounts() weeklyLoadCounts {
	p.mu.Lock()
	defer p.mu.Unlock()
	var counts weeklyLoadCounts
	if p.raid == nil || p.raid.kind != "weekly_raid" {
		return counts
	}
	for index, member := range p.raid.members {
		phases := uint64(bits.OnesCount8(member.phasesSeen))
		if phases == 4 {
			counts.members++
		}
		if index == 0 || phases < counts.minimum {
			counts.minimum = phases
		}
	}
	return counts
}
