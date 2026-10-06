package main

import (
	"encoding/json"
	"math"
	"math/bits"
	"strings"
	"time"

	"eidolon-server/internal/game"
)

type partyLoadView struct {
	PartyID, LeaderID string
	Members           []struct {
		ID, Class string
		Ready     *bool
	}
	ReadyCheckActive, AllReady *bool
}

type raidLoadMember struct {
	activeSeen, readySent, readySeen, allReadySeen bool
	crystal                                        *game.CrystalSanctumSnapshot
	wavesSeen                                      uint8
	restored                                       bool
	ritualWave                                     int
	waterReturning                                 bool
	pointSince                                     time.Time
	phasesSeen                                     uint8
	entryBudgetStarted                             bool
	entryTokens                                    float64
	entryBudgetAt                                  time.Time
}

// Shares partyLoad.mu. Preparation is separate from encounter/repair proof.
type raidLoad struct {
	kind                                 string
	level                                int
	conversionSent, converted, checkSent bool
	conversionAt, checkAt                time.Time
	members                              []raidLoadMember
}

const raidConversionMessage = "Raid group formed. Invite 5-10 qualified players, then complete a ready check."

// Stay below normal MsgRaidEnter's two-request/minute budget with one second
// of refill cushion: dispatch and server-admission clocks are not identical.
// Keep the two-request burst; recovery waits in town, never retries a rejected
// request or changes the server's policy. This is not arbitrary latency proof.
// Caller owns partyLoad.mu. Server-driven initial follower entry costs nothing.
func (r *raidLoad) admitEntry(index int, now time.Time) bool {
	m := &r.members[index]
	if !m.entryBudgetStarted {
		m.entryBudgetStarted, m.entryTokens, m.entryBudgetAt = true, 2, now
	}
	if now.After(m.entryBudgetAt) {
		m.entryTokens = math.Min(2, m.entryTokens+now.Sub(m.entryBudgetAt).Seconds()/31)
		m.entryBudgetAt = now
	}
	if m.entryTokens < 1 {
		return false
	}
	m.entryTokens--
	return true
}

func newRaidParty(credentials []BotCredentials, kind string) *partyLoad {
	p := newPartyCohort(credentials, 0, 0, 5, 10)
	level, valid := raidLoadLevel(kind)
	if !valid {
		p.failed = true
	}
	p.raid = &raidLoad{kind: kind, level: level, members: make([]raidLoadMember, len(p.members))}
	return p
}

func newRaidWorkload(credentials []BotCredentials, kind string) *partyLoad {
	p := newRaidParty(credentials, kind)
	p.dungeon = &dungeonLoad{kind: kind, level: p.raid.level, difficulty: game.DifficultyNormal, objective: -2}
	if kind == "weekly_raid" {
		p.dungeon.difficulty = game.DifficultyMythic
	}
	return p
}

func (r *raidLoad) receiveConversion(p *partyLoad, index int, message Message) bool {
	var chat struct {
		Sender, Channel, Message string
		History                  bool
	}
	if json.Unmarshal(message.Payload, &chat) != nil {
		p.failed = true
		return false
	}
	if chat.Sender != "System" || chat.Channel != "server" || chat.Message != raidConversionMessage || chat.History {
		return true // Ordinary chat is not a conversion acknowledgement.
	}
	if index != 0 || !r.conversionSent || r.converted || p.partyID == "" {
		p.failed = true
		return false
	}
	r.converted = true
	return true
}

func (r *raidLoad) receiveRoster(p *partyLoad, index int, view partyLoadView) bool {
	if view.ReadyCheckActive == nil || view.AllReady == nil || len(view.Members) > 5 && !r.converted {
		p.failed = true
		return false
	}
	all, ownReady := true, false
	for _, member := range view.Members {
		if member.Ready == nil {
			p.failed = true
			return false
		}
		all = all && *member.Ready
		if member.ID == p.members[index].id {
			ownReady = *member.Ready
		}
	}
	m := &r.members[index]
	if all != *view.AllReady || all && *view.ReadyCheckActive ||
		!r.checkSent && (*view.ReadyCheckActive || all || ownReady) ||
		m.readySeen && !ownReady || ownReady && !m.readySent {
		p.failed = true
		return false
	}
	if !r.checkSent {
		return true
	}
	if len(view.Members) != len(p.members) {
		p.failed = true // A changed cohort invalidates this ready check, no auto-retry.
		return false
	}
	if *view.ReadyCheckActive {
		m.activeSeen = true
	}
	if ownReady {
		m.readySeen = true
	}
	if all {
		m.allReadySeen = true
	} else if m.allReadySeen || !*view.ReadyCheckActive {
		p.failed = true
		return false
	}
	return true
}

