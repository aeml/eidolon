package main

import (
	"fmt"
	"math"
	"strings"
	"testing"
)

func combinedFixtureCredentials(n int) []BotCredentials {
	credentials := make([]BotCredentials, n)
	for i := range credentials {
		credentials[i] = BotCredentials{Username: fmt.Sprintf("synthetic-combined-%d", i), Password: "synthetic-private-password"}
	}
	return credentials
}

func TestCombinedAssignmentsUseDistinctRealSeatsAndFourClassCohorts(t *testing.T) {
	for _, n := range []int{20, 40, 60, 80, 100} {
		assignments, parties, err := combinedAssignments(n, combinedFixtureCredentials(n), 400, 600)
		if err != nil || len(assignments) != n || len(parties) != n/20 {
			t.Fatal("valid configured cohort refused")
		}
		counts := map[string]int{}
		seen := map[string]bool{}
		houseGames := map[string]int{}
		pokerSeats := map[string]int{}
		for index, assignment := range assignments {
			counts[assignment.scenario]++
			if !assignment.preserveGear {
				t.Fatal("a combined role can mutate prepared inventory")
			}
			if assignment.scenario == "party-combat" {
				if assignment.index != index%20 || assignment.party != parties[index/20] || assignment.party.members[assignment.index].username != combinedFixtureCredentials(n)[index].Username {
					t.Fatal("party role/cohort ownership crossed accounts")
				}
				continue
			}
			var b *casinoLoad
			switch assignment.scenario {
			case "casino-slots":
				b = newCasinoLoad(assignment.index)
			case "casino-blackjack":
				b = newBlackjackLoad(assignment.index, "player-synthetic")
			case "casino-house":
				b = newHouseLoad(assignment.index, "player-synthetic")
				houseGames[b.table.Game]++
			case "casino-poker":
				b = newPokerLoad(assignment.index, "player-synthetic")
				pokerSeats[b.table.ID]++
			case "town", "social":
				if !assignment.observeSocial {
					t.Fatal("social/town role has no delivered outcome gate")
				}
				continue
			default:
				t.Fatal("unexpected representative workload")
			}
			key := fmt.Sprintf("%s/%d", b.table.ID, b.seat)
			if b.failed || seen[key] || b.table.Floor != "public" || b.table.Currency != "gold" {
				t.Fatal("combined workload invented/reused a chair or used EP")
			}
			seen[key] = true
		}
		for table, seats := range pokerSeats {
			if seats < 2 {
				t.Fatal("a poker table lacks real players", table)
			}
		}
		if counts["party-combat"] != n/5 || counts["casino-blackjack"] != n/5 || counts["casino-house"] != n/5 || counts["casino-poker"] != n/10 || counts["casino-slots"] != n/10 || counts["town"] != n/10 || counts["social"] != n/10 || houseGames["baccarat"] != n/10 || houseGames["roulette"] != n/10 {
			t.Fatal("fixed workload allocation omitted a role/game")
		}
	}
}

func TestCombinedAssignmentsRejectInvalidCohortAndPrivateDetails(t *testing.T) {
	for _, n := range []int{-1, 0, 4, 19, 21, 99, 101, 120} {
		if _, _, err := combinedAssignments(n, combinedFixtureCredentials(100), 400, 600); err == nil {
			t.Fatal("unapproved cohort size accepted")
		}
	}
	for _, coordinates := range [][2]float64{{math.NaN(), 600}, {400, math.Inf(1)}, {math.MaxFloat64, 600}} {
		if _, _, err := combinedAssignments(20, combinedFixtureCredentials(20), coordinates[0], coordinates[1]); err == nil {
			t.Fatal("invalid predeclared anchor accepted")
		}
	}
	for _, issue := range []string{"missing", "duplicate", "empty", "oversize"} {
		credentials := combinedFixtureCredentials(20)
		switch issue {
		case "missing":
			credentials = credentials[:19]
		case "duplicate":
			credentials[19] = credentials[0]
		case "empty":
			credentials[19].Username = ""
		case "oversize":
			credentials[19].Username = strings.Repeat("s", 129)
		}
		if _, _, err := combinedAssignments(20, credentials, 400, 600); err == nil || strings.Contains(err.Error(), "synthetic-") || strings.Contains(err.Error(), "password") {
			t.Fatal("invalid credentials accepted or revealed")
		}
	}
}

func TestCombinedCoverageCannotHideStarvedOrFailedClients(t *testing.T) {
	assignments, _, _ := combinedAssignments(20, combinedFixtureCredentials(20), 400, 600)
	observations := make([]loadObservation, 20)
	for index, assignment := range assignments {
		if strings.HasPrefix(assignment.scenario, "casino-") {
			observations[index].casino = casinoLoadCounts{paidSpins: 1, spins: 2, wagers: 1, rounds: 1}
		}
	}
	results, valid := summarizeCombinedCasino(assignments, observations)
	if !valid || len(results) != 4 || results[0].clients != 2 || results[0].paid != 2 || results[0].minimum != 1 {
		t.Fatal("valid per-client paid evidence refused or free spins counted")
	}
	observations[15].casino.paidSpins = 0
	observations[14].casino.paidSpins = 100 // A busy peer cannot hide starvation.
	if _, valid := summarizeCombinedCasino(assignments, observations); valid {
		t.Fatal("zero paid results hidden by aggregate peer activity")
	}
	observations[15].casino.paidSpins = 1
	observations[5].casino.failed = true
	if _, valid := summarizeCombinedCasino(assignments, observations); valid {
		t.Fatal("failed poker member hidden")
	}
	if _, valid := summarizeCombinedCasino(assignments, observations[:19]); valid {
		t.Fatal("partial cohort observations accepted")
	}
}
