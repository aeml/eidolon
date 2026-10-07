package main

import (
	"bytes"
	"compress/gzip"
	crand "crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"time"

	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

var (
	addr              = flag.String("addr", "localhost:8080", "http service address")
	scheme            = flag.String("scheme", "wss", "websocket scheme (ws or wss)")
	count             = flag.Int("n", 10, "number of bots")
	townMode          = flag.Bool("town", false, "bots only roam in town")
	insecure          = flag.Bool("insecure-skip-verify", false, "skip TLS certificate verification for local/self-signed testing")
	credentialsFile   = flag.String("credentials-file", "", "optional read-only JSON credential file; generated credentials otherwise remain in memory")
	duration          = flag.Duration("duration", 0, "stop automatically after this duration (zero waits for interrupt)")
	scenario          = flag.String("scenario", "combat", "scripted flow: combat, town, social, mixed, combined, casino-slots, casino-blackjack, casino-house, casino-poker, party-combat, party-dungeon, party-raid, or party-event")
	admissionTimeout  = flag.Duration("admission-timeout", 15*time.Second, "maximum wait for each registration, login and own-player acknowledgement, 100ms to60s")
	casinoBet         = flag.Int("casino-bet", 20, "Gold casino stake; poker requires100–100000 in steps of100, other games20–100000 in steps of20; isolated funded accounts required")
	partyCombatX      = flag.Float64("party-combat-x", math.NaN(), "required predeclared overworld combat anchor for party-combat/combined")
	partyCombatZ      = flag.Float64("party-combat-z", math.NaN(), "required predeclared overworld combat anchor for party-combat/combined")
	dungeonType       = flag.String("dungeon-type", "verdant_bastion_catacombs", "ordinary regional dungeon for party-dungeon; qualified prepared saves required")
	dungeonLevel      = flag.Int("dungeon-level", 30, "predeclared unlocked run level for party-dungeon")
	dungeonDifficulty = flag.String("dungeon-difficulty", "normal", "predeclared unlocked normal/heroic/mythic difficulty for party-dungeon")
	raidType          = flag.String("raid-type", "earth_crystal_raid", "elemental raid or weekly_raid Dark King for party-raid;5–10 qualified prepared saves required")
	eventSite         = flag.String("event-site", "current", "party-event selection: current, root, tide, ember or gale; normal schedule/qualified prepared saves")
)

type loadMetrics struct {
	connected       atomic.Int64
	joined          atomic.Int64
	stateFrames     atomic.Int64
	readErrors      atomic.Int64
	writeErrors     atomic.Int64
	decodeErrors    atomic.Int64
	admissionErrors atomic.Int64
	authenticated   atomic.Int64
}

var metrics loadMetrics

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type Entity struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	SubType        string          `json:"subType"`
	PartyID        string          `json:"partyId"`
	Type           string          `json:"type"`
	X              float64         `json:"x"`
	Y              float64         `json:"y"`
	Z              float64         `json:"z"`
	Speed          float64         `json:"speed"`
	MoveSequence   uint64          `json:"moveSequence"`
	InstanceID     string          `json:"instanceId"`
	State          string          `json:"state"`
	Health         int             `json:"health"`
	MaxHealth      int             `json:"maxHealth"`
	Mana           int             `json:"mana"`
	MaxMana        int             `json:"maxMana"`
	Experience     int64           `json:"experience"`
	UnlockedSkills []string        `json:"unlockedSkills"`
	Level          int             `json:"level"`
	Equipment      map[string]Item `json:"equipment"`
}

type Item struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Slot   string `json:"slot"`
	Level  int    `json:"level"`
	Rarity string `json:"rarity"`
	Value  int    `json:"value"`
}

type BotCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func loadCredentials(path string) ([]BotCredentials, error) {
	if path == "" {
		return []BotCredentials{}, nil
	}
	file, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read credentials file: %w", err)
	}
	var creds []BotCredentials
	if err := json.Unmarshal(file, &creds); err != nil {
		return nil, fmt.Errorf("decode credentials file: %w", err)
	}
	return creds, nil
}

