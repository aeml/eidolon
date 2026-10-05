package main

import (
	"encoding/json"
	"math"
	"strings"
	"sync"
	"time"
)

var partyLoadClasses = [4]string{"Fighter", "Cleric", "Rogue", "Wizard"}

type partyLoadMember struct {
	username, id                             string
	state                                    Entity
	admitted, confirmed, responded           bool
	invitation                               string
	admittedAt, abilitySent                  time.Time
	pendingSkill                             string
	readyAt                                  map[string]time.Time
	changed                                  chan struct{}
	damage, heals, casts, denials, xpUpdates uint64
	offenseTargetID, offenseScene            string
}

// One latest successfully written offensive target per member, not a history.
// A leader changing its target must not erase an in-flight owned hit. This
// remembers a request, not damage or acceptance; only a real positive own
// damage notification can contribute an impact.
func (m *partyLoadMember) rememberOffense(me, target Entity) {
	if me.ID == m.id && me.Type == "Player" && target.ID != "" && target.Type == "Enemy" &&
		target.Health > 0 && target.State != "DEAD" && target.InstanceID == me.InstanceID {
		m.offenseTargetID, m.offenseScene = target.ID, me.InstanceID
	}
}

// Fixed consenting test accounts, one pending invite/cast per participant.
// No account/party/target identifiers or actor history enter final evidence.
type partyLoad struct {
	mu               sync.Mutex
	members          []partyLoadMember
	joined           []bool
	partyID          string
	anchorX, anchorZ float64
	inviteIndex      int
	inviteAt         time.Time
	target           Entity
	deaths           uint64
	failed           bool
	failureStage     loadFailureStage
	dungeon          *dungeonLoad
	raid             *raidLoad
	event            *eventLoad
}

type partyLoadCounts struct {
	formed                                                                bool
	failed                                                                bool
	members, minImpacts, damage, heals, casts, denials, xpUpdates, deaths uint64
}

func newPartyLoad(credentials []BotCredentials, x, z float64) *partyLoad {
	return newPartyCohort(credentials, x, z, 4, 4)
}

func newPartyCohort(credentials []BotCredentials, x, z float64, minimum, maximum int) *partyLoad {
	p := &partyLoad{anchorX: x, anchorZ: z, inviteIndex: -1}
	if minimum < 4 || maximum > 10 || minimum > maximum || len(credentials) < minimum || len(credentials) > maximum || math.IsNaN(x) || math.IsNaN(z) || math.IsInf(x, 0) || math.IsInf(z, 0) || math.Abs(x) > math.MaxFloat32 || math.Abs(z) > math.MaxFloat32 {
		p.failed = true
		return p
	}
	p.members = make([]partyLoadMember, len(credentials))
	p.joined = make([]bool, len(credentials))
	for i, credential := range credentials {
		if credential.Username == "" || len(credential.Username) > 128 {
			p.failed = true
		}
		for j := 0; j < i; j++ {
			if credentials[j].Username == credential.Username {
				p.failed = true
			}
		}
		p.members[i] = partyLoadMember{username: credential.Username, id: "player-" + credential.Username, readyAt: map[string]time.Time{}, changed: make(chan struct{}, 1)}
	}
	return p
}

func (p *partyLoad) reject() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.failed = true
	for i := range p.members {
		p.signal(i)
	}
}

func (p *partyLoad) signal(index int) {
	select {
	case p.members[index].changed <- struct{}{}:
	default:
	}
}

func (p *partyLoad) awaitCast(index int, readerDone <-chan struct{}, timeout time.Duration) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		p.mu.Lock()
		pending := !p.failed && p.members[index].pendingSkill != ""
		p.mu.Unlock()
		if !pending {
			return
		}
		select {
		case <-p.members[index].changed:
		case <-readerDone:
			p.reject()
			return
		case <-timer.C:
			p.reject()
			return
		}
	}
}

func (p *partyLoad) state(index int, me Entity, now time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	m := &p.members[index]
	if me.Type != "Player" || me.ID != m.id || me.SubType != partyLoadClasses[index%4] || me.Name == "" || len(me.Name) > 128 || me.Experience < 0 || me.Level < 1 || me.Level > 100 || me.MaxHealth <= 0 || len(me.UnlockedSkills) > 100 || p.raid != nil && me.Level < p.raid.level {
		p.failed = true
		return
	}
	for _, value := range []float64{me.X, me.Y, me.Z} {
		if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > math.MaxFloat32 {
			p.failed = true
			return
		}
	}
	if !m.admitted {
		if me.PartyID != "" || me.InstanceID != "" {
			p.failed = true
			return
		}
		m.admitted, m.admittedAt = true, now
	} else if me.Level > m.state.Level || me.Level == m.state.Level && me.Experience > m.state.Experience {
		m.xpUpdates++ // Observed progression, not attribution to a particular kill.
	}
	if m.state.InstanceID != me.InstanceID {
		m.offenseTargetID, m.offenseScene = "", ""
	}
	m.state = me
	if p.event != nil {
		p.event.observe(index, me)
	}
	if p.raid != nil && me.InstanceID == "" {
		p.raid.members[index].waterReturning = false
		p.raid.members[index].pointSince = time.Time{}
	}
	if p.dungeon != nil {
		p.dungeon.observe(p, index, me)
	}
}

