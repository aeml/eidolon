package main

import (
	"errors"
	"math"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func eventView(siteIndex, wave int) game.PublicEventView {
	slot := int64(12 + siteIndex)
	start := time.Unix(slot*600, 0).UTC()
	site := game.PublicEventSites()[siteIndex]
	v := game.PublicEventView{ID: "disturbance-" + []string{"12", "13", "14", "15"}[siteIndex], Site: site, StartsAt: start.Add(time.Minute), EndsAt: start.Add(8 * time.Minute), NextAt: start.Add(10 * time.Minute), Wave: wave, ChargeNeeded: 20, RuneX: site.X, RuneZ: site.Z, Radius: 12, Participants: 4}
	if site.ID == "tide" {
		v.RuneX += 10
		v.Radius = 7
	}
	if site.ID == "ember" {
		v.Radius, v.InnerRadius = 22, 12
	}
	switch wave {
	case 0:
		v.Phase = "announced"
	case 4:
		v.Phase, v.Remaining = "champion", 1
	default:
		v.Phase, v.Remaining = "defending", 12
	}
	return v
}

func eventFixture(t *testing.T, siteIndex int) (*partyLoad, time.Time) {
	t.Helper()
	_, credentials := partyFixture()
	p := newEventParty(credentials, "current")
	v := eventView(siteIndex, 0)
	now := v.StartsAt
	for i := range p.members {
		p.state(i, Entity{ID: p.members[i].id, Name: "Synthetic participant", Type: "Player", SubType: partyLoadClasses[i], Level: v.Site.Level, Health: 100, MaxHealth: 100, Mana: 100, MaxMana: 100, X: v.Site.X, Z: v.Site.Z}, now)
		p.receive(i, partyRoster(p, 4), now)
		if !p.receive(i, partyMessage("public_event", v), now) {
			t.Fatal("valid announcement refused")
		}
	}
	if !p.event.step(p, 0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("selection authored event action"); return nil }, func(float64, float64) { t.Fatal("nearby selection teleported") }) || p.failed {
		t.Fatal("ready cohort did not select normal occurrence")
	}
	return p, now
}

func TestEventViewAcceptsActualNormalEmptySchedules(t *testing.T) {
	w := game.NewWorld(nil)
	for site := 0; site < 4; site++ {
		start := eventView(site, 0).StartsAt.Add(-time.Minute)
		w.UpdatePublicEvent(start)
		if !validEventView(w.PublicEventSnapshot()) {
			t.Fatal("actual normal announcement rejected", site)
		}
		w.UpdatePublicEvent(start.Add(9 * time.Minute))
		if !validEventView(w.PublicEventSnapshot()) {
			t.Fatal("actual empty expiration rejected", site)
		}
	}
}

func TestEventLoadNeedsEveryOwnPresentWaveAndCompletion(t *testing.T) {
	p, now := eventFixture(t, 0)
	for wave := 1; wave <= 4; wave++ {
		for i := range p.members {
			p.receive(i, partyMessage("public_event", eventView(0, wave)), now)
		}
	}
	if p.eventCounts().complete != 0 || p.eventCounts().minWaveViews != 4 {
		t.Fatal("champion/wave views substituted for completion")
	}
	complete := eventView(0, 4)
	complete.Phase, complete.Remaining, complete.CalmedUntil = "complete", 0, now.Add(3*time.Minute)
	for i := 0; i < 3; i++ {
		p.receive(i, partyMessage("public_event", complete), now)
	}
	p.event.step(p, 0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("missing fourth own completion allowed exit"); return nil }, func(float64, float64) {})
	if p.failed || p.eventCounts().complete != 3 {
		t.Fatal("partial completion gates incorrect")
	}
	p.receive(3, partyMessage("public_event", complete), now)
	for i := range p.members {
		requests := 0
		request := func(kind string, _ interface{}) error {
			requests++
			if kind != "recall" {
				t.Fatal("not normal town return")
			}
			return nil
		}
		p.event.step(p, i, p.members[i].state, nil, now, time.Second, request, func(float64, float64) { t.Fatal("walked after completion") })
		p.event.step(p, i, p.members[i].state, nil, now, time.Second, request, func(float64, float64) {})
		if requests != 1 {
			t.Fatal("uncertain exit retried")
		}
		me := p.members[i].state
		me.X, me.Z = -1.25, 200
		p.state(i, me, now)
	}
	if p.failed || p.eventCounts().exited != 4 {
		t.Fatal("missing all-four fresh town exits")
	}
}