func randomHex(byteCount int) (string, error) {
	raw := make([]byte, byteCount)
	if _, err := io.ReadFull(crand.Reader, raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func generateDisposableCredentials() (BotCredentials, error) {
	usernameToken, err := randomHex(8)
	if err != nil {
		return BotCredentials{}, fmt.Errorf("generate username: %w", err)
	}
	password, err := randomHex(24)
	if err != nil {
		return BotCredentials{}, fmt.Errorf("generate password: %w", err)
	}
	return BotCredentials{
		Username: "loadtest-" + usernameToken,
		Password: password,
	}, nil
}

func main() {
	flag.Parse()
	if *count < 1 {
		log.Fatal("-n must be at least 1")
	}
	if *admissionTimeout < 100*time.Millisecond || *admissionTimeout > time.Minute {
		log.Fatal("-admission-timeout must be100ms to60s")
	}
	selectedScenario := *scenario
	if *townMode {
		selectedScenario = "town"
	}
	if selectedScenario != "combat" && selectedScenario != "town" && selectedScenario != "social" && selectedScenario != "mixed" && selectedScenario != "combined" && selectedScenario != "casino-slots" && selectedScenario != "casino-blackjack" && selectedScenario != "casino-house" && selectedScenario != "casino-poker" && selectedScenario != "party-combat" && selectedScenario != "party-dungeon" && selectedScenario != "party-raid" && selectedScenario != "party-event" {
		log.Fatal("-scenario must be combat, town, social, mixed, combined, casino-slots, casino-blackjack, casino-house, casino-poker, party-combat, party-dungeon, party-raid, or party-event")
	}
	if selectedScenario == "casino-slots" && (*count > 32 || *casinoBet < 20 || *casinoBet > 100000 || *casinoBet%20 != 0) {
		log.Fatal("casino-slots requires1–32 public machines and a Gold bet20–100000 in steps of20")
	}
	if selectedScenario == "casino-blackjack" && (*count > 24 || *casinoBet < 20 || *casinoBet > 100000 || *casinoBet%20 != 0) {
		log.Fatal("casino-blackjack requires1–24 public seats and a Gold bet20–100000 in steps of20")
	}
	if selectedScenario == "casino-house" && (*count > 36 || *casinoBet < 20 || *casinoBet > 100000 || *casinoBet%20 != 0) {
		log.Fatal("casino-house requires1–36 public seats and Gold bet20–100000 in steps of20")
	}
	if selectedScenario == "casino-poker" && (!validPokerClientCount(*count) || !game.ValidPokerBuyIn(*casinoBet)) {
		log.Fatal("casino-poker requires2–24 public seats (no lone final table) and Gold buy-in100–100000 in steps of100")
	}
	if selectedScenario == "party-combat" && (*count%4 != 0 || *count > 100 || math.IsNaN(*partyCombatX) || math.IsNaN(*partyCombatZ) || math.IsInf(*partyCombatX, 0) || math.IsInf(*partyCombatZ, 0) || math.Abs(*partyCombatX) > math.MaxFloat32 || math.Abs(*partyCombatZ) > math.MaxFloat32) {
		log.Fatal("party-combat requires 4–100 clients in groups of four and finite predeclared combat coordinates")
	}
	if selectedScenario == "party-dungeon" {
		minimum, supported := game.DungeonEntryLevels()[*dungeonType]
		if *count < 4 || *count > 100 || *count%4 != 0 || !supported || *dungeonLevel < minimum || game.ValidateDungeonEntrySelection(100, *dungeonLevel, game.DungeonDifficulty(*dungeonDifficulty)) != nil {
			log.Fatal("party-dungeon requires4–100 clients in groups of four and a valid explicit regional run/difficulty")
		}
	}
	if selectedScenario == "party-raid" {
		if _, valid := raidLoadLevel(*raidType); !valid || *count < 5 || *count > 10 {
			log.Fatal("party-raid requires5–10 clients and an explicit supported elemental/weekly raid")
		}
		if *raidType == "weekly_raid" && (*duration <= 0 || *duration > 30*time.Minute) {
			log.Fatal("weekly_raid requires an explicit maximum duration up to30m")
		}
	}
	if selectedScenario == "party-event" && (*count < 4 || *count > 100 || *count%4 != 0 || !validEventSelection(*eventSite) || *duration <= 0 || *duration > 45*time.Minute) {
		log.Fatal("party-event requires4–100 prepared clients in groups of four, a valid site selection and explicit maximum duration up to45m")
	}
	rand.Seed(time.Now().UnixNano())
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: *scheme, Host: *addr, Path: "/ws"}
	log.Printf("Connecting to %s with %d bots...", u.String(), *count)

	// Credential files are opt-in and read-only. Any missing accounts use
	// cryptographically random, process-local credentials that are never saved.
	creds, err := loadCredentials(*credentialsFile)
	if err != nil {
		log.Fatal(err)
	}
	if (selectedScenario == "casino-slots" || selectedScenario == "casino-blackjack" || selectedScenario == "casino-house" || selectedScenario == "casino-poker") && len(creds) < *count {
		log.Fatal("casino workloads require supplied credentials for every approved, funded test account")
	}
	var parties []*partyLoad
	var assignments []botAssignment
	if selectedScenario == "combined" {
		if *casinoBet != 100 {
			log.Fatal("combined requires an explicit 100Gold stake, legal across every included casino game")
		}
		assignments, parties, err = combinedAssignments(*count, creds, *partyCombatX, *partyCombatZ)
		if err != nil {
			log.Fatal(err)
		}
	}
	if selectedScenario == "party-combat" || selectedScenario == "party-dungeon" || selectedScenario == "party-raid" || selectedScenario == "party-event" {
		if len(creds) < *count {
			log.Fatal("party workloads require supplied prepared test accounts for every client")
		}
		seen := map[string]bool{}
		for _, credential := range creds[:*count] {
			if credential.Username == "" || seen[credential.Username] {
				log.Fatal("party workloads require distinct prepared test accounts")
			}
			seen[credential.Username] = true
		}
		if selectedScenario == "party-raid" {
			parties = append(parties, newRaidWorkload(creds[:*count], *raidType))
			if parties[0].failed {
				log.Fatal("invalid prepared raid cohort")
			}
		} else {
			for i := 0; i < *count; i += 4 {
				if selectedScenario == "party-event" {
					parties = append(parties, newEventParty(creds[i:i+4], *eventSite))
				} else if selectedScenario == "party-dungeon" {
					parties = append(parties, newDungeonParty(creds[i:i+4], *dungeonType, *dungeonLevel, *dungeonDifficulty))
				} else {
					parties = append(parties, newPartyLoad(creds[i:i+4], *partyCombatX, *partyCombatZ))
				}
			}
		}
	}
	if len(creds) < *count {
		log.Printf("Generating %d disposable in-memory bot accounts...", *count-len(creds))
		for len(creds) < *count {
			credential, err := generateDisposableCredentials()
			if err != nil {
				log.Fatal(err)
			}
			creds = append(creds, credential)
		}
	}

	var wg sync.WaitGroup
	stop := make(chan struct{})
	observations := make([]loadObservation, *count)

	for i := 0; i < *count; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			if selectedScenario == "combined" {
				runAssignedBot(idx, u.String(), creds[idx], assignments[idx], stop, &observations[idx])
				return
			}
			if selectedScenario == "town" || selectedScenario == "social" {
				assignment := botAssignment{scenario: selectedScenario, preserveGear: true, observeSocial: true}
				runAssignedBot(idx, u.String(), creds[idx], assignment, stop, &observations[idx])
				return
			}
			botScenario := selectedScenario
			if botScenario == "mixed" {
				botScenario = []string{"combat", "town", "social"}[idx%3]
			}
			var party *partyLoad
			if botScenario == "party-combat" || botScenario == "party-dungeon" || botScenario == "party-event" {
				party = parties[idx/4]
			}
			if botScenario == "party-raid" {
				party = parties[0]
			}
			runBot(idx, u.String(), creds[idx], botScenario, stop, &observations[idx], party)
		}(i)
		// Stagger connections slightly to avoid hammering the server all at once
		time.Sleep(100 * time.Millisecond)
	}

	allBotsDone := make(chan struct{})
	go func() { wg.Wait(); close(allBotsDone) }()
	if *duration > 0 {
		select {
		case <-interrupt:
		case <-time.After(*duration):
		case <-allBotsDone:
		}
	} else {
		select {
		case <-interrupt:
		case <-allBotsDone:
		}
	}
	log.Println("Stopping bots...")
	close(stop)
	wg.Wait()
	coverage := summarizeStateCoverage(observations)
	log.Printf(
		"Load summary: connected=%d joined=%d state_frames=%d read_errors=%d write_errors=%d decode_errors=%d",
		metrics.connected.Load(),
		metrics.joined.Load(),
		metrics.stateFrames.Load(),
		metrics.readErrors.Load(),
		metrics.writeErrors.Load(),
		metrics.decodeErrors.Load(),
	)
	log.Printf("State coverage: clients=%d min_frames=%d min_active_ms=%d max_gap_ms=%d wire_bytes=%d",
		coverage.clients, coverage.minFrames, coverage.minActive.Milliseconds(), coverage.maxGap.Milliseconds(), coverage.wireBytes)
	log.Printf("Own state coverage: clients=%d min_updates=%d", coverage.ownClients, coverage.minOwnUpdates)
	first, last := commonStateWindow(observations)
	if !first.IsZero() {
		log.Printf("Cohort interval coverage: clients=%d latest_first_ms=%d earliest_last_ms=%d common_active_ms=%d", *count, first.UnixMilli(), last.UnixMilli(), last.UnixMilli()-first.UnixMilli())
	} else {
		log.Printf("Cohort interval coverage: clients=%d latest_first_ms=0 earliest_last_ms=0 common_active_ms=0", *count)
	}
	log.Printf("Admission coverage: authenticated=%d failed=%d max_registration_ms=%d max_login_ms=%d max_join_ms=%d",
		metrics.authenticated.Load(), metrics.admissionErrors.Load(), coverage.maxRegistration.Milliseconds(), coverage.maxLogin.Milliseconds(), coverage.maxJoin.Milliseconds())
	reads := summarizeReadFailures(observations)
	log.Printf("Read failure coverage: timeout=%d policy=%d abnormal=%d going_away=%d normal=%d protocol=%d too_big=%d server=%d eof=%d unknown=%d",
		reads[readFailureTimeout], reads[readFailurePolicy], reads[readFailureAbnormal], reads[readFailureGoingAway], reads[readFailureNormal], reads[readFailureProtocol], reads[readFailureTooBig], reads[readFailureServer], reads[readFailureEOF], reads[readFailureUnknown])
	var requestedRecoveries, completedRecoveries uint64
	var pendingRecoveries, failedRecoveries int
	for _, observation := range observations {
		requestedRecoveries += observation.recovery.requested
		completedRecoveries += observation.recovery.completed
		if observation.recovery.pending {
			pendingRecoveries++
		}
		if observation.recovery.failed {
			failedRecoveries++
		}
	}
	log.Printf("Recovery coverage: clients=%d requested=%d completed=%d pending=%d failed=%d", *count, requestedRecoveries, completedRecoveries, pendingRecoveries, failedRecoveries)
	casinoFailed := false
	if selectedScenario == "casino-slots" {
		var completed, bonuses, minimum, minimumPaid uint64
		var failures int
		for index, observation := range observations {
			completed += observation.casino.spins
			bonuses += observation.casino.bonuses
			if index == 0 || observation.casino.spins < minimum {
				minimum = observation.casino.spins
			}
			if index == 0 || observation.casino.paidSpins < minimumPaid {
				minimumPaid = observation.casino.paidSpins
			}
			if observation.casino.failed {
				failures++
			}
		}
		log.Printf("Casino coverage: clients=%d min_spins=%d min_paid_spins=%d completed_spins=%d completed_bonuses=%d failed=%d", *count, minimum, minimumPaid, completed, bonuses, failures)
		casinoFailed = failures != 0 || minimumPaid == 0
	}
	if selectedScenario == "casino-blackjack" || selectedScenario == "casino-house" || selectedScenario == "casino-poker" {
		var wagers, rounds, actions, minimum uint64
		var failures int
		for index, observation := range observations {
			wagers += observation.casino.wagers
			rounds += observation.casino.rounds
			actions += observation.casino.actions
			if index == 0 || observation.casino.rounds < minimum {
				minimum = observation.casino.rounds
			}
			if observation.casino.failed {
				failures++
			}
		}
		label := "Blackjack"
		if selectedScenario == "casino-house" {
			label = "House"
		}
		actionLabel := "observed_stands"
		if selectedScenario == "casino-poker" {
			label, actionLabel = "Poker", "observed_turns"
		}
		log.Printf("%s coverage: clients=%d accepted_wagers=%d completed_rounds=%d min_completed_rounds=%d %s=%d failed=%d", label, *count, wagers, rounds, minimum, actionLabel, actions, failures)
		casinoFailed = failures != 0 || minimum == 0
	}
	if selectedScenario == "combined" {
		results, valid := summarizeCombinedCasino(assignments, observations)
		for _, result := range results {
			log.Printf("Combined casino coverage: scenario=%s clients=%d accepted_wagers=%d paid_results=%d min_paid_results=%d observed_actions=%d completed_bonuses=%d failed=%d", result.scenario, result.clients, result.wagers, result.paid, result.minimum, result.observedActions, result.bonuses, result.failed)
			log.Printf("Combined casino rejection coverage: scenario=%s busy=%d stale=%d seat=%d rate=%d round_or_bet=%d rejected=%d timeout=%d other=%d", result.scenario, result.failures[casinoFailureBusy], result.failures[casinoFailureStale], result.failures[casinoFailureSeat], result.failures[casinoFailureRate], result.failures[casinoFailureRoundOrBet], result.failures[casinoFailureRejected], result.failures[casinoFailureTimeout], result.failures[casinoFailureUnknown])
			log.Printf("Combined casino timeout coverage: scenario=%s enter=%d sit=%d slot_spin=%d slot_bonus=%d blackjack_bet=%d blackjack_play=%d house_bet=%d poker_buy_in=%d poker_play=%d unknown=%d", result.scenario, result.timeouts[casinoTimeoutEnter], result.timeouts[casinoTimeoutSit], result.timeouts[casinoTimeoutSpin], result.timeouts[casinoTimeoutBonus], result.timeouts[casinoTimeoutBlackjackBet], result.timeouts[casinoTimeoutBlackjackPlay], result.timeouts[casinoTimeoutHouseBet], result.timeouts[casinoTimeoutPokerBuyIn], result.timeouts[casinoTimeoutPokerPlay], result.timeouts[casinoTimeoutUnknown])
			log.Printf("Combined casino rejected action coverage: scenario=%s enter=%d sit=%d slot_spin=%d slot_bonus=%d blackjack_bet=%d blackjack_play=%d house_bet=%d poker_buy_in=%d poker_play=%d unknown=%d", result.scenario, result.rejectedActions[casinoTimeoutEnter], result.rejectedActions[casinoTimeoutSit], result.rejectedActions[casinoTimeoutSpin], result.rejectedActions[casinoTimeoutBonus], result.rejectedActions[casinoTimeoutBlackjackBet], result.rejectedActions[casinoTimeoutBlackjackPlay], result.rejectedActions[casinoTimeoutHouseBet], result.rejectedActions[casinoTimeoutPokerBuyIn], result.rejectedActions[casinoTimeoutPokerPlay], result.rejectedActions[casinoTimeoutUnknown])
		}
		log.Printf("Combined workload: clients=%d party_clients=%d poker_clients=%d blackjack_clients=%d house_clients=%d slots_clients=%d town_clients=%d social_clients=%d", *count, *count/5, *count/10, *count/5, *count/5, *count/10, *count/10, *count/10)
		casinoFailed = !valid
	}
	if selectedScenario == "combined" || selectedScenario == "town" || selectedScenario == "social" {
		socialAssignments := assignments
		if selectedScenario != "combined" {
			socialAssignments = make([]botAssignment, len(observations))
			for i := range socialAssignments {
				socialAssignments[i] = botAssignment{scenario: selectedScenario, observeSocial: true}
			}
		}
		coverage, valid := summarizeSocial(socialAssignments, observations)
		log.Printf("Social coverage: clients=%d complete=%d failed=%d own_chat=%d own_presence=%d friends=%d guild=%d pvp=%d leaderboard=%d", coverage.clients, coverage.complete, coverage.failed, coverage.observed[0], coverage.observed[1], coverage.observed[2], coverage.observed[3], coverage.observed[4], coverage.observed[5])
		casinoFailed = casinoFailed || !valid
	}
	if selectedScenario == "party-combat" || selectedScenario == "combined" || selectedScenario == "party-dungeon" || selectedScenario == "party-raid" || selectedScenario == "party-event" {
		var formed, members, damage, heals, casts, denials, xp, deaths, minimum, failures uint64
		var roles [4]partyRoleCounts
		for index, party := range parties {
			counts := party.counts()
			if selectedScenario == "combined" && counts.minImpacts == 0 {
				for role, evidence := range counts.roles {
					activity := evidence.activity
					log.Printf("Party incomplete role: group=%d role=%d min_impacts=%d damage_events=%d heal_events=%d accepted_casts=%d unmatched_damage_events=%d regroup_steps=%d cohort_wait_steps=%d no_target_steps=%d pursuit_steps=%d", index, role, evidence.minImpacts, evidence.damage, evidence.heals, evidence.casts, evidence.unmatchedDamage, activity.regroup, activity.cohortWait, activity.noTarget, activity.pursuit)
				}
			}
			for role := range roles {
				roles[role].merge(counts.roles[role])
			}
			if counts.formed {
				formed++
			}
			if counts.failed {
				failures++
			}
			members += counts.members
			damage += counts.damage
			heals += counts.heals
			casts += counts.casts
			denials += counts.denials
			xp += counts.xpUpdates
			deaths += counts.deaths
			if index == 0 || counts.minImpacts < minimum {
				minimum = counts.minImpacts
			}
		}
		log.Printf("Party coverage: groups=%d formed=%d members=%d min_impacts=%d damage_events=%d heal_events=%d accepted_casts=%d denied_casts=%d xp_progress_updates=%d observed_deaths=%d failed=%d", len(parties), formed, members, minimum, damage, heals, casts, denials, xp, deaths, failures)
		for role, counts := range roles {
			log.Printf("Party role coverage: class=%s participants=%d confirmed=%d min_impacts=%d damage_events=%d heal_events=%d accepted_casts=%d denied_casts=%d unmatched_damage_events=%d", partyLoadClasses[role], counts.participants, counts.confirmed, counts.minImpacts, counts.damage, counts.heals, counts.casts, counts.denials, counts.unmatchedDamage)
			activity := counts.activity
			log.Printf("Party activity coverage: class=%s pending_cast_steps=%d regroup_steps=%d cohort_wait_steps=%d no_target_steps=%d pursuit_steps=%d", partyLoadClasses[role], activity.pendingCast, activity.regroup, activity.cohortWait, activity.noTarget, activity.pursuit)
		}
		expectedMembers := *count
		if selectedScenario == "combined" {
			expectedMembers /= 5
		}
		casinoFailed = casinoFailed || failures != 0 || formed != uint64(len(parties)) || members != uint64(expectedMembers) || minimum == 0
		for index, party := range parties {
			if code := party.failureCode(); code != "none" {
				log.Printf("Failure coverage: group=%d stage=%s", index, code)
			}
		}
	}
	if selectedScenario == "party-dungeon" || selectedScenario == "party-raid" {
		var entered, cleared, exited, rooms, bosses, reentries, checkpointReturns uint64
		for _, party := range parties {
			counts := party.dungeonCounts()
			entered += counts.entered
			cleared += counts.cleared
			exited += counts.exited
			rooms += counts.rooms
			bosses += counts.bosses
			reentries += counts.reentries
			checkpointReturns += counts.checkpointReturns
		}
		log.Printf("Dungeon coverage: groups=%d entered=%d cleared=%d exited=%d cleared_rooms=%d cleared_bosses=%d reentry_requests=%d checkpoint_returns=%d", len(parties), entered, cleared, exited, rooms, bosses, reentries, checkpointReturns)
		casinoFailed = casinoFailed || entered != uint64(*count) || cleared != uint64(*count) || exited != uint64(*count) || reentries != checkpointReturns
	}
	if selectedScenario == "party-raid" {
		counts := parties[0].raidCounts()
		casinoFailed = casinoFailed || !counts.converted || !counts.prepared || counts.readyMembers != uint64(*count)
		if *raidType == "weekly_raid" {
			weekly := parties[0].weeklyCounts()
			log.Printf("Weekly raid coverage: groups=1 converted=%t prepared=%t ready_members=%d phase_members=%d min_phase_views=%d", counts.converted, counts.prepared, counts.readyMembers, weekly.members, weekly.minimum)
			casinoFailed = casinoFailed || weekly.members != uint64(*count) || weekly.minimum != 4
		} else {
			log.Printf("Raid coverage: groups=1 converted=%t prepared=%t ready_members=%d restored=%d min_wave_views=%d", counts.converted, counts.prepared, counts.readyMembers, counts.restored, counts.minWaveViews)
			casinoFailed = casinoFailed || counts.restored != uint64(*count) || counts.minWaveViews != 3
		}
	}
	if selectedScenario == "party-event" {
		var selected, present, complete, exited, minimum uint64
		for i, party := range parties {
			counts := party.eventCounts()
			if counts.selected {
				selected++
			}
			present += counts.present
			complete += counts.complete
			exited += counts.exited
			if i == 0 || counts.minWaveViews < minimum {
				minimum = counts.minWaveViews
			}
		}
		log.Printf("Event coverage: groups=%d selected=%d present=%d completed=%d exited=%d min_wave_views=%d", len(parties), selected, present, complete, exited, minimum)
		casinoFailed = casinoFailed || selected != uint64(len(parties)) || present != uint64(*count) || complete != uint64(*count) || exited != uint64(*count) || minimum != 4
	}
	if metrics.joined.Load() != int64(*count) || metrics.readErrors.Load() != 0 ||
		metrics.writeErrors.Load() != 0 || metrics.decodeErrors.Load() != 0 || coverage.clients != uint64(*count) || coverage.ownClients != uint64(*count) ||
		pendingRecoveries != 0 || failedRecoveries != 0 || requestedRecoveries != completedRecoveries ||
		metrics.authenticated.Load() != int64(*count) || metrics.admissionErrors.Load() != 0 || casinoFailed {
		os.Exit(1)
	}
}

