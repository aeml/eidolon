package main

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestMaintenanceActualPublishedLoginAndJump(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_MAINTENANCE_BROWSER_NODE"), os.Getenv("EIDOLON_MAINTENANCE_BROWSER_EVIDENCE")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) {
		t.Fatal("requires absolute browser Node and owned evidence paths")
	}
	type account struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Class    string `json:"characterClass"`
	}
	var accounts []account
	var fixtures []*database.Character
	for i := 0; i < 2; i++ {
		fixture, password := loadPreparedClassFixture(t, repo, 0, 30)
		fixture.X, fixture.Z = -1.25, 200
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		accounts = append(accounts, account{fixture.Name, password, fixture.Class})
		fixtures = append(fixtures, fixture)
	}
	encoded, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 17925, "-save-journal-dir", t.TempDir())
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 180*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test", "tests/e2e/maintenance-connected-publication.spec.js", "--workers=1", "--retries=0", "--output="+filepath.Join(evidence, "browser-results"))
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "EIDOLON_E2E_MAINTENANCE_CONNECTED=1", "EIDOLON_E2E_MAINTENANCE_ACCOUNTS="+string(encoded), "EIDOLON_E2E_MAINTENANCE_EVIDENCE="+evidence,
		"EIDOLON_EXPECTED_COMMIT="+filepath.Base(binary), "EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_USERNAME_SECONDARY="+accounts[1].Username, "EIDOLON_E2E_PASSWORD_SECONDARY="+accounts[1].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome", "EIDOLON_E2E_WEB_PORT=4193", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4194",
		"EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_BACKEND_ORIGIN_IP=", "EIDOLON_E2E_HEADLESS=1", "CI=", "PLAYWRIGHT_NO_COPY_PROMPT=1")
	log, err := os.OpenFile(filepath.Join(evidence, "browser.log"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	cmd.Stdout, cmd.Stderr = log, log
	started := time.Now()
	runErr := cmd.Run()
	if err := log.Close(); err != nil {
		t.Fatal(err)
	}
	stop()
	sanitize := exec.CommandContext(ctx, node, "scripts/sanitize-playwright-artifacts.mjs", evidence, filepath.Join(root, "playwright-report"))
	sanitize.Dir, sanitize.Env = root, cmd.Env
	if err := sanitize.Run(); err != nil {
		t.Fatal("browser artifact credential sanitation failed")
	}
	if runErr != nil {
		t.Fatalf("maintenance connected publication failed; owned evidence=%s", evidence)
	}
	for i, fixture := range fixtures {
		fps := []string{"60", "15"}[i]
		raw, err := os.ReadFile(filepath.Join(evidence, "connected-"+fps+".json"))
		if err != nil {
			t.Fatal(err)
		}
		var receipt struct {
			Jump struct{ End struct{ X, Z float64 } }
		}
		if err := json.Unmarshal(raw, &receipt); err != nil {
			t.Fatal(err)
		}
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || saved == nil || !saved.LastLogout.After(started) || saved.Gold != fixture.Gold || saved.EP != fixture.EP || saved.InstanceID != "" ||
			!reflect.DeepEqual(saved.Inventory, fixture.Inventory) || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) ||
			math.Hypot(saved.X-receipt.Jump.End.X, saved.Z-receipt.Jump.End.Z) >= .1 {
			t.Fatal("maintenance jump changed saved Gold/EP/gear/bag or lost landing position", err)
		}
	}
	t.Log("actual copied/versioned publication, normal and interrupted module startup, server-accepted slow-frame jumps and fresh saves verified")
}
