package main

import (
	"encoding/json"
	"fmt"
	"math"
	"math/bits"
	"strconv"
	"strings"
	"time"

	"eidolon-server/internal/game"
)

type eventLoadMember struct {
	view                                                 *game.PublicEventView
	updated                                              time.Time
	waves                                                uint8
	present, complete, exitRequested, exited, recovering bool
}

// Shares partyLoad.mu, retaining one current view per member, not event history.
type eventLoad struct {
	selection, id, enemyPrefix string
	site                       game.PublicEventSite
	members                    [4]eventLoadMember
}

func validEventSelection(selection string) bool {
	if selection == "current" {
		return true
	}
	for _, site := range game.PublicEventSites() {
		if site.ID == selection {
			return true
		}
	}
	return false
}

func newEventParty(credentials []BotCredentials, selection string) *partyLoad {
	p := newPartyLoad(credentials, 0, 0)
	p.event = &eventLoad{selection: selection}
	if !validEventSelection(selection) {
		p.failAt(failureEventEnvelope)
	}
	return p
}

func validEventView(v *game.PublicEventView) bool {
	if v == nil || len(v.ID) > 64 || !strings.HasPrefix(v.ID, "disturbance-") {
		return false
	}
	slot, err := strconv.ParseInt(strings.TrimPrefix(v.ID, "disturbance-"), 10, 64)
	period := int64(game.PublicEventPeriod / time.Second)
	if err != nil || slot < 0 || slot > math.MaxInt64/period || v.ID != fmt.Sprintf("disturbance-%d", slot) {
		return false
	}
	sites := game.PublicEventSites()
	site := sites[int(slot%int64(len(sites)))]
	start := time.Unix(slot*period, 0).UTC()
	if v.Site.ID != site.ID || v.Site.Realm != site.Realm || v.Site.Level != site.Level || v.Site.X != site.X || v.Site.Z != site.Z ||
		!v.StartsAt.Equal(start.Add(time.Minute)) || !v.EndsAt.Equal(start.Add(8*time.Minute)) || !v.NextAt.Equal(start.Add(game.PublicEventPeriod)) ||
		v.Wave < 0 || v.Wave > 4 || v.Remaining < 0 || v.Remaining > 12 || v.Participants < 0 || v.Participants > 1024 || len(v.Upcoming) > 3 {
		return false
	}
	for _, value := range []float64{v.Charge, v.ChargeNeeded, v.RuneX, v.RuneZ, v.Radius, v.InnerRadius} {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return false
		}
	}
	if v.ChargeNeeded != 20 || v.Charge < 0 || v.Charge > v.ChargeNeeded {
		return false
	}
	switch v.Phase {
	case "announced":
		if v.Wave != 0 || v.Remaining != 0 {
			return false
		}
	case "defending":
		if v.Wave < 1 || v.Wave > 3 {
			return false
		}
	case "champion":
		if v.Wave != 4 || v.Remaining > 1 {
			return false
		}
	case "complete":
		if v.Wave != 4 || v.Remaining != 0 || v.CalmedUntil.IsZero() || !v.CalmedUntil.After(v.StartsAt) || v.CalmedUntil.After(v.EndsAt.Add(5*time.Minute)) {
			return false
		}
	case "expired":
		return v.Remaining == 0 // First boot after minute8 has no ward geometry.
	default:
		return false
	}
	radius, inner := 12.0, 0.0
	if site.ID == "tide" {
		radius = 7
	}
	if site.ID == "ember" {
		radius, inner = 22, 12
	}
	if v.Radius != radius || v.InnerRadius != inner || v.RuneZ != site.Z {
		return false
	}
	if site.ID == "tide" {
		return math.Abs(v.RuneX-site.X) == 10
	}
	return v.RuneX == site.X
}