func TestEventLoadRefusesBadOrHistoricalEvidence(t *testing.T) {
	for _, scenario := range []string{"nil", "wrong-id", "wrong-site", "wrong-level", "wrong-start", "wrong-phase", "bad-wave", "bad-charge", "bad-rune", "bad-radius", "too-many-enemies", "premature-complete", "regressed-wave", "regressed-charge", "changed-occurrence", "expired", "under-level", "stale-view"} {
		t.Run(scenario, func(t *testing.T) {
			p, now := eventFixture(t, 0)
			v := eventView(0, 1)
			switch scenario {
			case "nil":
				p.receive(0, partyMessage("public_event", nil), now)
			case "under-level":
				p.event.id = ""
				me := p.members[3].state
				me.Level--
				p.state(3, me, now)
				p.event.step(p, 0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { return nil }, func(float64, float64) {})
			case "stale-view":
				p.event.step(p, 0, p.members[0].state, nil, now.Add(time.Second), time.Second, func(string, interface{}) error { return nil }, func(float64, float64) {})
			default:
				switch scenario {
				case "wrong-id":
					v.ID = "disturbance-+12"
				case "wrong-site":
					v.Site.ID = "gale"
				case "wrong-level":
					v.Site.Level = 1
				case "wrong-start":
					v.StartsAt = v.StartsAt.Add(time.Second)
				case "wrong-phase":
					v.Phase = "won"
				case "bad-wave":
					v.Wave = 5
				case "bad-charge":
					v.Charge = 21
				case "bad-rune":
					v.RuneX += 1
				case "bad-radius":
					v.Radius = 1
				case "too-many-enemies":
					v.Remaining = 13
				case "premature-complete":
					v = eventView(0, 4)
					v.Phase, v.Remaining, v.CalmedUntil = "complete", 0, now.Add(3*time.Minute)
				case "regressed-wave":
					p.receive(0, partyMessage("public_event", eventView(0, 2)), now)
				case "regressed-charge":
					charged := v
					charged.Charge = 10
					p.receive(0, partyMessage("public_event", charged), now)
				case "changed-occurrence":
					v = eventView(1, 1)
				case "expired":
					v.Phase, v.Remaining = "expired", 0
				}
				p.receive(0, partyMessage("public_event", v), now)
			}
			if !p.failed || p.eventCounts().complete != 0 || p.eventCounts().exited != 0 {
				t.Fatal("invalid/partial/historical proof accepted")
			}
			want := "event_envelope"
			switch scenario {
			case "premature-complete":
				want = "event_missing_wave"
			case "regressed-wave", "regressed-charge":
				want = "event_order"
			case "changed-occurrence":
				want = "event_identity"
			case "expired":
				want = "event_expired"
			case "under-level":
				want = "event_level"
			case "stale-view":
				want = "event_view_timeout"
			}
			p.failAt(failureCastTimeout)
			if p.failureCode() != want {
				t.Fatal("missing immutable event failure classification", p.failureCode(), want)
			}
		})
	}
}

func TestEventMissingOwnWaveMatchesPartialCompletionWithoutInventedCredit(t *testing.T) {
	p, now := eventFixture(t, 0)
	for wave := 1; wave <= 4; wave++ {
		for i := range p.members {
			me := p.members[i].state
			if i == 3 {
				me.X = p.event.site.X
				if wave == 4 {
					me.X += 66 // A valid global champion view while absent is not participation.
				}
				p.state(i, me, now)
			}
			if !p.receive(i, partyMessage("public_event", eventView(0, wave)), now) {
				t.Fatal("valid wave view was refused")
			}
		}
	}
	me := p.members[3].state
	me.X = p.event.site.X
	p.state(3, me, now)
	complete := eventView(0, 4)
	complete.Phase, complete.Remaining, complete.CalmedUntil = "complete", 0, now.Add(3*time.Minute)
	for i := range p.members {
		if got := p.receive(i, partyMessage("public_event", complete), now); got != (i < 3) {
			t.Fatal("own wave coverage was not enforced", i)
		}
	}
	counts := p.eventCounts()
	if counts.complete != 3 || counts.exited != 0 || counts.minWaveViews != 3 || p.failureCode() != "event_missing_wave" {
		t.Fatal("partial completion was misclassified or gained absent-wave credit", counts, p.failureCode())
	}
	p.rejectServer([]byte(`"private later error"`))
	if p.failureCode() != "event_missing_wave" {
		t.Fatal("cleanup replaced first missing-wave cause")
	}
}

