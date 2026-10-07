package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Read actual first/last own-view intersection from independently launched
// drivers, not their requested durations or a sum of clients from separate runs.
func cohortInterval(output string, count int) (int64, int64, bool) {
	pattern := regexp.MustCompile(`(?m)Cohort interval coverage: clients=(\d+) latest_first_ms=(\d+) earliest_last_ms=(\d+) common_active_ms=(\d+)$`)
	rows := pattern.FindAllStringSubmatch(output, -1)
	if len(rows) != 1 || strings.Count(output, "Cohort interval coverage:") != 1 {
		return 0, 0, false
	}
	values := make([]int64, 4)
	for i := range values {
		value, err := strconv.ParseInt(rows[0][i+1], 10, 64)
		if err != nil {
			return 0, 0, false
		}
		values[i] = value
	}
	return values[1], values[2], values[0] == int64(count) && values[1] > 0 && values[2] > values[1] && values[2]-values[1] >= 108000 && values[3] == values[2]-values[1]
}

func TestCohortIntervalRejectsMissingDuplicateAndNonSustainedEvidence(t *testing.T) {
	valid := "Cohort interval coverage: clients=80 latest_first_ms=100000 earliest_last_ms=220000 common_active_ms=120000"
	if first, last, ok := cohortInterval(valid, 80); !ok || first != 100000 || last != 220000 {
		t.Fatal("valid intersection rejected")
	}
	for _, invalid := range []string{"", valid + "\n" + valid, strings.Replace(valid, "clients=80", "clients=79", 1),
		strings.Replace(valid, "earliest_last_ms=220000", "earliest_last_ms=200000", 1), strings.Replace(valid, "latest_first_ms=100000", "latest_first_ms=0", 1)} {
		if _, _, ok := cohortInterval(invalid, 80); ok {
			t.Fatal("incomplete concurrency evidence accepted")
		}
	}
}

