package main

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCombinedPartiesChooseDistinctLiveEnemiesWithoutChangingImpactGates(t *testing.T) {
	_, parties, err := combinedAssignments(40, combinedFixtureCredentials(40), 400, 600)
	if err != nil || parties[0].targetClaims != parties[1].targetClaims || len(parties[0].targetClaims.targets) != 2 {
		t.Fatal("claims are not bounded to the configured parties")
	}
	now := time.Unix(100, 0)
	for _, party := range parties {
		for i := range party.members {
			member := &party.members[i]
			party.state(i, Entity{ID: member.id, Name: member.username, SubType: partyLoadClasses[i], Type: "Player", X: 400, Z: 600, Health: 100, MaxHealth: 100, Speed: 5, Level: 30}, now)
			party.receive(i, partyRoster(party, 4), now)
		}
	}
	state := map[string]Entity{
		"target-a": {ID: "target-a", Type: "Enemy", State: "IDLE", X: 401, Z: 600, Health: 100},
		"target-b": {ID: "target-b", Type: "Enemy", State: "IDLE", X: 402, Z: 600, Health: 100},
		"foreign":  {ID: "foreign", Type: "Enemy", X: 400, Z: 600, Health: 100, InstanceID: "another-scene"},
		"dead":     {ID: "dead", Type: "Enemy", X: 400, Z: 600, Health: 0},
		"far":      {ID: "far", Type: "Enemy", X: 450, Z: 600, Health: 100},
	}
	for group, party := range parties {
		writes := 0
		party.step(0, party.members[0].state, state, now, time.Second, func(kind string, payload interface{}) error {
			writes++
			if kind != "ability" || payload.(map[string]interface{})["targetId"] != []string{"target-a", "target-b"}[group] {
				t.Fatal("party did not choose the nearest available legal observed enemy")
			}
			return nil
		}, func(float64, float64) { t.Fatal("in-range target caused movement") })
		if writes != 1 || party.counts().minImpacts != 0 || party.counts().damage != 0 {
			t.Fatal("target cooperation created impact credit or changed the gate")
		}
	}
	first := parties[0]
	first.receive(0, partyMessage("ability_result", map[string]interface{}{"skillName": "Charge", "accepted": true, "cooldownRemaining": 5}), now)
	dead := state["target-a"]
	dead.Health, dead.State = 0, "DEAD"
	state[dead.ID] = dead
	first.step(0, first.members[0].state, state, now.Add(time.Second), time.Second, func(string, interface{}) error {
		t.Fatal("cast at dead, foreign, out-of-range or other party's enemy")
		return nil
	}, func(float64, float64) {})
	if first.target.ID != "" || !first.targetClaims.available(1, dead.ID) || first.counts().minImpacts != 0 {
		t.Fatal("dead target not released, spare enemy invented or acceptance relaxed")
	}
	parties[1].reject()
	if !first.targetClaims.available(0, "target-b") {
		t.Fatal("failed cohort retained its target")
	}
}

func TestPartyTargetClaimRaceHasOneOwnerAndBoundedReplacement(t *testing.T) {
	c := &partyTargetClaims{targets: make([]string, 5)}
	var successes atomic.Int32
	var winner atomic.Int32
	var workers sync.WaitGroup
	for group := 0; group < 5; group++ {
		workers.Add(1)
		go func(group int) {
			defer workers.Done()
			if c.claim(group, "observed-enemy") {
				successes.Add(1)
				winner.Store(int32(group))
			}
		}(group)
	}
	workers.Wait()
	if successes.Load() != 1 {
		t.Fatal("simultaneous leaders claimed the same enemy")
	}
	group := int(winner.Load())
	if !c.claim(group, "replacement-enemy") || !c.available((group+1)%5, "observed-enemy") {
		t.Fatal("replacement retained target history")
	}
	for _, invalid := range []int{-1, 5} {
		if c.available(invalid, "enemy") || c.claim(invalid, "enemy") {
			t.Fatal("invalid cohort accepted")
		}
		c.release(invalid)
	}
	if c.claim(group, "") || len(c.targets) != 5 {
		t.Fatal("empty target accepted or ownership storage grew")
	}
	c.release(group)
	if !c.available((group+1)%5, "replacement-enemy") {
		t.Fatal("current target not released")
	}
}
