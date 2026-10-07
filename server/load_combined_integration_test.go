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

func combinedIntegrationClientCount(value string) (int, error) {
	if value == "" {
		return 20, nil
	}
	count, err := strconv.Atoi(value)
	if err != nil || count < 20 || count > 100 || count%20 != 0 {
		return 0, fmt.Errorf("combined integration requires 20–100 clients in blocks of twenty")
	}
	return count, nil
}

// Predeclare five fresh views/sec over120s and90% of the active window for
// every client. Aggregate frames or a single successful update are insufficient.
func combinedIntegrationViewCoverage(output string, count int) bool {
	patterns := []string{
		`(?m)State coverage: clients=(\d+) min_frames=(\d+) min_active_ms=(\d+) max_gap_ms=(\d+) wire_bytes=(\d+)$`,
		`(?m)Own state coverage: clients=(\d+) min_updates=(\d+)$`,
	}
	labels := []string{"State coverage:", "Own state coverage:"}
	for i, pattern := range patterns {
		matches := regexp.MustCompile(pattern).FindAllStringSubmatch(output, -1)
		if len(matches) != 1 || strings.Count(output, labels[i]) != 1 {
			return false
		}
		values := make([]uint64, len(matches[0])-1)
		for j, value := range matches[0][1:] {
			parsed, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return false
			}
			values[j] = parsed
		}
		if values[0] != uint64(count) || values[1] < 600 {
			return false
		}
		if i == 0 && (values[2] < 108000 || values[4] == 0) {
			return false
		}
	}
	return true
}