func (e *eventLoad) receive(p *partyLoad, index int, message Message, now time.Time) bool {
	var view *game.PublicEventView
	if json.Unmarshal(message.Payload, &view) != nil || !validEventView(view) {
		p.failAt(failureEventEnvelope)
		return false
	}
	// Discovery text/upcoming windows do not prove this cohort's participation.
	// Keep only current counters/geometry and canonical, bounded site metadata.
	view.Upcoming = nil
	for _, site := range game.PublicEventSites() {
		if site.ID == view.Site.ID {
			view.Site = site
			break
		}
	}
	m := &e.members[index]
	if e.id != "" && view.ID != e.id {
		p.failAt(failureEventIdentity)
		return false
	}
	if m.view != nil && m.view.ID == view.ID && (view.Wave < m.view.Wave || m.complete && view.Phase != "complete" || view.Wave == m.view.Wave && view.Phase == "defending" && view.Charge < m.view.Charge) {
		p.failAt(failureEventOrder)
		return false
	}
	m.view, m.updated = view, now
	if e.id == "" {
		return true
	}
	if view.Phase == "expired" {
		p.failAt(failureEventExpired)
		return false
	}
	me := p.members[index].state
	if !p.formed() || me.InstanceID != "" || me.Health <= 0 || me.State == "DEAD" || math.Hypot(me.X-e.site.X, me.Z-e.site.Z) > 65 {
		return true
	}
	m.present = true
	if view.Wave > 0 && view.Phase != "complete" {
		m.waves |= 1 << (view.Wave - 1)
	}
	if view.Phase == "complete" {
		if m.waves != 15 {
			p.failAt(failureEventMissingWave)
			return false
		}
		m.complete = true
	}
	return true
}

func (e *eventLoad) observe(index int, me Entity) {
	m := &e.members[index]
	if me.Health <= 0 || me.State == "DEAD" {
		m.recovering = true
	}
	if e.id != "" && me.InstanceID == "" && me.Health > 0 && me.State != "DEAD" && math.Hypot(me.X-e.site.X, me.Z-e.site.Z) <= 65 {
		m.present = true
	}
	if m.exitRequested && me.InstanceID == "" && me.Health > 0 && me.State != "DEAD" && math.Hypot(me.X+1.25, me.Z-200) <= 2 {
		m.exited = true
	}
}

// Regroup through ordinary movement before deliberately charging the next wave.
// A returning member must still receive their own live, physically present view;
// another member's mask or a later completion never substitutes for that view.
func (e *eventLoad) waveReady(p *partyLoad, view *game.PublicEventView) bool {
	if view == nil || view.Phase != "defending" || view.Wave < 1 || view.Wave > 3 || e.id == "" || !p.formed() {
		return false
	}
	for i, member := range e.members {
		me := p.members[i].state
		if member.view == nil || member.view.ID != e.id || member.view.Wave != view.Wave ||
			member.waves&(1<<uint(view.Wave-1)) == 0 || member.recovering ||
			me.InstanceID != "" || me.Health <= 0 || me.State == "DEAD" ||
			math.Hypot(me.X-e.site.X, me.Z-e.site.Z) > 65 ||
			me.MaxHealth > 0 && float64(me.Health)/float64(me.MaxHealth) < .25 ||
			me.MaxMana > 0 && float64(me.Mana)/float64(me.MaxMana) < .15 {
			return false
		}
	}
	return true
}

// Only this member's current state can establish that the ward is contested.
// Remaining alone includes enemies outside it, where charging is still possible.
func (e *eventLoad) wardContested(view *game.PublicEventView, state map[string]Entity) bool {
	if view.Remaining == 0 {
		return false
	}
	prefix := fmt.Sprintf("%s%d-", e.enemyPrefix, view.Wave)
	for _, enemy := range state {
		if enemy.Type != "Enemy" || enemy.InstanceID != "" || enemy.Health <= 0 || enemy.State == "DEAD" || !strings.HasPrefix(enemy.ID, prefix) {
			continue
		}
		distance := math.Hypot(enemy.X-view.RuneX, enemy.Z-view.RuneZ)
		if distance <= view.Radius && distance >= view.InnerRadius {
			return true
		}
	}
	return false
}

