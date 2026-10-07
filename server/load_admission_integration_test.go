package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

// A short, explicitly disposable startup diagnostic. Four simultaneous driver
// processes retain their ordinary100ms connection stagger and5s admission
// deadlines. This does not substitute for sustained100-player/encounter/save
// qualification or permit retries, relaxed guards or production auth changes.
func TestLoadActualFourGroupAdmissionDiagnostic(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver path")
	}
	paths := make([]string, 4)
	for group := range paths {
		credentials := make([]map[string]string, 4)
		for index := range credentials {
			fixture, password := resourceJournalFixture(t, repo)
			credentials[index] = map[string]string{"username": fixture.Name, "password": password}
		}
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
		command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "town", "-n", "4",
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
		if run.err != nil || !strings.Contains(output, "Load summary: connected=4 joined=4") ||
			!strings.Contains(output, "Admission coverage: authenticated=4 failed=0") {
			t.Errorf("admission diagnostic group=%d lacks all four ordinary admissions; raw output omitted", run.group)
		}
	}
	stop()
}
