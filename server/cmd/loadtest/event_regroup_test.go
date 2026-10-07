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

func eventContestedRegroupFixture(t *testing.T, siteIndex int) (*partyLoad, time.Time, Entity) {
	t.Helper()
	p, now := eventMissingSecondWaveFixture(t, siteIndex, 4)
	view := p.event.members[0].view
	// The Rogue is recovering; leave the Cleric present to exercise ordinary
	// healing as well as the Fighter's normal target acquisition.
	for _, index := range []int{0, 1, 3} {
		me := p.members[index].state
		me.X, me.Z, me.Mana = view.RuneX+(view.InnerRadius+view.Radius)/2, view.RuneZ, 100
		if index == 0 {
			me.Health = 60
		}
		if index == 1 {
			me.UnlockedSkills = []string{"Healing Light"}
		}
		p.state(index, me, now)
		p.event.members[index].recovering = false
	}
	away := p.members[2].state
	away.X, away.Z, away.Mana = -1.25, 200, 10
	p.state(2, away, now)
	p.event.members[2].recovering = true
	p.event.members[2].waves = 1
	me := p.members[0].state
	enemy := Entity{ID: p.event.enemyPrefix + "2-0", Type: "Enemy", Health: 100, X: me.X + 1, Z: me.Z}
	return p, now, enemy
}

func TestEventRegroupKeepsContestedWardCombatAndHealing(t *testing.T) {
	for siteIndex := 0; siteIndex < 4; siteIndex++ {
		t.Run(eventView(siteIndex, 0).Site.ID, func(t *testing.T) {
			p, now, enemy := eventContestedRegroupFixture(t, siteIndex)
			if p.event.waveReady(p, p.event.members[0].view) {
				t.Fatal("fixture did not retain the absent member's own-wave gate")
			}
			attacks, heals := 0, 0
			for _, index := range []int{0, 1} {
				p.step(index, p.members[index].state, map[string]Entity{enemy.ID: enemy}, now, time.Second,
					func(kind string, payload interface{}) error {
						if index == 0 && kind == "attack" && payload.(map[string]string)["targetId"] == enemy.ID {
							attacks++
						} else if index == 1 && kind == "ability" {
							cast := payload.(map[string]interface{})
							if cast["skillName"] != "Healing Light" || cast["targetId"] != p.members[0].id {
								t.Fatal("Cleric did not heal the present wounded Fighter")
							}
							heals++
						} else {
							t.Fatal("contested defense bypassed ordinary attack/healing")
						}
						return nil
					}, func(float64, float64) { t.Fatal("live contested ward suppressed ordinary defense") })
			}
			if attacks != 1 || heals != 1 || p.failed || p.event.members[2].waves != 1 || p.eventCounts().complete != 0 {
				t.Fatal("defense did not retain normal actions and independent coverage")
			}
		})
	}
}

func TestEventRegroupUncontestedWardStillWaits(t *testing.T) {
	for _, scenario := range []string{"absent", "outside", "inner-hole", "dead", "zero-health", "foreign-instance", "previous-wave", "unrelated", "not-enemy", "nonfinite"} {
		t.Run(scenario, func(t *testing.T) {
			siteIndex := 0
			if scenario == "inner-hole" {
				siteIndex = 2
			}
			p, now, enemy := eventContestedRegroupFixture(t, siteIndex)
			state := map[string]Entity{}
			switch scenario {
			case "outside":
				enemy.X = p.event.site.X + 30
			case "inner-hole":
				enemy.X = p.event.members[0].view.RuneX
			case "dead":
				enemy.State = "DEAD"
			case "zero-health":
				enemy.Health = 0
			case "foreign-instance":
				enemy.InstanceID = "different"
			case "previous-wave":
				enemy.ID = p.event.enemyPrefix + "1-0"
			case "unrelated":
				enemy.ID = "ordinary-enemy"
			case "not-enemy":
				enemy.Type = "Player"
			case "nonfinite":
				enemy.X = math.NaN()
			}
			if scenario != "absent" {
				state[enemy.ID] = enemy
			}
			moves := 0
			p.step(0, p.members[0].state, state, now, time.Second,
				func(string, interface{}) error { t.Fatal("uncontested ward allowed combat before regroup"); return nil },
				func(x, z float64) {
					moves++
					view := p.event.members[0].view
					if math.Hypot(x-view.RuneX, z-view.RuneZ) <= view.Radius {
						t.Fatal("waiting still charged the ward")
					}
				})
			if moves != 1 || p.failed || p.event.members[2].waves != 1 || p.eventCounts().complete != 0 {
				t.Fatal("uncontested regroup forged participation or completion")
			}
		})
	}
}
