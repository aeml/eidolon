package main

import (
	"encoding/json"
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

func newRaidParty(credentials []BotCredentials, kind string) *partyLoad {
	p := newPartyCohort(credentials, 0, 0, 5, 10)
	definition, valid := game.ElementalRaidDefinitionForType(kind)
	if !valid {
		p.failed = true
	}
	p.raid = &raidLoad{kind: kind, level: definition.RequiredLevel, members: make([]raidLoadMember, len(p.members))}
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