func TestEventRequestFailureDoesNotRetryOrClaimTownExit(t *testing.T) {
	for _, completing := range []bool{false, true} {
		p, now := eventFixture(t, 0)
		me := p.members[0].state
		if completing {
			for i := range p.event.members {
				p.event.members[i].complete = true // Unit fixture, not earned production evidence.
			}
		} else {
			me.Mana = 10
			p.state(0, me, now)
		}
		requests := 0
		request := func(kind string, _ interface{}) error {
			requests++
			if kind != "recall" {
				t.Fatal("unexpected request", kind)
			}
			return errors.New("private transport detail")
		}
		for i := 0; i < 2; i++ {
			p.step(0, me, nil, now, time.Second, request, func(float64, float64) { t.Fatal("failed recall moved actor") })
		}
		if requests != 1 || p.failureCode() != "event_request" || p.eventCounts().exited != 0 {
			t.Fatal("failed recall retried or credited", requests, p.failureCode())
		}
	}
}

func TestEventLoadDoesNotAdoptAlreadyCompletedOrLateOccurrences(t *testing.T) {
	for _, phase := range []string{"complete", "champion", "defending"} {
		t.Run(phase, func(t *testing.T) {
			p, now := eventFixture(t, 0)
			p.event.id = ""
			v := eventView(0, 4)
			v.Phase = phase
			if phase == "complete" {
				v.Remaining, v.CalmedUntil = 0, now.Add(3*time.Minute)
			}
			if phase == "defending" {
				v.Wave, v.Remaining = 2, 12
			}
			for i := range p.members {
				if !p.receive(i, partyMessage("public_event", v), now) {
					t.Fatal("valid non-selected occurrence refused")
				}
			}
			p.event.step(p, 0, p.members[0].state, nil, now, time.Second, func(string, interface{}) error { t.Fatal("historical/late event authored action"); return nil }, func(float64, float64) { t.Fatal("adopted late event") })
			if p.failed || p.eventCounts().selected || p.eventCounts().complete != 0 {
				t.Fatal("already-completed/late occurrence adopted as fresh")
			}
		})
	}
}

func TestEventLoadIgnoresRemoteOrPrivateWavePresence(t *testing.T) {
	for _, remote := range []string{"far", "instance", "dead"} {
		t.Run(remote, func(t *testing.T) {
			p, now := eventFixture(t, 0)
			me := p.members[1].state
			switch remote {
			case "far":
				me.X += 66
			case "instance":
				me.InstanceID = "dungeon_other"
			case "dead":
				me.Health = 0
			}
			p.state(1, me, now)
			p.receive(1, partyMessage("public_event", eventView(0, 1)), now)
			if p.eventCounts().minWaveViews != 0 || p.event.members[1].waves != 0 {
				t.Fatal("global view counted as physical participation")
			}
		})
	}
}

func TestEventWardMovementAllFourFamiliesWithoutCredit(t *testing.T) {
	for site := 0; site < 4; site++ {
		p, now := eventFixture(t, site)
		for i := range p.members {
			p.receive(i, partyMessage("public_event", eventView(site, 1)), now)
		}
		p.members[3].damage = 1 // Declared unit evidence, not an actual earned hit.
		var x, z float64
		moves := 0
		move := func(a, b float64) { x, z = a, b; moves++ }
		if p.event.wardMove(p, 0, p.members[0].state, now, move) {
			t.Fatal("tank replaced by ward-only role")
		}
		if !p.event.wardMove(p, 3, p.members[3].state, now, move) || moves != 1 {
			t.Fatal("missing normal wizard ward movement")
		}
		v := p.event.members[3].view
		distance := math.Hypot(x-v.RuneX, z-v.RuneZ)
		if distance > v.Radius || distance < v.InnerRadius {
			t.Fatal("movement outside live ward/annulus")
		}
		if site == 3 {
			firstX, firstZ := x, z
			p.event.wardMove(p, 3, p.members[3].state, now.Add(time.Second), move)
			if math.Hypot(x-firstX, z-firstZ) < .5 {
				t.Fatal("gale participant not moving")
			}
		}
		if p.eventCounts().complete != 0 || v.Charge != 0 {
			t.Fatal("movement authored charge or completion")
		}
	}
}