func (r *raidLoad) convert(p *partyLoad, index int, now time.Time, timeout time.Duration, request func(string, interface{}) error) bool {
	if r.converted {
		return true
	}
	if r.conversionSent {
		if now.Sub(r.conversionAt) >= timeout {
			p.failed = true
		}
		return false
	}
	if index == 0 && p.partyID != "" && p.inviteIndex < 0 {
		r.conversionSent, r.conversionAt = true, now
		if request("raid_convert", map[string]string{"raidType": r.kind}) != nil {
			p.failed = true
		}
	}
	return false
}

func (r *raidLoad) prepared() bool {
	if !r.converted || !r.checkSent {
		return false
	}
	for _, member := range r.members {
		if !member.activeSeen || !member.readySent || !member.readySeen || !member.allReadySeen {
			return false
		}
	}
	return true
}

func (r *raidLoad) prepare(p *partyLoad, index int, now time.Time, timeout time.Duration, request func(string, interface{}) error) bool {
	if !r.convert(p, index, now, timeout, request) || p.failed {
		return false
	}
	if r.prepared() {
		return true
	}
	if r.checkSent && now.Sub(r.checkAt) >= timeout {
		p.failed = true
		return false
	}
	if !r.checkSent {
		if index == 0 {
			r.checkSent, r.checkAt = true, now
			if request("party_ready_check", map[string]interface{}{}) != nil {
				p.failed = true
			}
		}
		return false
	}
	m := &r.members[index]
	if m.activeSeen && !m.readySent {
		m.readySent = true
		if request("party_ready", map[string]bool{"ready": true}) != nil {
			p.failed = true
		}
	}
	return false
}

func (r *raidLoad) receiveCrystal(p *partyLoad, index int, crystal *game.CrystalSanctumSnapshot, initial, assaultClear bool) bool {
	if r.kind == "weekly_raid" {
		if crystal != nil {
			p.failed = true // Dark King raid is not an elemental repair scene.
			return false
		}
		return true
	}
	m := &r.members[index]
	definition, _ := game.ElementalRaidDefinitionForType(r.kind)
	chamber := p.dungeon.layout.Rooms[len(p.dungeon.layout.Rooms)-1]
	reject := func() bool { p.failed = true; return false }
	if crystal == nil || crystal.InstanceID != p.dungeon.instance || crystal.RaidType != r.kind || crystal.Element != definition.Element || crystal.Name != definition.Crystal || crystal.TotalWaves != 3 ||
		math.IsNaN(crystal.X) || math.IsNaN(crystal.Z) || math.Hypot(crystal.X-chamber.X, crystal.Z-chamber.Z) > .01 ||
		crystal.Wave < 0 || crystal.Wave > 3 || crystal.Progress < 0 || crystal.Progress > 100 ||
		initial && crystal.Stage != "fractured" {
		return reject()
	}
	if m.crystal != nil && (crystal.Wave < m.crystal.Wave || crystal.Progress < m.crystal.Progress || m.restored && crystal.Stage != "restored") {
		return reject()
	}
	switch crystal.Stage {
	case "fractured":
		if crystal.Wave != 0 || crystal.Progress != 0 || crystal.Objective != nil || m.crystal != nil && m.crystal.Stage != "fractured" {
			return reject()
		}
	case "repairing":
		if !assaultClear || crystal.Progress > 99 || crystal.Progress < max(0, crystal.Wave-1)*33 || crystal.Progress > crystal.Wave*33 ||
			crystal.Wave == 0 && crystal.Objective != nil || crystal.Wave > 0 && !r.validObjective(p, crystal) {
			return reject()
		}
		if crystal.Wave > 0 {
			m.wavesSeen |= 1 << (crystal.Wave - 1)
		}
	case "restored":
		if !assaultClear || crystal.Wave != 3 || crystal.Progress != 100 || crystal.Objective != nil || m.wavesSeen != 7 {
			return reject()
		}
		m.restored = true
	default:
		return reject()
	}
	m.crystal = crystal
	return true
}

