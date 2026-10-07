package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

// A short, explicitly disposable startup diagnostic. Four simultaneous driver
// processes retain their ordinary100ms connection stagger and5s admission
// deadlines. This does not substitute for sustained100-player/encounter/save
// qualification or permit retries, relaxed guards or production auth changes.
func TestLoadActualFourGroupAdmissionDiagnostic(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	groups := make([][]map[string]string, 4)
	for group := range groups {
		groups[group] = make([]map[string]string, 4)
		for index := range groups[group] {
			fixture, password := resourceJournalFixture(t, repo)
			groups[group][index] = map[string]string{"username": fixture.Name, "password": password}
		}
	}
	runLoadAdmissionGroups(t, uri, binary, groups)
}

// Exactly100 original cohort saves and80/5/4/11 group sizes. Only startup is
// exercised; no paid/combat/event outcome,108s common-reader or save credit.
func TestLoadActualCohort100AdmissionDiagnostic(t *testing.T) {
	if os.Getenv("EIDOLON_ADMISSION_COHORT100") != "1" {
		t.Skip("explicit short100-character startup diagnostic only")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	definition, _ := game.ElementalRaidDefinitionForType("earth_crystal_raid")
	_, credentials := loadPreparedCohortFixtures(t, repo, definition, game.PublicEventSites()[0])
	runLoadAdmissionGroups(t, uri, binary, [][]map[string]string{credentials[:80], credentials[80:85], credentials[85:89], credentials[89:]})
}

func runLoadAdmissionGroups(t *testing.T, uri, binary string, groups [][]map[string]string) {
	t.Helper()
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver path")
	}
	paths := make([]string, len(groups))
	for group, credentials := range groups {
		encoded, err := json.Marshal(credentials)
		if err != nil {
			t.Fatal("could not encode disposable credentials")
		}
		paths[group] = filepath.Join(t.TempDir(), "credentials.json")
		if os.WriteFile(paths[group], encoded, 0600) != nil {
			t.Fatal("could not store disposable credentials")
		}
	}
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	type result struct {
		group  int
		output []byte
		err    error
	}
	done := make(chan result, len(paths))
	for group, path := range paths {
		command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "town", "-n", fmt.Sprint(len(groups[group])),
			"-credentials-file", path, "-duration", "2s", "-admission-timeout", "5s")
		go func() {
			output, err := command.CombinedOutput()
			done <- result{group, output, err}
		}()
	}
	// Collect every group's closed diagnostic even when another group failed.
	// Raw output can contain credentials/IDs and must never enter the receipt.
	summary := regexp.MustCompile(`(?:Load summary|Admission coverage): [a-z_0-9= -]+$`)
	for range paths {
		run := <-done
		output := string(run.output)
		for _, evidence := range loadAdmissionDiagnostics(output) {
			t.Logf("Admission diagnostic group=%d %s", run.group, evidence)
		}
		for _, line := range strings.Split(output, "\n") {
			if evidence := summary.FindString(line); evidence != "" {
				t.Logf("Admission diagnostic group=%d %s", run.group, evidence)
			}
		}
		count := len(groups[run.group])
		if run.err != nil || !strings.Contains(output, fmt.Sprintf("Load summary: connected=%d joined=%d", count, count)) ||
			!strings.Contains(output, fmt.Sprintf("Admission coverage: authenticated=%d failed=0", count)) {
			t.Errorf("admission diagnostic group=%d lacks all%d ordinary admissions; raw output omitted", run.group, count)
		}
	}
	stop()
}
