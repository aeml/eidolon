package main

import (
	"testing"
	"time"
)

func TestPartyActivityCountersExplainWaitsWithoutGrantingImpact(t *testing.T) {
	for _, scenario := range []string{"pending-cast", "regroup", "cohort-wait", "no-target", "pursuit"} {
		t.Run(scenario, func(t *testing.T) {
			p, _ := partyFixture()
			now := time.Unix(100, 0)
			for i := range p.members {
				p.receive(i, partyRoster(p, 4), now)
			}
			index := 3
			p.target = Entity{ID: "observed-enemy", Type: "Enemy", Health: 100, X: 20}
			member := &p.members[index]
			expected := partyActivityCounts{}
			switch scenario {
			case "pending-cast":
				member.pendingSkill, member.abilitySent = "Fireball", now
				expected.pendingCast = 1
			case "regroup":
				member.state.X = 40
				expected.regroup = 1
			case "cohort-wait":
				index = 0
				p.members[1].state.Health = 0
				expected.cohortWait = 1
			case "no-target":
				p.target = Entity{}
				expected.noTarget = 1
			case "pursuit":
				expected.pursuit = 1
			}
			state := map[string]Entity{p.target.ID: p.target}
			p.step(index, p.members[index].state, state, now, time.Second,
				func(string, interface{}) error { t.Fatal("waiting bot issued combat request"); return nil },
				func(float64, float64) {})
			counts := p.counts()
			if got := counts.roles[index].activity; got != expected {
				t.Fatalf("activity=%+v want=%+v", got, expected)
			}
			if counts.failed || counts.damage != 0 || counts.heals != 0 || counts.casts != 0 || counts.minImpacts != 0 {
				t.Fatal("diagnostic wait created failure, acceptance or impact")
			}
			var merged partyRoleCounts
			merged.merge(counts.roles[index])
			merged.merge(counts.roles[index])
			doubled := expected
			doubled.merge(expected)
			if merged.activity != doubled || merged.minImpacts != 0 {
				t.Fatal("aggregate lost waits or granted impact")
			}
		})
	}
}

func TestPartyCombatUsesOnlyAdvertisedBuildSkillsAndClericStrikeRange(t *testing.T) {
	for role, skill := range [4]string{"Charge", "Radiant Strike", "Piercing Throw", "Fireball"} {
		for _, unlocked := range []bool{false, true} {
			p, _ := partyFixture()
			now := time.Unix(100, 0)
			for index := range p.members {
				p.receive(index, partyRoster(p, 4), now)
			}
			p.target = Entity{ID: "observed-enemy", Type: "Enemy", Health: 100, X: 2}
			me := p.members[role].state
			me.UnlockedSkills = nil
			if unlocked {
				me.UnlockedSkills = []string{skill}
			}
			requests := 0
			p.step(role, me, map[string]Entity{p.target.ID: p.target}, now, time.Second,
				func(kind string, payload interface{}) error {
					requests++
					if !unlocked {
						if kind != "attack" {
							t.Fatal("locked skill submitted instead of an ordinary attack", role)
						}
					} else if kind != "ability" || payload.(map[string]interface{})["skillName"] != skill {
						t.Fatal("advertised build skill not used", role)
					}
					return nil
				}, func(float64, float64) { t.Fatal("nearby target ignored") })
			if requests != 1 || p.counts().minImpacts != 0 || p.counts().casts != 0 || p.counts().damage != 0 {
				t.Fatal("request missing or manufactured combat evidence")
			}
		}
	}
	p, _ := partyFixture()
	now := time.Unix(100, 0)
	for index := range p.members {
		p.receive(index, partyRoster(p, 4), now)
	}
	p.target = Entity{ID: "observed-enemy", Type: "Enemy", Health: 100, X: 6}
	me := p.members[1].state
	me.UnlockedSkills = []string{"Radiant Strike"}
	moved := false
	p.step(1, me, nil, now, time.Second,
		func(string, interface{}) error {
			t.Fatal("cleric cone cast outside its actual base radius")
			return nil
		},
		func(x, z float64) { moved = x == p.target.X && z == p.target.Z })
	if !moved || p.counts().minImpacts != 0 {
		t.Fatal("cleric failed to approach or waiting granted impact")
	}
}

func TestPartyClericHealsWithoutEnemyAndRespectsHealingCooldown(t *testing.T) {
	for _, scenario := range []string{"no-enemy", "cooldown-no-enemy", "cooldown-enemy", "locked-heal", "dead-ally", "other-scene", "out-of-range"} {
		t.Run(scenario, func(t *testing.T) {
			p, _ := partyFixture()
			now := time.Unix(100, 0)
			for index := range p.members {
				p.receive(index, partyRoster(p, 4), now)
			}
			p.members[0].state.Health = 50
			me := p.members[1].state
			me.UnlockedSkills = []string{"Radiant Strike", "Healing Light"}
			wantKind, wantSkill, wantTarget := "", "", ""
			switch scenario {
			case "no-enemy":
				wantKind, wantSkill, wantTarget = "ability", "Healing Light", p.members[0].id
			case "cooldown-no-enemy", "cooldown-enemy":
				p.members[1].readyAt["Healing Light"] = now.Add(time.Second)
				if scenario == "cooldown-enemy" {
					p.target = Entity{ID: "observed-enemy", Type: "Enemy", Health: 100, X: 2}
					wantKind, wantSkill, wantTarget = "ability", "Radiant Strike", p.target.ID
				}
			case "locked-heal":
				me.UnlockedSkills = []string{"Radiant Strike"}
			case "dead-ally":
				p.members[0].state.Health = 0
			case "other-scene":
				p.members[0].state.InstanceID = "different-dungeon"
			case "out-of-range":
				// Stay within the existing leader-regroup distance, but move
				// the injured Rogue beyond the healing range.
				p.members[0].state.Health = 100
				p.members[2].state.Health, p.members[2].state.X = 50, 15
			}
			requests := 0
			request := func(kind string, payload interface{}) error {
				requests++
				if kind != wantKind || kind != "ability" {
					t.Fatalf("unexpected request %q; wanted %q", kind, wantKind)
				}
				ability := payload.(map[string]interface{})
				if ability["skillName"] != wantSkill || ability["targetId"] != wantTarget {
					t.Fatalf("ability=%v; wanted %s on %s", ability, wantSkill, wantTarget)
				}
				return nil
			}
			move := func(float64, float64) { t.Fatal("Cleric moved instead of healing, attacking or waiting") }
			p.step(1, me, nil, now, time.Second, request, move)
			wantRequests := 0
			if wantKind != "" {
				wantRequests = 1
				p.step(1, me, nil, now.Add(time.Millisecond), time.Second, request, move)
			}
			counts := p.counts()
			if requests != wantRequests || counts.failed || counts.casts != 0 || counts.heals != 0 || counts.damage != 0 || counts.minImpacts != 0 {
				t.Fatalf("requests=%d want=%d; submission/wait manufactured evidence: %+v", requests, wantRequests, counts)
			}
		})
	}
}