func (e *eventLoad) step(p *partyLoad, index int, me Entity, state map[string]Entity, now time.Time, timeout time.Duration, request func(string, interface{}) error, move func(float64, float64)) bool {
	m := &e.members[index]
	if m.exited {
		return false
	}
	if m.view == nil || now.Sub(m.updated) >= timeout {
		if now.Sub(p.members[index].admittedAt) >= timeout {
			p.failAt(failureEventViewTimeout)
		}
		return false
	}
	if e.id == "" {
		view := e.members[0].view
		if index != 0 || view == nil || e.selection != "current" && e.selection != view.Site.ID || view.Phase != "announced" && (view.Phase != "defending" || view.Wave != 1) {
			return false
		}
		for i, member := range e.members {
			if member.view == nil || member.view.ID != view.ID {
				return false
			}
			if p.members[i].state.Level < view.Site.Level {
				p.failAt(failureEventLevel)
				return false
			}
		}
		e.id, e.site = view.ID, view.Site
		e.enemyPrefix = "world-event-" + strings.TrimPrefix(e.id, "disturbance-") + "-"
		p.anchorX, p.anchorZ = e.site.X, e.site.Z
		p.target = Entity{}
	}
	allComplete := true
	for _, member := range e.members {
		allComplete = allComplete && member.complete
	}
	if allComplete {
		if !m.exitRequested {
			m.exitRequested = true
			if request("recall", nil) != nil {
				p.failAt(failureEventRequest)
			}
		}
		return false
	}
	if m.exitRequested {
		return false
	}
	if m.recovering {
		if math.Hypot(me.X+1.25, me.Z-200) > 2 || me.Health <= 0 || me.MaxHealth <= 0 || me.MaxMana <= 0 || float64(me.Health)/float64(me.MaxHealth) < .9 || float64(me.Mana)/float64(me.MaxMana) < .9 {
			return false
		}
		m.recovering = false
	}
	if me.InstanceID != "" {
		p.failAt(failureForeignInstance)
		return false
	}
	if me.MaxHealth > 0 && float64(me.Health)/float64(me.MaxHealth) < .25 || me.MaxMana > 0 && float64(me.Mana)/float64(me.MaxMana) < .15 {
		m.recovering = true
		if request("recall", nil) != nil {
			p.failAt(failureEventRequest)
		}
		return false
	}
	if math.Hypot(me.X-e.site.X, me.Z-e.site.Z) > 40 {
		move(e.site.X, e.site.Z)
		return false
	}
	view := m.view
	distance := math.Hypot(me.X-view.RuneX, me.Z-view.RuneZ)
	if view.Phase == "defending" && !e.waveReady(p, view) &&
		(view.Remaining == 0 || distance <= view.Radius && distance >= view.InnerRadius && !e.wardContested(view, state)) {
		// Without this, even the tank's ordinary no-target regroup at the site
		// center charges a cleared ward while an ally is away. Stay close enough
		// to defend. A current live enemy inside the ward already prevents
		// charging, so present actors can keep attacking/healing there too.
		move(view.RuneX+view.Radius+6, view.RuneZ)
		return false
	}
	// Keep live members fighting/healing while an ally returns from town.
	// Each member's own participation/completion gates remain unchanged.
	return true
}

func (e *eventLoad) combatLeader(p *partyLoad, index int) bool {
	for i, member := range p.members {
		me := member.state
		if me.Health > 0 && me.State != "DEAD" && me.InstanceID == "" && math.Hypot(me.X-e.site.X, me.Z-e.site.Z) <= 40 {
			return i == index
		}
	}
	return false
}

func (e *eventLoad) wardMove(p *partyLoad, index int, me Entity, now time.Time, move func(float64, float64)) bool {
	view := e.members[index].view
	if index != 3 || view == nil || view.Phase != "defending" || e.members[index].complete || !e.waveReady(p, view) {
		return false
	}
	if p.members[index].damage+p.members[index].heals == 0 || view.Remaining > 0 && e.combatLeader(p, index) {
		return false // Fight first; a lone ward-holder must defend, not watch attackers.
	}
	x, z := view.RuneX, view.RuneZ
	if view.Site.ID == "ember" {
		x += (view.InnerRadius + view.Radius) / 2
	}
	if view.Site.ID == "gale" {
		angle := float64(now.UnixMilli()%12000) / 12000 * 2 * math.Pi
		x += math.Cos(angle) * 6
		z += math.Sin(angle) * 6
	}
	move(x, z)
	return true
}

type eventLoadCounts struct {
	selected                                bool
	present, complete, exited, minWaveViews uint64
}

func (p *partyLoad) eventCounts() eventLoadCounts {
	p.mu.Lock()
	defer p.mu.Unlock()
	var counts eventLoadCounts
	if p.event == nil {
		return counts
	}
	counts.selected = p.event.id != ""
	for i, member := range p.event.members {
		if member.present {
			counts.present++
		}
		if member.complete {
			counts.complete++
		}
		if member.exited {
			counts.exited++
		}
		waves := uint64(bits.OnesCount8(member.waves))
		if i == 0 || waves < counts.minWaveViews {
			counts.minWaveViews = waves
		}
	}
	return counts
}
