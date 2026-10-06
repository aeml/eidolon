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