func (p *partyLoad) receive(index int, message Message, now time.Time) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	defer p.signal(index)
	m := &p.members[index]
	if p.raid != nil && message.Type == "raid_phase" {
		return p.raid.receivePhase(p, index, message)
	}
	if p.event != nil && message.Type == "public_event" {
		return p.event.receive(p, index, message, now)
	}
	if p.raid != nil && message.Type == "chat" {
		return p.raid.receiveConversion(p, index, message)
	}
	if p.dungeon != nil && (message.Type == "get_dungeon_status" || message.Type == "enter_instance" || message.Type == "dungeon_room_state") {
		return p.dungeon.receive(p, index, message, now)
	}
	switch message.Type {
	case "party_request":
		var invite struct{ TargetName, InvitationID, Context string }
		if json.Unmarshal(message.Payload, &invite) != nil || index == 0 || invite.TargetName != p.members[0].username || invite.Context != "" || len(invite.InvitationID) < 1 || len(invite.InvitationID) > 128 {
			p.failed = true
			return false
		}
		if m.invitation != "" && m.invitation != invite.InvitationID {
			p.failed = true
			return false
		}
		m.invitation = invite.InvitationID
	case "party_update":
		var view partyLoadView
		if json.Unmarshal(message.Payload, &view) != nil || view.PartyID == "" || len(view.PartyID) > 256 || view.LeaderID != p.members[0].id || len(view.Members) < 1 || len(view.Members) > len(p.members) || p.partyID != "" && view.PartyID != p.partyID {
			p.failed = true
			return false
		}
		seen := make([]bool, len(p.members))
		for _, member := range view.Members {
			found := false
			for i := range p.members {
				if member.ID == p.members[i].id {
					if seen[i] || member.Class != partyLoadClasses[i%4] {
						p.failed = true
						return false
					}
					seen[i], found = true, true
				}
			}
			if !found {
				p.failed = true
				return false
			}
		}
		if !seen[index] || !seen[0] {
			p.failed = true
			return false
		}
		p.partyID = view.PartyID
		for i, present := range seen {
			p.joined[i] = p.joined[i] || present
		}
		m.confirmed = len(view.Members) == len(p.members)
		if p.inviteIndex >= 0 && seen[p.inviteIndex] {
			p.inviteIndex = -1
		}
		if p.raid != nil && !p.raid.receiveRoster(p, index, view) {
			return false
		}
	case "ability_result":
		var result struct {
			SkillName         string
			Accepted          *bool
			CooldownRemaining float64
		}
		if json.Unmarshal(message.Payload, &result) != nil || result.Accepted == nil || m.pendingSkill == "" || result.SkillName != m.pendingSkill || math.IsNaN(result.CooldownRemaining) || math.IsInf(result.CooldownRemaining, 0) || result.CooldownRemaining < 0 || result.CooldownRemaining > 86400 {
			p.failed = true
			return false
		}
		minimumWait := .5
		if *result.Accepted {
			m.casts++
		} else {
			m.denials++
			minimumWait = 3
		}
		m.readyAt[m.pendingSkill] = now.Add(time.Duration(math.Max(minimumWait, result.CooldownRemaining) * float64(time.Second)))
		m.pendingSkill = ""
	case "damage", "heal":
		var event struct {
			SourceID, TargetID, InstanceID string
			Amount                         int
		}
		if json.Unmarshal(message.Payload, &event) != nil {
			p.failed = true
			return false
		}
		if event.SourceID != m.id || event.Amount <= 0 || event.InstanceID != m.state.InstanceID {
			return true
		}
		currentTarget := p.target.ID != "" && event.TargetID == p.target.ID
		ownWrittenTarget := m.offenseTargetID != "" && event.TargetID == m.offenseTargetID && event.InstanceID == m.offenseScene
		if message.Type == "damage" && (currentTarget || ownWrittenTarget) {
			m.damage++
		}
		if message.Type == "heal" {
			for _, member := range p.members {
				if event.TargetID == member.id {
					m.heals++
					break
				}
			}
		}
	default:
		return false
	}
	return true
}

func (p *partyLoad) formed() bool {
	if len(p.members) == 0 {
		return false
	}
	for _, m := range p.members {
		if !m.confirmed {
			return false
		}
	}
	return true
}

