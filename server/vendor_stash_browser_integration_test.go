package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestVendorStashActualBrowserCreditBoundary(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_VENDOR_BROWSER_NODE"), os.Getenv("EIDOLON_VENDOR_BROWSER_EVIDENCE")
	baseline := os.Getenv("EIDOLON_VENDOR_BASELINE_HELPERS")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) || !filepath.IsAbs(baseline) {
		t.Fatal("requires absolute Node, owned evidence and original helper paths")
	}
	type account struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Class    string `json:"characterClass"`
	}
	var accounts []account
	var fixtures []*database.Character
	for index := 0; index < 2; index++ {
		fixture, password := resourceJournalFixture(t, repo)
		fixture.Gold, fixture.EP = 1000, 43
		fixture.Inventory = []database.Item{{ID: "vendor-sale", Name: "Prepared vendor sword", Type: "WEAPON", Slot: "mainHand", Rarity: "Common", Value: 175, Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}}
		for i := 1; i < 25; i++ {
			fixture.Inventory = append(fixture.Inventory, database.Item{ID: fmt.Sprintf("vendor-keep-%d", i), Name: "Prepared invested chest", Type: "ARMOR", Slot: "chest", Rarity: "Rare", Potency: 1, Stack: 1, MaxStack: 1, Value: 200, Level: 1, StatScaleVersion: game.ItemStatScaleVersion})
		}
		fixture.Stash = []database.Item{{ID: "stash-keep", Name: "Prepared stored chest", Type: "ARMOR", Slot: "chest", Rarity: "Legendary", Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures = append(fixtures, fixture)
		accounts = append(accounts, account{fixture.Name, password, fixture.Class})
	}
	encoded, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 17924, "-save-journal-dir", t.TempDir())
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 180*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test", "tests/e2e/vendor-stash-boundary.spec.js", "--workers=1", "--retries=0", "--output="+filepath.Join(evidence, "browser-results"))
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "EIDOLON_E2E_VENDOR_STASH_BOUNDARY=1", "EIDOLON_E2E_VENDOR_STASH_ACCOUNTS="+string(encoded),
		"EIDOLON_E2E_VENDOR_BASELINE_HELPERS="+baseline, "EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_USERNAME_SECONDARY="+accounts[1].Username, "EIDOLON_E2E_PASSWORD_SECONDARY="+accounts[1].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome", "EIDOLON_E2E_WEB_PORT=4191", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4191",
		"EIDOLON_E2E_REUSE_SERVER=0", "EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_BACKEND_ORIGIN_IP=", "EIDOLON_E2E_HEADLESS=1", "CI=", "PLAYWRIGHT_NO_COPY_PROMPT=1")
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
		t.Fatalf("vendor/stash browser failed; owned evidence=%s", evidence)
	}
	for _, fixture := range fixtures {
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		wantStash := append(append([]database.Item{}, fixture.Stash...), fixture.Inventory[1])
		if err != nil || saved == nil || saved.Gold != 1175 || saved.EP != 43 || !saved.LastLogout.After(started) ||
			!reflect.DeepEqual(saved.Inventory, fixture.Inventory[2:]) || !reflect.DeepEqual(saved.Stash, wantStash) ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || len(saved.Buyback) != 0 {
			t.Fatal("vendor/stash/fresh-login save changed exact Gold, EP or item custody", err)
		}
	}
	t.Log("real ordered vendor credit, baseline missing barrier, corrected helper, exact stash and fresh-login saves verified")
}