// A sent join request is not admission. Count only the first authoritative
// snapshot containing this player's own entity; other actors prove nothing.
func observeOwnAdmission(state map[string]Entity, playerID string, joined *bool) bool {
	if *joined || state[playerID].Type != "Player" {
		return false
	}
	*joined = true
	return true
}

func runBot(id int, urlStr string, cred BotCredentials, botScenario string, stop <-chan struct{}, observation *loadObservation, cohorts ...*partyLoad) {
	assignment := botAssignment{scenario: botScenario, index: id}
	if len(cohorts) > 0 {
		assignment.party = cohorts[0]
		assignment.preserveGear = cohorts[0] != nil
	}
	runAssignedBot(id, urlStr, cred, assignment, stop, observation)
}

func runAssignedBot(id int, urlStr string, cred BotCredentials, assignment botAssignment, stop <-chan struct{}, observation *loadObservation) {
	botScenario := assignment.scenario
	select {
	case <-stop:
		return
	default:
	}
	dialer := *websocket.DefaultDialer
	if *insecure {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	c, resp, err := dialer.Dial(urlStr, nil)
	if err != nil {
		if resp != nil {
			log.Printf("Bot %d dial error: %v, Status: %s", id, err, resp.Status)
		} else {
			log.Printf("Bot %d dial error: %v", id, err)
		}
		return
	}
	defer c.Close()
	c.SetReadLimit(8 << 20) // The test driver must not allocate unbounded peer frames.
	defer writeLocks.Delete(c)
	metrics.connected.Add(1)

	// State tracking
	var stateMu sync.RWMutex
	worldState := make(map[string]Entity)
	var inventory []Item
	isSelling := false
	myID := "player-" + cred.Username
	party := assignment.party
	if (botScenario == "party-combat" || botScenario == "party-dungeon" || botScenario == "party-raid" || botScenario == "party-event") && party == nil {
		metrics.admissionErrors.Add(1)
		return
	}
	memberIndex := assignment.index % 4
	if party != nil && party.raid != nil {
		memberIndex = assignment.index % len(party.members)
	}
	movement := &botMovement{}
	var casino *casinoLoad
	if botScenario == "casino-slots" {
		casino = newCasinoLoad(assignment.index)
	}
	if botScenario == "casino-blackjack" {
		casino = newBlackjackLoad(assignment.index, myID)
	}
	if botScenario == "casino-house" {
		casino = newHouseLoad(assignment.index, myID)
	}
	if botScenario == "casino-poker" {
		casino = newPokerLoad(assignment.index, myID)
	}
	var social *socialLoad
	if assignment.observeSocial {
		social = newSocialLoad(cred.Username, botScenario == "social")
	}

	// Movement State
	var roamTargetX, roamTargetZ float64
	var hasRoamTarget bool
	var lastRoamTime time.Time

	// Start reading messages to keep connection alive and handle server responses
	done := make(chan struct{})
	readerStopping := make(chan struct{})
	replies := make(chan admissionReply, 1)
	admitted := make(chan time.Time, 1)
	defer func() {
		close(readerStopping)
		_ = c.Close()
		<-done // Final coverage/errors are read only after the reader has stopped.
		observation.recovery = movement.counts()
		if casino != nil {
			observation.casino = casino.counts()
		}
		if social != nil {
			observation.social = social.counts()
		}
	}()
	go func() {
		defer close(done)
		joined := false
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				select {
				case <-stop:
				case <-readerStopping:
				default:
					metrics.readErrors.Add(1)
					observation.readFailure = classifyReadFailure(err)
				}
				return
			}
			observation.wireBytes += uint64(len(message)) // Payload bytes before gzip expansion, excluding WebSocket/TLS overhead.

			// Check for GZIP
			if len(message) > 2 && message[0] == 0x1f && message[1] == 0x8b {
				r, err := gzip.NewReader(bytes.NewReader(message))
				if err != nil {
					metrics.decodeErrors.Add(1)
					continue
				}
				decompressed, err := io.ReadAll(io.LimitReader(r, (8<<20)+1))
				r.Close()
				if err != nil || len(decompressed) > 8<<20 {
					metrics.decodeErrors.Add(1)
					continue
				}
				message = decompressed
			}

			if update, recognized, err := decodeStateFrame(message); recognized {
				if err != nil {
					metrics.decodeErrors.Add(1)
					log.Printf("Bot %d state frame decoding failed.", id)
					continue
				}
				stateMu.Lock()
				applyStateUpdate(worldState, update)
				movement.observeSequence(worldState[myID].MoveSequence)
				observation.state(worldState, myID, time.Now(), update.entities[myID].Type == "Player")
				if party != nil && update.entities[myID].Type == "Player" {
					party.state(memberIndex, worldState[myID], time.Now())
				}
				if update.entities[myID].Type == "Player" {
					movement.observePlayer(worldState[myID])
				}
				if observeOwnAdmission(worldState, myID, &joined) {
					metrics.joined.Add(1)
					admitted <- time.Now()
					log.Printf("Bot %d admitted by server.", id)
				}
				stateMu.Unlock()
				metrics.stateFrames.Add(1)
				continue
			}

			var msg Message
			if err := json.Unmarshal(message, &msg); err != nil || msg.Type == "" {
				metrics.decodeErrors.Add(1)
				continue
			}
			if msg.Type == "movement_context" {
				if !movement.updateContext(msg.Payload) {
					metrics.decodeErrors.Add(1)
				}
				continue
			}
			if social != nil && joined {
				if recognized, valid := social.receive(msg, time.Now()); recognized {
					if !valid {
						metrics.decodeErrors.Add(1)
					}
					continue
				}
			}
			if casino != nil && msg.Type == "casino_update" {
				if !casino.receive(msg.Payload) {
					metrics.decodeErrors.Add(1)
				}
				continue
			}
			if casino != nil && joined && (msg.Type == "casino_action_error" || msg.Type == "error") {
				casino.rejectServer(msg)
				continue
			}
			if party != nil && joined && msg.Type == "error" {
				party.rejectServer(msg.Payload)
				continue
			}
			if party != nil && (msg.Type == "party_request" || msg.Type == "party_update" || msg.Type == "ability_result" || msg.Type == "damage" || msg.Type == "heal" || party.raid != nil && (msg.Type == "chat" || msg.Type == "raid_phase") || party.event != nil && msg.Type == "public_event" || party.dungeon != nil && (msg.Type == "enter_instance" || msg.Type == "get_dungeon_status" || msg.Type == "dungeon_room_state")) {
				if !party.receive(memberIndex, msg, time.Now()) {
					metrics.decodeErrors.Add(1)
				}
				continue
			}
			if !joined {
				if reply, recognized := decodeAdmissionReply(msg); recognized {
					if reply.kind == "invalid_admission_response" {
						metrics.decodeErrors.Add(1)
					}
					select {
					case replies <- reply:
					default:
						metrics.admissionErrors.Add(1) // Unrequested duplicate/out-of-order replies cannot silently pass.
					}
					continue
				}
			}

			if msg.Type == "state" {
				var entities map[string]Entity
				if err := json.Unmarshal(msg.Payload, &entities); err == nil {
					stateMu.Lock()
					worldState = entities
					movement.observeSequence(worldState[myID].MoveSequence)
					observation.state(worldState, myID, time.Now(), entities[myID].Type == "Player")
					if party != nil && entities[myID].Type == "Player" {
						party.state(memberIndex, worldState[myID], time.Now())
					}
					if entities[myID].Type == "Player" {
						movement.observePlayer(worldState[myID])
					}
					if observeOwnAdmission(worldState, myID, &joined) {
						metrics.joined.Add(1)
						admitted <- time.Now()
						log.Printf("Bot %d admitted by server.", id)
					}
					stateMu.Unlock()
					metrics.stateFrames.Add(1)
				} else {
					metrics.decodeErrors.Add(1)
				}
			} else if msg.Type == "inventory" {
				var inv []Item
				if err := json.Unmarshal(msg.Payload, &inv); err == nil {
					stateMu.Lock()
					inventory = inv
					if casino != nil || party != nil || assignment.preserveGear {
						stateMu.Unlock()
						continue // Prepared class gear must not be swapped/sold by another workload.
					}

					// Check for upgrades immediately
					me, ok := worldState[myID]
					if ok {
						for _, item := range inv {
							if item.Slot == "" {
								continue
							}

							current, hasEquip := me.Equipment[item.Slot]

							// Simple score: Rarity * 1000 + Level
							getScore := func(i Item) int {
								r := 0
								switch i.Rarity {
								case "Legendary":
									r = 4
								case "Epic":
									r = 3
								case "Rare":
									r = 2
								case "Uncommon":
									r = 1
								}
								return r*1000 + i.Level
							}

							newScore := getScore(item)
							curScore := -1
							if hasEquip {
								curScore = getScore(current)
							}

							if newScore > curScore {
								// Equip it!
								send(c, "equip", map[string]string{"itemId": item.ID, "slot": item.Slot})
							}
						}
					}

					// Check if full (or nearly full) to trigger sell run
					count := 0
					for _, it := range inv {
						if it.ID != "" {
							count++
						}
					}
					if count >= 15 { // Start selling when mostly full
						isSelling = true
					} else if count == 0 {
						isSelling = false
					}
					stateMu.Unlock()
				} else {
					metrics.decodeErrors.Add(1)
				}
			}
		}
	}()

	rejectAdmission := func(err error) {
		if err != errLoadStopped {
			metrics.admissionErrors.Add(1)
			log.Printf("Bot %d startup admission failed (%s).", id, err.Error())
		}
	}
	// Prepared workloads require existing accounts/characters. A redundant
	// register request still hashes a password before duplicate detection and
	// can consume normal credential admission slots. Do not create or re-register
	// these accounts; ordinary login still proves the supplied credentials.
	if !assignment.preserveGear {
		registrationStart := time.Now()
		if send(c, "register", map[string]string{"username": cred.Username, "email": cred.Username + "@bot.com", "password": cred.Password}) != nil {
			rejectAdmission(fmt.Errorf("admission_write_failed"))
			return
		}
		if _, err := waitAdmissionReply("registered", replies, stop, done, *admissionTimeout); err != nil {
			rejectAdmission(err)
			return
		}
		observation.registrationTime = time.Since(registrationStart)
	}
	select {
	case <-stop:
		return
	default:
	}
	loginStart := time.Now()
	if send(c, "login", map[string]string{"username": cred.Username, "password": cred.Password}) != nil {
		rejectAdmission(fmt.Errorf("admission_write_failed"))
		return
	}
	authentication, err := waitAdmissionReply("authenticated", replies, stop, done, *admissionTimeout)
	if err != nil {
		rejectAdmission(err)
		return
	}
	observation.loginTime = time.Since(loginStart)
	metrics.authenticated.Add(1)
	select {
	case <-stop:
		return
	default:
	}

	// 3. Join Game
	archetypes := []string{"Fighter", "Rogue", "Wizard", "Cleric"}
	randomArchetype := archetypes[rand.Intn(len(archetypes))]
	if authentication.characterType != "" {
		randomArchetype = authentication.characterType // Match the existing character's kit; do not pretend it was reclassed.
	}
	if assignment.preserveGear && authentication.characterType == "" {
		rejectAdmission(fmt.Errorf("prepared_workload_requires_character"))
		return
	}
	if party != nil && authentication.characterType != partyLoadClasses[memberIndex%4] {
		party.reject()
		rejectAdmission(fmt.Errorf("party_requires_prepared_class"))
		return
	}

	joinPayload := map[string]string{
		"type": randomArchetype,
	}
	joinStart := time.Now()
	if send(c, "join", joinPayload) != nil {
		rejectAdmission(fmt.Errorf("admission_write_failed"))
		return
	}

	log.Printf("Bot %d requested %s admission.", id, randomArchetype)
	joinTimer := time.NewTimer(*admissionTimeout)
	defer joinTimer.Stop()
	select {
	case <-stop:
		return
	case <-done:
		rejectAdmission(fmt.Errorf("admission_connection_closed"))
		return
	case <-joinTimer.C:
		rejectAdmission(fmt.Errorf("admission_timeout"))
		return
	case <-replies:
		rejectAdmission(fmt.Errorf("admission_rejected"))
		return
	case ownStateAt := <-admitted:
		if ownStateAt.Before(joinStart) {
			rejectAdmission(fmt.Errorf("unexpected_admission_response"))
			return
		}
		observation.joinTime = ownStateAt.Sub(joinStart)
	}

	// Cooldowns
	var abilityCooldown time.Duration
	switch randomArchetype {
	case "Fighter":
		abilityCooldown = 5 * time.Second
	case "Wizard":
		abilityCooldown = 2 * time.Second
	case "Rogue":
		abilityCooldown = 1 * time.Second
	case "Cleric":
		abilityCooldown = 10 * time.Second
	}
	lastAbilityTime := time.Time{}
	recoveryRequested := false

	// 4. AI Loop
	ticker := time.NewTicker(200 * time.Millisecond) // Faster tick for smoother movement
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			if casino != nil {
				casino.awaitSettled(done, *admissionTimeout)
			}
			if party != nil {
				party.awaitCast(memberIndex, done, *admissionTimeout)
			}
			return
		case <-done:
			if casino != nil {
				casino.reject()
			}
			if party != nil {
				party.reject()
			}
			return
		case <-ticker.C:
			if movement.expire(time.Now(), *admissionTimeout) {
				if party != nil {
					party.rejectAt(movement.failure())
				}
				if casino != nil {
					casino.reject()
				}
				return // No repeated recovery or combat after missing nonce/town acknowledgement.
			}
			stateMu.RLock()
			me, ok := worldState[myID]
			// Copy state to avoid holding lock during logic
			currentState, currentInv := copyDecisionDetails(worldState, inventory, casino != nil)
			selling := isSelling
			stateMu.RUnlock()

			if !ok {
				continue // Wait until we exist
			}
			if me.Health <= 0 || me.State == "DEAD" {
				if !recoveryRequested {
					recoveryRequested = movement.respawn(c)
				}
				continue // Do not pretend dead actors are moving/fighting.
			}
			recoveryRequested = false
			if casino != nil {
				casino.play(c, movement, me, time.Now(), *casinoBet, *admissionTimeout)
				continue // No combat, sale, chat, equipment or other workloads while seated.
			}
			if party != nil {
				party.step(memberIndex, me, currentState, time.Now(), *admissionTimeout,
					func(kind string, payload interface{}) error {
						if kind == "recall" {
							if movement.recover(c, kind) {
								return nil
							}
							return fmt.Errorf("recovery_request_unavailable")
						}
						return send(c, kind, payload)
					},
					func(x, z float64) { movement.move(c, me, x, z) })
				if botScenario == "party-dungeon" || botScenario == "party-raid" {
					if party.counts().failed || party.dungeonCounts().exited == uint64(len(party.members)) {
						return
					}
				}
				if botScenario == "party-event" && (party.counts().failed || party.eventCounts().exited == uint64(len(party.members))) {
					return
				}
				continue // Preserve prepared gear: no sale, auto-equipment, pickup or unrelated actions.
			}

			// 1. Selling Logic
			if selling {
				// Town Center is (0, 200)
				dx := me.X - 0
				dz := me.Z - 200
				distFromTown := math.Sqrt(dx*dx + dz*dz)

				if distFromTown < 80.0 {
					// Sell everything in inventory (since we auto-equip upgrades, inventory is junk)
					for _, item := range currentInv {
						if item.ID != "" {
							send(c, "sell", map[string]string{"itemId": item.ID})
						}
					}
					// Reset selling flag locally (will be confirmed by empty inventory update)
					stateMu.Lock()
					isSelling = false
					stateMu.Unlock()
				} else {
					// Move to random spot in town (0, 200) to avoid stacking
					// Town bounds approx -100 to 100 X, 100 to 300 Z
					targetX := (rand.Float64() * 160) - 80     // -80 to 80
					targetZ := 200 + (rand.Float64()*160 - 80) // 120 to 280
					movement.move(c, me, targetX, targetZ)
				}
				continue
			}

			// Town and social scenarios exercise presence, bounded chat, and
			// read-heavy feature registries without manufacturing combat load.
			if botScenario == "town" || botScenario == "social" {
				if social != nil {
					social.step(time.Now(), func(kind string, payload interface{}) error { return send(c, kind, payload) })
				}
				if botScenario == "social" && rand.Intn(75) == 0 {
					send(c, "social", map[string]interface{}{})
					send(c, "friend_list", map[string]interface{}{})
					send(c, "guild_get", map[string]interface{}{})
					send(c, "pvp_get", map[string]interface{}{})
					send(c, "guild_leaderboard", map[string]interface{}{"dungeonType": "umbral_nexus", "difficulty": "mythic", "runLevel": 100})
				}
				// Announce presence occasionally
				if rand.Intn(100) == 0 {
					send(c, "chat", map[string]string{"channel": "world", "message": fmt.Sprintf("I am roaming at %.1f, %.1f", me.X, me.Z)})
				}

				// Pick new target if needed
				if !hasRoamTarget || time.Since(lastRoamTime) > 10*time.Second {
					roamTargetX = (rand.Float64() * 160) - 80     // -80 to 80
					roamTargetZ = 200 + (rand.Float64()*160 - 80) // 120 to 280
					hasRoamTarget = true
					lastRoamTime = time.Now()
				}

				// Walk towards target
				speed := 6.0
				dt := 0.2 // 200ms
				step := speed * dt

				dx := roamTargetX - me.X
				dz := roamTargetZ - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist < step {
					movement.move(c, me, roamTargetX, roamTargetZ)
					hasRoamTarget = false
				} else {
					newX := me.X + (dx/dist)*step
					newZ := me.Z + (dz/dist)*step
					movement.move(c, me, newX, newZ)
				}
				continue
			}

			var target *Entity
			var loot *Entity
			minDist := 1000.0
			minLootDist := 1000.0

			for _, e := range currentState {
				if e.ID == myID {
					continue
				}
				dx := e.X - me.X
				dz := e.Z - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if e.Type == "Enemy" && e.Health > 0 {
					if dist < minDist {
						minDist = dist
						t := e
						target = &t
					}
				} else if e.Type == "Loot" {
					if dist < minLootDist {
						minLootDist = dist
						l := e
						loot = &l
					}
				}
			}

			// Decision
			if loot != nil && minLootDist < 20.0 {
				// Go for loot
				if minLootDist < 2.0 {
					send(c, "pickup", map[string]string{"lootId": loot.ID})
				} else {
					// Move to loot
					movement.move(c, me, loot.X, loot.Z)
				}
				hasRoamTarget = false
			} else if target != nil && minDist < 30.0 {
				// Fight
				hasRoamTarget = false

				// Use ability on cooldown if in range
				if minDist < 15.0 && time.Since(lastAbilityTime) >= abilityCooldown {
					abilityPayload := map[string]interface{}{
						"targetX":  target.X,
						"targetZ":  target.Z,
						"targetId": target.ID,
					}
					send(c, "ability", abilityPayload)
					lastAbilityTime = time.Now()
				} else if minDist < 4.0 {
					send(c, "attack", map[string]string{"targetId": target.ID})
				} else {
					// Chase / Combat Movement
					// Add some "stutter" or strafing to look more human
					// Instead of moving directly to target, move slightly offset
					angle := math.Atan2(target.Z-me.Z, target.X-me.X)

					// If we are very close, maybe back up a bit if we are ranged?
					// For now, just simple chase with noise
					noise := (rand.Float64() - 0.5) * 0.5 // +/- 0.25 rad
					moveAngle := angle + noise

					// Move towards target but with noise
					tx := me.X + math.Cos(moveAngle)*5.0
					tz := me.Z + math.Sin(moveAngle)*5.0

					movement.move(c, me, tx, tz)
				}
			} else {
				// Roam based on Level
				// Sector 1: Z [200, 1000] (Lvl 1-10)
				// Sector 2: Z [-600, 200] (Lvl 10-30)
				// Sector 3: Z [-1000, -600] (Lvl 30-50) - Sirens
				// Sector 4: Z [-1400, -1000] (Lvl 50+) - Frost Guardians

				var minZ, maxZ float64
				if me.Level < 10 {
					minZ, maxZ = 200, 1000
				} else if me.Level < 30 {
					minZ, maxZ = -600, 200
				} else if me.Level < 50 {
					minZ, maxZ = -1000, -600
				} else {
					minZ, maxZ = -1400, -1000
				}

				// Check if we are in our sector
				if me.Z < minZ || me.Z > maxZ {
					if !hasRoamTarget {
						// Move to random spot in sector
						roamTargetZ = minZ + rand.Float64()*(maxZ-minZ)
						roamTargetX = (rand.Float64() * 1800) - 900
						hasRoamTarget = true
					}
				} else {
					// Roaming Logic with Waypoints
					if !hasRoamTarget || time.Since(lastRoamTime) > 5*time.Second {
						// Pick new waypoint
						roamTargetX = me.X + (rand.Float64()*100 - 50)
						roamTargetZ = me.Z + (rand.Float64()*100 - 50)

						// Clamp
						if roamTargetX < -950 {
							roamTargetX = -950
						}
						if roamTargetX > 950 {
							roamTargetX = 950
						}
						if roamTargetZ < minZ {
							roamTargetZ = minZ
						}
						if roamTargetZ > maxZ {
							roamTargetZ = maxZ
						}

						hasRoamTarget = true
						lastRoamTime = time.Now()
					}
				}

				// Walk towards target
				speed := 6.0
				dt := 0.2 // 200ms
				step := speed * dt

				dx := roamTargetX - me.X
				dz := roamTargetZ - me.Z
				dist := math.Sqrt(dx*dx + dz*dz)

				if dist < step {
					movement.move(c, me, roamTargetX, roamTargetZ)
					hasRoamTarget = false
				} else {
					newX := me.X + (dx/dist)*step
					newZ := me.Z + (dz/dist)*step
					movement.move(c, me, newX, newZ)
				}
			}
		}
	}
}

var writeLocks sync.Map

func send(c *websocket.Conn, msgType string, payload interface{}) error {
	pBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	msg := Message{
		Type:    msgType,
		Payload: pBytes,
	}

	lock, _ := writeLocks.LoadOrStore(c, &sync.Mutex{})
	writeMu := lock.(*sync.Mutex)
	writeMu.Lock()
	defer writeMu.Unlock()
	if err := c.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
		metrics.writeErrors.Add(1)
		return err
	}
	if err := c.WriteJSON(msg); err != nil {
		metrics.writeErrors.Add(1)
		return err
	}
	return nil
}