func (p *partyLoad) counts() partyLoadCounts {
	p.mu.Lock()
	defer p.mu.Unlock()
	c := partyLoadCounts{formed: p.formed(), failed: p.failed, deaths: p.deaths}
	for i, m := range p.members {
		if m.confirmed {
			c.members++
		}
		impacts := m.damage + m.heals
		if i == 0 || impacts < c.minImpacts {
			c.minImpacts = impacts
		}
		c.damage += m.damage
		c.heals += m.heals
		c.casts += m.casts
		c.denials += m.denials
		c.xpUpdates += m.xpUpdates
	}
	return c
}

func (p *partyLoad) step(index int, me Entity, state map[string]Entity, now time.Time, timeout time.Duration, request func(string, interface{}) error, move func(float64, float64)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.failed {
		return
	}
	m := &p.members[index]
	issue := func(kind string, payload interface{}) bool {
		if request(kind, payload) != nil {
			p.failed = true
			return false
		}
		return true
	}
	if !p.formed() {
		if m.admitted && now.Sub(m.admittedAt) >= time.Duration(len(p.members))*timeout {
			p.failed = true
			return
		}
		for _, member := range p.members {
			if !member.admitted {
				return
			}
		}
		if p.inviteIndex >= 0 && now.Sub(p.inviteAt) >= timeout {
			p.failed = true
			return
		}
		if p.raid != nil && index == 0 && p.inviteIndex < 0 && p.partyID != "" && !p.raid.convert(p, index, now, timeout, request) {
			return
		}
		if index == 0 && p.inviteIndex < 0 {
			for i := 1; i < len(p.members); i++ {
				if p.joined[i] {
					continue
				}
				p.inviteIndex, p.inviteAt = i, now
				issue("party_invite", map[string]string{"targetName": p.members[i].state.Name})
				break
			}
		}
		if index != 0 && m.invitation != "" && !m.responded {
			m.responded = true
			issue("party_response", map[string]interface{}{"inviterName": p.members[0].username, "invitationId": m.invitation, "accepted": true})
		}
		return
	}
	if p.raid != nil && (!p.raid.prepare(p, index, now, timeout, request) || p.dungeon == nil) {
		return // Preparation alone never claims raid combat or crystal restoration.
	}
	if m.pendingSkill != "" {
		if now.Sub(m.abilitySent) >= timeout {
			p.failAt(failureCastTimeout)
		}
		return // Never repeat an unacknowledged cast.
	}
	if p.dungeon != nil {
		if !p.dungeon.step(p, index, me, now, timeout, request) || p.failed {
			if !p.failed {
				p.healWaitingDungeon(index, me, now, request)
			}
			return
		}
		originalMove := move
		move = func(x, z float64) {
			point, valid := p.dungeon.route.next(dungeonPoint{me.X, me.Z}, dungeonPoint{x, z})
			if !valid {
				p.failed = true
				return
			}
			originalMove(point.x, point.z)
		}
	} else if me.InstanceID != "" {
		p.failed = true
		return // The original overworld profile does not silently enter instances.
	}
	if p.event != nil && (!p.event.step(p, index, me, now, timeout, request, move) || p.failed) {
		return
	}
	leader := p.members[0].state
	vigil := p.raid != nil && p.raid.inVigil(index) || p.event != nil
	if p.event != nil && p.event.wardMove(p, index, me, now, move) {
		return
	}
	if p.raid != nil && vigil && p.raid.vigilMove(p, index, me, now, move) {
		return
	}
	if !vigil && index != 0 && math.Hypot(me.X-leader.X, me.Z-leader.Z) > 12 {
		move(leader.X, leader.Z)
		return
	}
	targetLeader := index == 0
	if p.event != nil {
		targetLeader = p.event.combatLeader(p, index)
	}
	if targetLeader {
		if p.target.ID != "" {
			if fresh, found := state[p.target.ID]; found && fresh.Type == "Enemy" && fresh.InstanceID == me.InstanceID && (fresh.State == "DEAD" || fresh.Health <= 0) {
				p.deaths++
			}
			fresh, found := state[p.target.ID]
			if !found || fresh.Type != "Enemy" || fresh.InstanceID != me.InstanceID || fresh.Health <= 0 || fresh.State == "DEAD" {
				p.target = Entity{}
			} else {
				p.target = fresh
			}
		}
		if p.target.ID == "" {
			nearest := 30.0
			if p.event != nil {
				nearest = 65
			}
			if p.dungeon != nil {
				room := p.dungeon.layout.Rooms[p.dungeon.objective]
				nearest = math.Hypot(room.Width/2, room.Height/2) + 20
			}
			for _, enemy := range state {
				if enemy.Type != "Enemy" || enemy.Health <= 0 || enemy.State == "DEAD" || enemy.InstanceID != me.InstanceID || enemy.ID == "" || p.event != nil && !strings.HasPrefix(enemy.ID, p.event.enemyPrefix) {
					continue
				}
				distance := math.Hypot(enemy.X-p.anchorX, enemy.Z-p.anchorZ)
				if distance < nearest || distance == nearest && enemy.ID < p.target.ID {
					nearest, p.target = distance, enemy
				}
			}
		}
		for _, member := range p.members {
			if p.event == nil && member.state.Health <= 0 || !vigil && math.Hypot(member.state.X-me.X, member.state.Z-me.Z) > 15 {
				return
			}
		}
	}
	if p.target.ID == "" {
		if targetLeader {
			move(p.anchorX, p.anchorZ)
		}
		return
	}
	target, skill, distance := p.target, "", math.Hypot(me.X-p.target.X, me.Z-p.target.Z)
	if index%4 == 1 {
		for _, unlocked := range me.UnlockedSkills {
			if unlocked != "Healing Light" {
				continue
			}
			for _, member := range p.members {
				ally := member.state
				if ally.Health > 0 && ally.MaxHealth > 0 && float64(ally.Health)/float64(ally.MaxHealth) < .75 && ally.InstanceID == me.InstanceID && math.Hypot(me.X-ally.X, me.Z-ally.Z) <= 14 {
					target, skill = ally, "Healing Light"
					break
				}
			}
		}
	}
	if skill == "" {
		skill = [4]string{"Charge", "Spirit Guardians", "Piercing Throw", "Fireball"}[index%4]
	}
	if p.dungeon != nil && !p.dungeon.route.direct(dungeonPoint{me.X, me.Z}, dungeonPoint{target.X, target.Z}) {
		move(target.X, target.Z)
		return // Neither enemy attacks nor targeted heals cut a missing floor.
	}
	if !now.Before(m.readyAt[skill]) && (skill == "Healing Light" || distance <= 12) {
		m.pendingSkill, m.abilitySent = skill, now
		if issue("ability", map[string]interface{}{"skillName": skill, "targetId": target.ID, "targetX": target.X, "targetZ": target.Z}) {
			m.rememberOffense(me, target)
		}
		return
	}
	attackRange := 3.0
	if index%4 == 3 {
		attackRange = 12
	}
	if distance <= attackRange {
		if issue("attack", map[string]string{"targetId": p.target.ID}) {
			m.rememberOffense(me, p.target)
		}
	} else {
		move(p.target.X, p.target.Z)
	}
}

