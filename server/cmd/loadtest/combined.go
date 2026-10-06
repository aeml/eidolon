package main

import (
	"errors"
	"math"
)

type botAssignment struct {
	scenario      string
	index         int
	party         *partyLoad
	preserveGear  bool
	observeSocial bool
}

// Fixed twenty-client blocks: four class-role party members, two poker, four
// blackjack, two baccarat/two roulette, two slots, two town and two social.
// No extra money, actors, seats or raid/event acceptance are manufactured.
func combinedAssignments(n int, credentials []BotCredentials, x, z float64) ([]botAssignment, []*partyLoad, error) {
	if n < 20 || n > 100 || n%20 != 0 || len(credentials) < n || math.IsNaN(x) || math.IsNaN(z) || math.IsInf(x, 0) || math.IsInf(z, 0) || math.Abs(x) > math.MaxFloat32 || math.Abs(z) > math.MaxFloat32 {
		return nil, nil, errors.New("combined requires 20–100 supplied clients in blocks of twenty and a finite explicit combat anchor")
	}
	seen := make(map[string]bool, n)
	for _, credential := range credentials[:n] {
		if credential.Username == "" || len(credential.Username) > 128 || seen[credential.Username] {
			return nil, nil, errors.New("combined requires distinct prepared test accounts")
		}
		seen[credential.Username] = true
	}
	assignments := make([]botAssignment, n)
	parties := make([]*partyLoad, 0, n/20)
	for block := 0; block < n/20; block++ {
		start := block * 20
		party := newPartyLoad(credentials[start:start+4], x, z)
		parties = append(parties, party)
		for local := 0; local < 20; local++ {
			assignment := botAssignment{preserveGear: true}
			switch {
			case local < 4:
				assignment.scenario, assignment.index, assignment.party = "party-combat", local, party
			case local < 6:
				assignment.scenario, assignment.index = "casino-poker", block*2+local-4
			case local < 10:
				assignment.scenario, assignment.index = "casino-blackjack", block*4+local-6
			case local < 12:
				assignment.scenario, assignment.index = "casino-house", block*2+local-10
			case local < 14:
				assignment.scenario, assignment.index = "casino-house", 24+block*2+local-12
			case local < 16:
				assignment.scenario, assignment.index = "casino-slots", block+(local-14)*16
			case local < 18:
				assignment.scenario = "town"
				assignment.observeSocial = true
			default:
				assignment.scenario = "social"
				assignment.observeSocial = true
			}
			assignments[start+local] = assignment
		}
	}
	return assignments, parties, nil
}

type combinedCasinoCoverage struct {
	scenario                 string
	clients, failed          int
	wagers, paid, minimum    uint64
	observedActions, bonuses uint64
	failures                 [casinoFailureKinds]uint64
	timeouts                 [casinoTimeoutKinds]uint64
}

// Include every assigned client, including zero results, not just aggregate
// successes. Reader shutdown precedes these final observations.
func summarizeCombinedCasino(assignments []botAssignment, observations []loadObservation) ([]combinedCasinoCoverage, bool) {
	if len(assignments) != len(observations) {
		return nil, false
	}
	var results []combinedCasinoCoverage
	valid := true
	for _, scenario := range []string{"casino-slots", "casino-blackjack", "casino-house", "casino-poker"} {
		c := combinedCasinoCoverage{scenario: scenario}
		for index, assignment := range assignments {
			if assignment.scenario != scenario {
				continue
			}
			observation := observations[index].casino
			paid, wagers := observation.rounds, observation.wagers
			if scenario == "casino-slots" {
				paid, wagers = observation.paidSpins, observation.paidSpins
			}
			if c.clients == 0 || paid < c.minimum {
				c.minimum = paid
			}
			c.clients++
			c.paid += paid
			c.wagers += wagers
			c.observedActions += observation.actions
			c.bonuses += observation.bonuses
			if observation.failed {
				c.failed++
				stage := observation.failureStage
				if stage >= casinoFailureKinds {
					stage = casinoFailureUnknown
				}
				c.failures[stage]++
				if stage == casinoFailureTimeout {
					action := observation.timeoutAction
					if action >= casinoTimeoutKinds {
						action = casinoTimeoutUnknown
					}
					c.timeouts[action]++
				}
			}
		}
		valid = valid && c.clients > 0 && c.minimum > 0 && c.failed == 0
		results = append(results, c)
	}
	return results, valid
}