// An explicitly selected cohort shares one normal server/DB. Default twenty
// retains the earned baseline. Not a raid/event clear, renderer check, full
// settlement/restart or production100-player headroom/capacity promise.
func TestLoadCombinedActualConcurrentWorkloadsAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	count, err := combinedIntegrationClientCount(os.Getenv("EIDOLON_COMBINED_CLIENTS"))
	if err != nil {
		t.Fatal(err)
	}
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary path")
	}
	fixtures := make([]*database.Character, count)
	credentials := make([]map[string]string, count)
	for index := range fixtures {
		local := index % 20
		var fixture *database.Character
		var password string
		if local < 4 {
			fixture, password = loadPreparedPartyFixture(t, repo, local)
		} else {
			fixture, password = resourceJournalFixture(t, repo)
			fixture.EP, fixture.Gold = 43, 100000 // Explicit disposable initial bankroll.
			fixture.X, fixture.Z = 0, 180
			if local >= 16 {
				fixture.X, fixture.Z = float64(local-16)*2, 200
			}
			fixture.Resources.Health = 100
			fixture.Inventory = []database.Item{{ID: "combined-keep-bag", Name: "Combined preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, Value: 9999, StatScaleVersion: game.ItemStatScaleVersion}}
			if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
				t.Fatal("could not persist disposable prepared character")
			}
		}
		fixtures[index], credentials[index] = fixture, map[string]string{"username": fixture.Name, "password": password}
	}
	encoded, err := json.Marshal(credentials)
	if err != nil {
		t.Fatal("could not encode disposable credentials")
	}
	credentialPath := filepath.Join(t.TempDir(), "test-credentials.json")
	if err := os.WriteFile(credentialPath, encoded, 0600); err != nil {
		t.Fatal("could not store disposable credentials")
	}
	serverArgs := []string{"-save-journal-dir", t.TempDir()}
	if profile := os.Getenv("EIDOLON_COMBINED_CPU_PROFILE"); profile != "" {
		if !filepath.IsAbs(profile) {
			t.Fatal("owned profile requires an absolute private artifact path")
		}
		// Only a test-only profiling API accepts this flag. Default native
		// qualification still uses the ordinary uninstrumented API binary.
		serverArgs = append(serverArgs, "-qa-owned-cpu-profile", profile)
	}
	address, stop := compatStartServer(t, binary, uri, 179, serverArgs...)
	logPhases := func(stage string) {
		value, err := readCombinedPhaseEvidence(address)
		if err != nil {
			t.Logf("Combined phase measurements: stage=%s unavailable=true", stage)
			return
		}
		t.Logf("Combined phase measurements: stage=%s counters=%s", stage, value)
	}
	logPhases("before-driver")
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "combined", "-n", strconv.Itoa(count), "-credentials-file", credentialPath, "-casino-bet", "100", "-party-combat-x", "400", "-party-combat-z", "600", "-duration", "120s", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	logPhases("after-driver")
	// The driver already emits fixed startup failure codes. Preserve aggregate
	// causes without printing bot IDs, credentials or arbitrary socket output.
	for _, evidence := range loadAdmissionDiagnostics(string(output)) {
		t.Log(evidence)
	}
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Read failure coverage|Recovery coverage|Party coverage|Party incomplete role|Social coverage|Combined casino coverage|Combined casino rejection coverage|Combined casino timeout coverage|Combined casino rejected action coverage|Combined workload): [a-z_0-9= -]+$`).FindString(line); match != "" {
			t.Log(match) // Aggregate fields only; never raw credential/socket logs.
		}
		if match := combinedRoleEvidencePattern.FindString(line); match != "" {
			t.Log(match)
		}
		if match := regexp.MustCompile(`Party activity coverage: class=(?:Fighter|Cleric|Rogue|Wizard) pending_cast_steps=\d+ regroup_steps=\d+ cohort_wait_steps=\d+ no_target_steps=\d+ pursuit_steps=\d+$`).FindString(line); match != "" {
			t.Log(match) // Diagnostic only; never a replacement for owned impacts.
		}
	}
	if runErr != nil {
		t.Fatal("actual combined driver failed; raw synthetic socket logs omitted")
	}
	if !combinedIntegrationViewCoverage(string(output), count) {
		t.Fatal("missing complete sustained fresh-own state coverage for the declared cohort")
	}
	blocks := count / 20
	workload := fmt.Sprintf("Combined workload: clients=%d party_clients=%d poker_clients=%d blackjack_clients=%d house_clients=%d slots_clients=%d town_clients=%d social_clients=%d", count, 4*blocks, 2*blocks, 4*blocks, 4*blocks, 2*blocks, 2*blocks, 2*blocks)
	party := fmt.Sprintf(`Party coverage: groups=%d formed=%d members=%d min_impacts=[1-9][0-9]* damage_events=[1-9][0-9]* heal_events=[1-9][0-9]*`, blocks, blocks, 4*blocks)
	if !strings.Contains(string(output), workload) || !regexp.MustCompile(party).Match(output) {
		t.Fatal("missing configured roles, party impacts or real healing")
	}
	social := fmt.Sprintf("Social coverage: clients=%d complete=%d failed=0 own_chat=%d own_presence=%d friends=%d guild=%d pvp=%d leaderboard=%d", 4*blocks, 4*blocks, 4*blocks, 2*blocks, 2*blocks, 2*blocks, 2*blocks, 2*blocks)
	if !strings.Contains(string(output), social) {
		t.Fatal("missing every assigned town/social delivered outcome")
	}
	stop() // Normal disconnect/shutdown; table recovery remains authoritative.
	for index, fixture := range fixtures {
		local := index % 20
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) {
			t.Fatal("missing a fresh normal combined-workload character save")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || actual.Gold < 0 || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || !reflect.DeepEqual(actual.Inventory, fixture.Inventory) {
			t.Fatal("combined profile changed class, EP, equipped gear or preserved bag")
		}
		if local < 4 && (actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP) {
			t.Fatal("a party member has no persisted real-combat progression")
		}
		if local >= 4 && local < 16 && len(actual.CasinoWalletCheckpoints) == 0 {
			t.Fatal("an assigned casino client has no durable wallet checkpoint")
		}
		if local >= 16 && actual.Gold != fixture.Gold {
			t.Fatal("town/social activity mutated prepared inventory or bankroll")
		}
	}
	t.Logf("%d normal clients: party/healing, paid poker/blackjack/house/slots, town/social attempts and fresh preserved-gear saves; elapsed=%s; unfinished final casino rounds retained, not final-settlement/raid/event/production-capacity proof", count, time.Since(started).Round(time.Millisecond))
}

func TestCombinedIntegrationClientCount(t *testing.T) {
	for _, value := range []string{"", "20", "40", "60", "80", "100"} {
		count, err := combinedIntegrationClientCount(value)
		want := 20
		if value != "" {
			want, _ = strconv.Atoi(value)
		}
		if err != nil || count != want {
			t.Fatal("supported cohort rejected or changed", value)
		}
	}
	for _, value := range []string{"0", "19", "21", "101", "120", "-20", "invalid", "99999999999999999999999999"} {
		if count, err := combinedIntegrationClientCount(value); err == nil || count != 0 {
			t.Fatal("unsupported cohort accepted", value)
		}
	}
}

func TestCombinedIntegrationViewCoverage(t *testing.T) {
	valid := "State coverage: clients=100 min_frames=600 min_active_ms=108000 max_gap_ms=200 wire_bytes=1000\nOwn state coverage: clients=100 min_updates=600\n"
	if !combinedIntegrationViewCoverage(valid, 100) {
		t.Fatal("declared coverage boundary rejected")
	}
	for _, output := range []string{
		"", valid + valid,
		strings.Replace(valid, "clients=100", "clients=99", 1),
		strings.Replace(valid, "min_frames=600", "min_frames=599", 1),
		strings.Replace(valid, "min_active_ms=108000", "min_active_ms=107999", 1),
		strings.Replace(valid, "min_updates=600", "min_updates=599", 1),
		strings.Replace(valid, "wire_bytes=1000", "wire_bytes=0", 1),
		strings.Replace(valid, "wire_bytes=1000", "wire_bytes=999999999999999999999999999", 1),
		strings.Replace(valid, "min_frames=600", "min_frames=-1", 1),
		valid + "Own state coverage: incomplete\n",
	} {
		if combinedIntegrationViewCoverage(output, 100) {
			t.Fatal("partial/duplicate/starved/unsafe cohort coverage accepted")
		}
	}
}