// Caller holds p.mu. The encounter still waits for every member; a living
// Cleric already inside it can support present allies during that pause.
// No attacks, movement/progression, revival, forced bars or synthetic credit.
func (p *partyLoad) healWaitingDungeon(index int, me Entity, now time.Time, request func(string, interface{}) error) bool {
	if p.failed || p.dungeon == nil || p.dungeon.route == nil || index < 0 || index >= len(p.members) ||
		index%4 != 1 || me.SubType != "Cleric" || me.Type != "Player" || me.ID != p.members[index].id ||
		me.InstanceID == "" || me.InstanceID != p.dungeon.instance || me.Health <= 0 || me.State == "DEAD" || me.Mana <= 0 {
		return false
	}
	m, run := &p.members[index], &p.dungeon.members[index]
	if !run.entered || !run.scene || run.pending != "" || run.recovering || run.dead || run.exited || run.exitRequested ||
		m.pendingSkill != "" || now.Before(m.readyAt["Healing Light"]) {
		return false
	}
	unlocked := false
	for _, skill := range me.UnlockedSkills {
		unlocked = unlocked || skill == "Healing Light"
	}
	if !unlocked {
		return false
	}
	var target Entity
	lowest := .75
	for _, member := range p.members {
		ally := member.state
		if ally.Type != "Player" || ally.InstanceID != me.InstanceID || ally.Health <= 0 || ally.MaxHealth <= 0 || ally.State == "DEAD" ||
			math.Hypot(me.X-ally.X, me.Z-ally.Z) > 14 || !p.dungeon.route.direct(dungeonPoint{me.X, me.Z}, dungeonPoint{ally.X, ally.Z}) {
			continue
		}
		fraction := float64(ally.Health) / float64(ally.MaxHealth)
		if fraction < lowest {
			target, lowest = ally, fraction
		}
	}
	if target.ID == "" {
		return false
	}
	m.pendingSkill, m.abilitySent = "Healing Light", now
	if request("ability", map[string]interface{}{"skillName": "Healing Light", "targetId": target.ID, "targetX": target.X, "targetZ": target.Z}) != nil {
		p.failAt(failureDungeonRequest)
	}
	return true
}