func (r *raidLoad) validObjective(p *partyLoad, crystal *game.CrystalSanctumSnapshot) bool {
	objective := crystal.Objective
	total, points := 0, 0
	switch crystal.Element {
	case "Earth":
		total, points = 8, 2
	case "Water":
		total, points = 2, 2
	case "Fire":
		total, points = 3, 3
	case "Air":
		total, points = 4, 4
	}
	if objective == nil || objective.Total != total || len(objective.Points) != points || objective.Current < 0 || objective.Current > total || objective.Complete != (objective.Current == total) ||
		math.IsNaN(objective.Channel) || math.IsInf(objective.Channel, 0) || objective.Channel < 0 || objective.Channel > 8 || len(objective.Title) > 256 || len(objective.Hint) > 1024 {
		return false
	}
	for _, point := range objective.Points {
		if math.IsNaN(point.X) || math.IsNaN(point.Z) || math.IsNaN(point.Radius) || math.IsInf(point.Radius, 0) || point.Radius <= 0 || point.Radius > 20 || len(point.Label) > 256 ||
			math.Hypot(point.X-crystal.X, point.Z-crystal.Z) > 40 || !p.dungeon.route.direct(dungeonPoint{crystal.X, crystal.Z}, dungeonPoint{point.X, point.Z}) {
			return false
		}
		switch point.State {
		case "active", "waiting", "complete", "boundary":
		default:
			return false
		}
	}
	return true
}

func (r *raidLoad) inVigil(index int) bool {
	crystal := r.members[index].crystal
	return crystal != nil && crystal.Stage == "repairing" && crystal.Wave > 0
}

// Use the live chamber markers and own positions, never an authored repair
// command or elapsed-time award. The actual worker decides progress and waves.
func (r *raidLoad) vigilMove(p *partyLoad, index int, me Entity, now time.Time, move func(float64, float64)) bool {
	m := &r.members[index]
	crystal := m.crystal
	objective := crystal.Objective
	if objective == nil || objective.Complete {
		return false
	}
	if m.ritualWave != crystal.Wave {
		m.ritualWave, m.waterReturning, m.pointSince = crystal.Wave, false, time.Time{}
	}
	switch crystal.Element {
	case "Earth":
		return false // Clear attackers, then ordinary idle combat returns to the ward.
	case "Water":
		if index != 3 {
			return false
		}
		pointIndex := 0
		if m.waterReturning {
			pointIndex = 1
		}
		point := objective.Points[pointIndex]
		if math.Hypot(me.X-point.X, me.Z-point.Z) <= point.Radius/2 {
			if m.pointSince.IsZero() {
				m.pointSince = now
			}
			if now.Sub(m.pointSince) >= 750*time.Millisecond {
				m.waterReturning, m.pointSince = !m.waterReturning, time.Time{}
			}
		} else {
			m.pointSince = time.Time{}
			move(point.X, point.Z)
		}
		return true
	case "Fire", "Air":
		selected := 3
		if crystal.Element == "Air" {
			selected = 3 - objective.Current%2
			// The normal own-player snapshot tells the previous bearer to let
			// someone else pass. An incidental activation must not deadlock.
			peer := r.members[selected].crystal
			if peer != nil && peer.Objective != nil && strings.HasPrefix(peer.Objective.Hint, "You passed the wind.") {
				selected = 5 - selected
			}
		}
		if index != selected {
			return false
		}
		point := objective.Points[objective.Current]
		move(point.X, point.Z)
		return true
	}
	return false
}

type raidLoadCounts struct {
	converted, prepared                  bool
	readyMembers, restored, minWaveViews uint64
}

func (p *partyLoad) raidCounts() raidLoadCounts {
	p.mu.Lock()
	defer p.mu.Unlock()
	var counts raidLoadCounts
	if p.raid == nil {
		return counts
	}
	counts.converted, counts.prepared = p.raid.converted, p.raid.prepared()
	for index, member := range p.raid.members {
		if member.readySent && member.readySeen && member.allReadySeen {
			counts.readyMembers++
		}
		if member.restored {
			counts.restored++
		}
		waves := uint64(bits.OnesCount8(member.wavesSeen))
		if index == 0 || waves < counts.minWaveViews {
			counts.minWaveViews = waves
		}
	}
	return counts
}