func TestEventRecoveryPreservesBarsAndWaitsForTown(t *testing.T) {
	p, now := eventFixture(t, 0)
	for i := range p.members {
		p.receive(i, partyMessage("public_event", eventView(0, 1)), now)
	}
	me := p.members[0].state
	me.Mana = 10
	p.state(0, me, now)
	requests := 0
	request := func(kind string, _ interface{}) error {
		requests++
		if kind != "recall" {
			t.Fatal("recovery bypassed normal command")
		}
		return nil
	}
	p.event.step(p, 0, me, nil, now, time.Second, request, func(float64, float64) { t.Fatal("moved before recovery") })
	p.event.step(p, 0, me, nil, now, time.Second, request, func(float64, float64) { t.Fatal("left before actual town confirmation") })
	if requests != 1 || p.members[0].state.Mana != 10 {
		t.Fatal("recovery retried or granted mana")
	}
	me.X, me.Z = -1.25, 200
	p.state(0, me, now)
	p.event.step(p, 0, me, nil, now, time.Second, request, func(float64, float64) { t.Fatal("left town before actual regeneration") })
	me.Mana = 90
	p.state(0, me, now)
	moves := 0
	p.event.step(p, 0, me, nil, now, time.Second, request, func(float64, float64) { moves++ })
	if p.failed || moves != 1 || requests != 1 {
		t.Fatal("normal healed return unavailable")
	}
}

func TestEventLoadKeepsLiveCombatDuringAnotherMembersRecovery(t *testing.T) {
	for _, scenario := range []string{"cleric-away", "leader-dead", "leader-returning"} {
		t.Run(scenario, func(t *testing.T) {
			p, now := eventFixture(t, 0)
			index, missing := 0, 1
			if scenario != "cleric-away" {
				index, missing = 1, 0
			}
			me := p.members[missing].state
			if scenario == "cleric-away" {
				me.X, me.Z = -1.25, 200
			} else if scenario == "leader-dead" {
				me.Health, me.State = 0, "DEAD"
			} else {
				me.X += 50 // Still in event participation range, outside combat range.
			}
			p.state(missing, me, now)
			for i := range p.members {
				p.receive(i, partyMessage("public_event", eventView(0, 4)), now)
			}
			enemy := Entity{ID: p.event.enemyPrefix + "4-0", Type: "Enemy", Health: 100, X: p.event.site.X + 1, Z: p.event.site.Z}
			requests := 0
			p.step(index, p.members[index].state, map[string]Entity{enemy.ID: enemy}, now, time.Second,
				func(kind string, _ interface{}) error {
					if kind != "ability" && kind != "attack" {
						t.Fatal("not ordinary live combat", kind)
					}
					requests++
					return nil
				}, func(float64, float64) { t.Fatal("walked away from nearby enemy") })
			if p.failed || requests != 1 || p.target.ID != enemy.ID {
				t.Fatal("one recovering/dead member disabled the live cohort")
			}
			wantWaves := uint64(0)
			if scenario == "leader-returning" {
				wantWaves = 1 // Actual near-site wave view, not distant/dead credit.
			}
			if p.eventCounts().complete != 0 || p.eventCounts().minWaveViews != wantWaves {
				t.Fatal("continuing combat fabricated absent member's participation")
			}
		})
	}
}

func TestEventWardRequiresOwnCombatAndDefendsAlone(t *testing.T) {
	p, now := eventFixture(t, 0)
	for i := range p.members {
		p.receive(i, partyMessage("public_event", eventView(0, 1)), now)
	}
	move := func(float64, float64) {}
	if p.event.wardMove(p, 3, p.members[3].state, now, move) {
		t.Fatal("wizard never got an opportunity for actual own combat")
	}
	p.members[3].damage = 1 // Unit fixture only; production waits for a real damage event.
	if !p.event.wardMove(p, 3, p.members[3].state, now, move) {
		t.Fatal("combat-ready wizard did not resume live ward work")
	}
	for i := 0; i < 3; i++ {
		me := p.members[i].state
		me.X, me.Z = -1.25, 200
		p.state(i, me, now)
	}
	if p.event.wardMove(p, 3, p.members[3].state, now, move) || !p.event.combatLeader(p, 3) {
		t.Fatal("lone wizard held ward instead of selecting live attackers")
	}
	view := eventView(0, 1)
	view.Remaining = 0
	p.receive(3, partyMessage("public_event", view), now)
	if p.event.wardMove(p, 3, p.members[3].state, now, move) {
		t.Fatal("cleared ward advanced while allies were still returning")
	}
	if p.eventCounts().complete != 0 || p.eventCounts().minWaveViews != 1 {
		t.Fatal("role recovery fabricated later participation/completion")
	}
}