// Both startup isolation and full qualification use this exact original save
// population. Isolation cannot silently replace gear, classes or spawn sites.
func loadPreparedCohortFixtures(t *testing.T, repo *database.DB, definition game.ElementalRaidDefinition, site game.PublicEventSite) ([]*database.Character, []map[string]string) {
	t.Helper()
	fixtures := make([]*database.Character, 100)
	credentials := make([]map[string]string, 100)
	for index := range fixtures {
		var fixture *database.Character
		var password string
		switch {
		case index < 80 && index%20 < 4:
			fixture, password = loadPreparedPartyFixture(t, repo, index%20)
		case index >= 80 && index < 85:
			fixture, password = loadPreparedPartyFixture(t, repo, (index-80)%4)
			fixture.X, fixture.Z = -1.25+float64(index-80), 200
			fixture.Quests = []database.Quest{
				{ID: definition.RequiredDungeonQuest, Accepted: true, Completed: true, Count: 1, MaxCount: 1},
				{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget, Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 1},
			}
		case index >= 85 && index < 89:
			fixture, password = loadPreparedClassFixture(t, repo, index-85, site.Level)
			fixture.Resources.Health = 10000 // Normal login clamps to build-derived max.
			fixture.X, fixture.Z = site.X+float64(index-85), site.Z
		default:
			fixture, password = resourceJournalFixture(t, repo)
			fixture.EP, fixture.Gold, fixture.X, fixture.Z = 43, 100000, 0, 180
			if index >= 89 || index%20 >= 16 {
				fixture.X, fixture.Z = float64(index%20)*2, 200
			}
			fixture.Resources.Health = 100
			fixture.Inventory = []database.Item{{ID: "cohort-keep-bag", Name: "Cohort preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, Value: 9999, StatScaleVersion: game.ItemStatScaleVersion}}
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not save disposable starting fixture")
		}
		fixtures[index], credentials[index] = fixture, map[string]string{"username": fixture.Name, "password": password}
	}
	return fixtures, credentials
}

// This is one normal API/database and100 distinct prepared accounts:80 existing
// combined-role clients,5 Earth raiders,4 Root defenders and11 town clients.
// No controller/power/population changes. Run only near an actual Root window.
func TestLoadCohortActual100MixedRaidEventAndSaves(t *testing.T) {
	if os.Getenv("EIDOLON_LOAD_COHORT_FULL") != "1" {
		t.Skip("explicit natural-clock integrated100-player load only")
	}
	period := int64(game.PublicEventPeriod / time.Second)
	now := time.Now()
	root := time.Unix((now.Unix()/(4*period))*4*period, 0)
	if now.Sub(root) > 40*time.Second {
		root = root.Add(4 * game.PublicEventPeriod)
	}
	if root.Sub(now) > 3*time.Minute {
		t.Skip("requires nearby natural Root window; no long wait or clock override")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver binary")
	}
	definition, _ := game.ElementalRaidDefinitionForType("earth_crystal_raid")
	site := game.PublicEventSites()[0]
	fixtures, credentials := loadPreparedCohortFixtures(t, repo, definition, site)
	if delay := time.Until(root); delay > 0 {
		if delay > 3*time.Minute {
			t.Fatal("unexpected natural-clock delay")
		}
		t.Logf("Cohort schedule: waiting_ms=%d", delay.Milliseconds())
		time.Sleep(delay)
	}
	if time.Since(root) > 40*time.Second {
		t.Skip("fixture preparation missed natural announcement; no late or accelerated event")
	}
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 21*time.Minute)
	defer cancel()
	type result struct {
		label  string
		count  int
		output []byte
		err    error
	}
	done := make(chan result, 4)
	started := time.Now()
	for _, group := range []struct {
		label      string
		start, end int
		args       []string
	}{
		{"combined", 0, 80, []string{"-scenario", "combined", "-duration", "120s", "-casino-bet", "100", "-party-combat-x", "400", "-party-combat-z", "600"}},
		{"raid", 80, 85, []string{"-scenario", "party-raid", "-duration", "20m", "-raid-type", definition.Type}},
		{"event", 85, 89, []string{"-scenario", "party-event", "-duration", "9m", "-event-site", site.ID}},
		{"town", 89, 100, []string{"-scenario", "town", "-duration", "120s"}},
	} {
		encoded, err := json.Marshal(credentials[group.start:group.end])
		if err != nil {
			t.Fatal("could not encode disposable credentials")
		}
		path := filepath.Join(t.TempDir(), "credentials.json")
		if os.WriteFile(path, encoded, 0600) != nil {
			t.Fatal("could not store disposable credentials")
		}
		args := []string{"-addr", address, "-scheme", "ws", "-n", strconv.Itoa(group.end - group.start), "-credentials-file", path, "-admission-timeout", "5s"}
		command := exec.CommandContext(ctx, driver, append(args, group.args...)...)
		go func(label string, count int) {
			output, err := command.CombinedOutput()
			done <- result{label, count, output, err}
		}(group.label, group.end-group.start)
	}
	// Fixed timing sums during the declared100-client overlap, not a mean diluted
	// by later raid-only play. Actual reader intervals below independently verify it.
	phaseTimer := time.NewTimer(10 * time.Second)
	defer phaseTimer.Stop()
	phase := 0
	latestFirst, earliestLast := int64(0), int64(0)
	for remaining := 4; remaining > 0; {
		select {
		case <-phaseTimer.C:
			value, err := readCombinedPhaseEvidence(address)
			if err != nil {
				t.Fatal("cohort phase measurement unavailable")
			}
			t.Logf("Cohort phase measurements: stage=%d counters=%s", phase, value)
			phase++
			if phase == 1 {
				phaseTimer.Reset(100 * time.Second)
			}
		case run := <-done:
			remaining--
			output := string(run.output)
			for _, evidence := range loadAdmissionDiagnostics(output) {
				t.Logf("Cohort group=%s %s", run.label, evidence)
			}
			for _, line := range strings.Split(output, "\n") {
				for _, evidence := range encounterLoadDiagnostics(line) {
					t.Logf("Cohort group=%s %s", run.label, evidence)
				}
				if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Cohort interval coverage|Admission coverage|Recovery coverage|Party coverage|Social coverage|Combined casino coverage|Dungeon coverage|Raid coverage|Event coverage): [a-z_0-9= -]+$`).FindString(line); match != "" {
					t.Logf("Cohort group=%s %s", run.label, match)
				}
			}
			if run.err != nil {
				t.Fatalf("cohort %s driver failed; raw synthetic logs omitted", run.label)
			}
			if !combinedIntegrationViewCoverage(output, run.count) || !strings.Contains(output, fmt.Sprintf("Load summary: connected=%d joined=%d", run.count, run.count)) || !strings.Contains(output, "read_errors=0 write_errors=0 decode_errors=0") {
				t.Fatalf("cohort %s lacks complete sustained own-state coverage", run.label)
			}
			first, last, ok := cohortInterval(output, run.count)
			if !ok {
				t.Fatalf("cohort %s lacks sustained actual interval", run.label)
			}
			if first > latestFirst {
				latestFirst = first
			}
			if earliestLast == 0 || last < earliestLast {
				earliestLast = last
			}
			switch run.label {
			case "combined":
				if !regexp.MustCompile(`Party coverage: groups=4 formed=4 members=16 min_impacts=[1-9][0-9]* damage_events=[1-9][0-9]* heal_events=[1-9][0-9]*`).MatchString(output) || !strings.Contains(output, "Social coverage: clients=16 complete=16 failed=0") {
					t.Fatal("mixed cohort lacks every-member combat/healing/social outcomes")
				}
				for scenario, count := range map[string]int{"casino-slots": 8, "casino-blackjack": 16, "casino-house": 16, "casino-poker": 8} {
					pattern := fmt.Sprintf(`Combined casino coverage: scenario=%s clients=%d accepted_wagers=[1-9][0-9]* paid_results=[1-9][0-9]* min_paid_results=[1-9][0-9]* observed_actions=[0-9]+ completed_bonuses=[0-9]+ failed=0`, scenario, count)
					if !regexp.MustCompile(pattern).MatchString(output) {
						t.Fatal("casino cohort lacks every-member paid outcomes")
					}
				}
			case "raid":
				if !strings.Contains(output, "Raid coverage: groups=1 converted=true prepared=true ready_members=5 restored=5 min_wave_views=3") || !strings.Contains(output, "Dungeon coverage: groups=1 entered=5 cleared=5 exited=5 cleared_rooms=3 cleared_bosses=1") {
					t.Fatal("raid cohort lacks earned full assault/Vigil/town exit")
				}
			case "event":
				if !strings.Contains(output, "Event coverage: groups=1 selected=1 present=4 completed=4 exited=4 min_wave_views=4") {
					t.Fatal("event cohort lacks every-member waves/completion/town exit")
				}
			}
		}
	}
	if phase != 2 || earliestLast-latestFirst < 108000 {
		t.Fatal("separate client lifetimes did not establish sustained simultaneous100-player load")
	}
	t.Logf("Cohort concurrency coverage: clients=100 common_active_ms=%d", earliestLast-latestFirst)
	stop()
	sharedVictory := ""
	for index, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) || actual.Class != fixture.Class || actual.EP != fixture.EP || actual.Gold < 0 || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) {
			t.Fatal("cohort lacks fresh preserved ordinary character save")
		}
		if index >= 80 && index < 89 && actual.InstanceID != "" {
			t.Fatal("raid/event participant lacks saved normal town exit")
		}
		preserved := false
		for _, item := range actual.Inventory {
			if reflect.DeepEqual(item, fixture.Inventory[0]) {
				preserved = true
			}
		}
		if !preserved {
			t.Fatal("cohort lost protected bag fixture")
		}
		combat := index < 80 && index%20 < 4 || index >= 80 && index < 89
		if combat && (actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP) {
			t.Fatal("combat participant lacks independently saved progression")
		}
		if index < 80 && index%20 >= 4 && index%20 < 16 && len(actual.CasinoWalletCheckpoints) == 0 {
			t.Fatal("casino participant lacks durable wallet checkpoint")
		}
		if index >= 89 || index < 80 && index%20 >= 16 {
			if actual.Gold != fixture.Gold {
				t.Fatal("town/social participant bankroll changed")
			}
		}
		if index >= 80 && index < 85 {
			repaired := false
			for _, quest := range actual.Quests {
				if quest.ID == definition.RestoredQuest {
					repaired = quest.Accepted && !quest.Completed && quest.Count == 1 && quest.MaxCount == 1 && quest.GrantedGold == 0 && quest.GrantedXP == 0 && quest.GrantedResonanceXP == 0
				}
			}
			if !repaired {
				t.Fatal("raid repair readiness not durably saved or auto-rewarded")
			}
			victories := 0
			for id := range actual.ItemDeliveryReceipts {
				if !strings.HasPrefix(id, "bossvictory:") {
					continue
				}
				record, err := repo.GetBossVictory(id)
				if err != nil || record == nil || record.Validate() != nil || record.State != database.BossVictoryComplete || record.DungeonType != definition.Type || record.RunLevel != definition.RequiredLevel || !database.BossVictoryCharacterReceiptMatches(actual, record.BossVictoryOperation) {
					t.Fatal("raid boss reward lacks matching durable original receipt")
				}
				if index == 80 {
					sharedVictory = id
				} else if id != sharedVictory {
					t.Fatal("raid members saved different original victories")
				}
				victories++
			}
			if victories != 1 {
				t.Fatal("raid member lacks exactly one original boss credit")
			}
		}
	}
	t.Logf("Cohort saved coverage: clients=100 independent_fresh_saves=100 elapsed_ms=%d", time.Since(started).Milliseconds())
}
