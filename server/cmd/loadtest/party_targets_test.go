package main

import (
	"math"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCombinedPatrolExploresObservedEnemyBeyondOldRouteWithoutCredit(t *testing.T) {
	_, parties, err := combinedAssignments(100, combinedFixtureCredentials(100), 400, 600)
	if err != nil {
		t.Fatal(err)
	}
	p := parties[0]
	now := time.Unix(100, 0)
	for index := range p.members {
		member := &p.members[index]
		p.state(index, Entity{ID: member.id, Name: member.username, SubType: partyLoadClasses[index], Type: "Player", X: 400, Z: 600, Health: 100, MaxHealth: 100, Speed: 5, Level: 30}, now)
		p.receive(index, partyRoster(p, 4), now)
	}
	enemy := Entity{ID: "visible-unclaimed", Type: "Enemy", X: 475, Z: 675, Health: 100, State: "IDLE"}
	for _, point := range p.patrol {
		if math.Hypot(enemy.X-point[0], enemy.Z-point[1]) <= 30 {
			t.Fatal("regression enemy must be outside every old patrol acquisition circle")
		}
	}
	writes, moves := 0, 0
	request := func(string, interface{}) error { writes++; return nil }
	move := func(x, z float64) {
		moves++
		if x != enemy.X || z != enemy.Z || math.Hypot(x-400, z-600) > 120 {
			t.Fatal("ignored actual visible opportunity or left declared exploration bound")
		}
	}
	view := map[string]Entity{enemy.ID: enemy}
	p.step(0, p.members[0].state, view, now, time.Second, request, move)
	if moves != 1 || writes != 0 || p.target.ID != "" || !p.targetClaims.available(1, enemy.ID) {
		t.Fatal("movement planning acquired/claimed/cast instead of exploring normally")
	}
	// The original acquisition step may now find the observed target around
	// the new anchor, but the actor is still far away: no remote cast/hit.
	p.step(0, p.members[0].state, view, now.Add(200*time.Millisecond), time.Second, request, move)
	if moves != 2 || writes != 0 || p.target.ID != enemy.ID || p.counts().damage != 0 || p.counts().minImpacts != 0 {
		t.Fatal("lookahead invented impact credit or bypassed actual cast/attack range")
	}
}

func TestObservedPatrolDestinationRejectsForeignDeadClaimedAndUnboundedActors(t *testing.T) {
	_, parties, err := combinedAssignments(40, combinedFixtureCredentials(40), 400, 600)
	if err != nil {
		t.Fatal(err)
	}
	p := parties[0]
	me := Entity{X: 400, Z: 600}
	if !p.targetClaims.claim(1, "claimed") {
		t.Fatal("fixture target claim missing")
	}
	view := map[string]Entity{
		"legal-b": {ID: "legal-b", Type: "Enemy", X: 472, Z: 696, Health: 100}, // Exactly120 units.
		"legal-a": {ID: "legal-a", Type: "Enemy", X: 328, Z: 504, Health: 100},
		"far":     {ID: "far", Type: "Enemy", X: 521, Z: 600, Health: 100},
		"foreign": {ID: "foreign", Type: "Enemy", X: 401, Z: 600, Health: 100, InstanceID: "another-scene"},
		"dead":    {ID: "dead", Type: "Enemy", X: 401, Z: 600, Health: 100, State: "DEAD"},
		"zero":    {ID: "zero", Type: "Enemy", X: 401, Z: 600, Health: 0},
		"claimed": {ID: "claimed", Type: "Enemy", X: 401, Z: 600, Health: 100},
		"npc":     {ID: "npc", Type: "NPC", X: 401, Z: 600, Health: 100},
		"nan":     {ID: "nan", Type: "Enemy", X: math.NaN(), Z: 600, Health: 100},
		"inf":     {ID: "inf", Type: "Enemy", X: math.Inf(1), Z: 600, Health: 100},
	}
	point, found := p.observedPatrolDestination(me, view)
	if !found || point != [2]float64{328, 504} {
		t.Fatal("lookahead changed deterministic tie or selected an invalid observation", point, found)
	}
	delete(view, "legal-a")
	delete(view, "legal-b")
	if _, found := p.observedPatrolDestination(me, view); found {
		t.Fatal("lookahead selected a dead/foreign/claimed/invalid/out-of-bound actor")
	}
	view["legal-a"] = Entity{ID: "legal-a", Type: "Enemy", X: 475, Z: 675, Health: 100}
	for _, profile := range []string{"dungeon", "raid", "event", "no-patrol"} {
		p.dungeon, p.raid, p.event = nil, nil, nil
		switch profile {
		case "dungeon":
			p.dungeon = &dungeonLoad{}
		case "raid":
			p.raid = &raidLoad{}
		case "event":
			p.event = &eventLoad{}
		case "no-patrol":
			p.patrol = nil
		}
		if _, found := p.observedPatrolDestination(me, view); found {
			t.Fatal("combined lookahead escaped into another profile", profile)
		}
	}
}

func TestCombinedPartiesExploreBoundedAreaWhenTargetsRunOutWithoutCredit(t *testing.T) {
	_, parties, err := combinedAssignments(100, combinedFixtureCredentials(100), 400, 600)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Unix(100, 0)
	for _, party := range parties {
		for index := range party.members {
			member := &party.members[index]
			party.state(index, Entity{ID: member.id, Name: member.username, SubType: partyLoadClasses[index], Type: "Player", X: 400, Z: 600, Health: 100, MaxHealth: 100, Speed: 5, Level: 30}, now)
			party.receive(index, partyRoster(party, 4), now)
		}
		explored := false
		for step := 0; step < 3; step++ {
			party.step(0, party.members[0].state, nil, now.Add(time.Duration(step)*100*time.Millisecond), time.Second, func(string, interface{}) error {
				t.Fatal("empty observed world caused a cast or invented target")
				return nil
			}, func(x, z float64) {
				distance := math.Hypot(x-400, z-600)
				if math.IsNaN(distance) || math.IsInf(distance, 0) || distance > 60 {
					t.Fatal("combined patrol left its predeclared bounded area")
				}
				explored = explored || distance > 0
			})
		}
		counts := party.counts()
		if !explored || counts.damage != 0 || counts.minImpacts != 0 || !counts.formed {
			t.Fatal("combined cohort remains parked or manufactures combat credit")
		}
	}
}

func TestCombinedPartiesChooseDistinctLiveEnemiesWithoutChangingImpactGates(t *testing.T) {
	_, parties, err := combinedAssignments(40, combinedFixtureCredentials(40), 400, 600)
	if err != nil || parties[0].targetClaims != parties[1].targetClaims || len(parties[0].targetClaims.targets) != 2 {
		t.Fatal("claims are not bounded to the configured parties")
	}
	now := time.Unix(100, 0)
	for _, party := range parties {
		for i := range party.members {
			member := &party.members[i]
			party.state(i, Entity{ID: member.id, Name: member.username, SubType: partyLoadClasses[i], Type: "Player", X: 400, Z: 600, Health: 100, MaxHealth: 100, Speed: 5, Level: 30,
				UnlockedSkills: []string{[4]string{"Charge", "Radiant Strike", "Piercing Throw", "Fireball"}[i]}}, now)
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
