package main

import (
	"math"
	"testing"
	"time"
)

func eventMissingSecondWaveFixture(t *testing.T, siteIndex, remaining int) (*partyLoad, time.Time) {
	t.Helper()
	p, now := eventFixture(t, siteIndex)
	for i := range p.members {
		if !p.receive(i, partyMessage("public_event", eventView(siteIndex, 1)), now) {
			t.Fatal("first present wave refused")
		}
	}
	away := p.members[1].state
	away.X, away.Z, away.Mana = -1.25, 200, 10
	p.state(1, away, now)
	p.event.members[1].recovering = true
	view := eventView(siteIndex, 2)
	view.Remaining = remaining
	for i := range p.members {
		if !p.receive(i, partyMessage("public_event", view), now) {
			t.Fatal("second wave refused")
		}
	}
	p.members[3].damage = 1 // Unit fixture; native client requires an actual hit.
	return p, now
}

func TestEventWardWaitsForEachMembersCurrentWave(t *testing.T) {
	p, now := eventMissingSecondWaveFixture(t, 0, 4)
	if p.event.wardMove(p, 3, p.members[3].state, now, func(float64, float64) {
		t.Fatal("wizard charged the next wave while an ally was away")
	}) {
		t.Fatal("ward holding did not wait for the returning party member")
	}
	if p.event.members[1].waves != 1 || p.eventCounts().complete != 0 {
		t.Fatal("waiting invented absent participation or completion")
	}
}

func TestEventClearedWaveStagesOutsideWardUntilRegrouped(t *testing.T) {
	for siteIndex := 0; siteIndex < 4; siteIndex++ {
		t.Run(eventView(siteIndex, 0).Site.ID, func(t *testing.T) {
			testEventClearedWaveStagesOutsideWardUntilRegrouped(t, siteIndex)
		})
	}
}

func testEventClearedWaveStagesOutsideWardUntilRegrouped(t *testing.T, siteIndex int) {
	p, now := eventMissingSecondWaveFixture(t, siteIndex, 0)
	for _, index := range []int{0, 2, 3} {
		moves := 0
		p.step(index, p.members[index].state, nil, now, time.Second,
			func(string, interface{}) error { t.Fatal("staging authored a command"); return nil },
			func(x, z float64) {
				moves++
				view := p.event.members[index].view
				if math.Hypot(x-view.RuneX, z-view.RuneZ) <= view.Radius || math.Hypot(x-p.event.site.X, z-p.event.site.Z) > 40 {
					t.Fatal("staging remained in the ward or left combat range")
				}
			})
		if moves != 1 {
			t.Fatal("cleared-wave actor did not stage for the returning member")
		}
	}
	if p.failed || p.event.members[1].waves != 1 || p.eventCounts().complete != 0 {
		t.Fatal("regrouping altered the original coverage gates")
	}
}

func TestEventRegroupResumesOnlyAfterReturningMembersOwnPresentView(t *testing.T) {
	p, now := eventMissingSecondWaveFixture(t, 0, 0)
	returning := p.members[1].state
	returning.Mana = 90
	p.state(1, returning, now)
	moves := 0
	p.step(1, returning, nil, now, time.Second,
		func(string, interface{}) error { t.Fatal("healed return issued another recovery"); return nil },
		func(float64, float64) { moves++ })
	if moves != 1 || p.event.members[1].recovering {
		t.Fatal("normal town recovery did not resume the return walk")
	}
	returning.X, returning.Z = p.event.site.X, p.event.site.Z
	p.state(1, returning, now)
	if p.event.waveReady(p, p.event.members[3].view) || p.event.members[1].waves != 1 {
		t.Fatal("return position borrowed an earlier distant wave view")
	}
	view := eventView(0, 2)
	view.Remaining = 0
	if !p.receive(1, partyMessage("public_event", view), now) || !p.event.waveReady(p, &view) {
		t.Fatal("fresh own physically present wave did not release regrouping")
	}
	moves = 0
	if !p.event.wardMove(p, 3, p.members[3].state, now, func(x, z float64) {
		moves++
		if x != view.RuneX || z != view.RuneZ {
			t.Fatal("resumed ward used an invented destination")
		}
	}) || moves != 1 || p.failed || p.eventCounts().minWaveViews != 2 || p.eventCounts().complete != 0 {
		t.Fatal("regrouping failed to resume or invented later completion")
	}
}

func TestEventRegroupDoesNotStopLiveCombatOutsideTheWard(t *testing.T) {
	p, now := eventMissingSecondWaveFixture(t, 0, 4)
	me := p.members[0].state
	me.X += 24
	p.state(0, me, now)
	enemy := Entity{ID: p.event.enemyPrefix + "2-0", Type: "Enemy", Health: 100, X: me.X + 1, Z: me.Z}
	requests := 0
	p.step(0, me, map[string]Entity{enemy.ID: enemy}, now, time.Second,
		func(kind string, _ interface{}) error {
			if kind != "attack" && kind != "ability" {
				t.Fatal("regrouping bypassed ordinary combat")
			}
			requests++
			return nil
		}, func(float64, float64) { t.Fatal("nearby live attacker ignored") })
	if requests != 1 || p.failed || p.event.members[1].waves != 1 || p.eventCounts().complete != 0 {
		t.Fatal("waiting for ward advance disabled defense or forged coverage")
	}
}
