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

func TestVendorStashCorrelatedWalletBaseline(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_VENDOR_BROWSER_NODE"), os.Getenv("EIDOLON_VENDOR_BROWSER_EVIDENCE")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) {
		t.Fatal("requires absolute Node and owned evidence paths")
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
		fixture.Inventory = nil
		for i := 0; i < 25; i++ {
			fixture.Inventory = append(fixture.Inventory, database.Item{ID: fmt.Sprintf("vendor-keep-%d", i), Name: "Prepared invested chest", Type: "ARMOR", Slot: "chest", Rarity: "Rare", Potency: 1, Stack: 1, MaxStack: 1, Value: 200, Level: 1, StatScaleVersion: game.ItemStatScaleVersion})
		}
		priorValue := 242
		if index == 1 {
			priorValue = 175
		}
		fixture.Inventory[24] = database.Item{ID: "prior-sale", Name: "Prior prepared sword", Type: "WEAPON", Slot: "mainHand", Rarity: "Common", Value: priorValue, Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}
		if index == 0 {
			fixture.Inventory[23] = database.Item{ID: "current-sale", Name: "Current prepared sword", Type: "WEAPON", Slot: "mainHand", Rarity: "Common", Value: 175, Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}
		}
		retained, err := json.Marshal(game.Item{ID: "pending-original", Name: "Retained invested chest", Type: game.ItemArmor, Slot: "chest", Rarity: game.RarityRare, Potency: 7, Stats: map[string]int{"strength": 3}, Stack: 1, MaxStack: 1, Value: 200, Level: 1, StatScaleVersion: game.ItemStatScaleVersion})
		if err != nil {
			t.Fatal(err)
		}
		fixture.PendingBossLoot = []string{string(retained)}
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
	address, stop := compatStartServer(t, binary, uri, 17925, "-save-journal-dir", t.TempDir())
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 180*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test", "tests/e2e/vendor-preexisting-credit.spec.js", "--workers=1", "--retries=0", "--output="+filepath.Join(evidence, "browser-results"))
	if selected := os.Getenv("EIDOLON_VENDOR_COUNTEREXAMPLE_CASE"); selected != "" {
		if selected != "sale" && selected != "stash" {
			t.Fatal("unknown counterexample case")
		}
		cmd.Args = append(cmd.Args, "--grep", "synchronizes the "+selected+" baseline")
	}
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "EIDOLON_E2E_VENDOR_PREEXISTING_CREDIT=1", "EIDOLON_E2E_VENDOR_STASH_ACCOUNTS="+string(encoded),
		"EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_USERNAME_SECONDARY="+accounts[1].Username, "EIDOLON_E2E_PASSWORD_SECONDARY="+accounts[1].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome", "EIDOLON_E2E_WEB_PORT=4196", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4196",
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
	for index, fixture := range fixtures {
		if selected := os.Getenv("EIDOLON_VENDOR_COUNTEREXAMPLE_CASE"); (selected == "sale" && index != 0) || (selected == "stash" && index != 1) {
			continue
		}
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		wantGold := 1417
		if index == 1 {
			wantGold = 1175
		}
		if err != nil || saved == nil || saved.Gold != wantGold || saved.EP != 43 || !saved.LastLogout.After(started) || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) || len(saved.Buyback) != 0 || len(saved.PendingBossLoot) != 0 {
			t.Fatal("counterexample changed exact independent Gold credit, EP, equipment or retained-loot custody", err)
		}
		var pending game.Item
		if err := json.Unmarshal([]byte(fixture.PendingBossLoot[0]), &pending); err != nil {
			t.Fatal(err)
		}
		wantInventory := append([]database.Item{}, fixture.Inventory[:23]...)
		wantStash := append([]database.Item{}, fixture.Stash...)
		if index == 1 {
			wantInventory = append([]database.Item{}, fixture.Inventory[1:24]...)
			wantStash = append(wantStash, fixture.Inventory[0])
		}
		wantInventory = append(wantInventory, databaseItem(pending))
		if !reflect.DeepEqual(saved.Inventory, wantInventory) || !reflect.DeepEqual(saved.Stash, wantStash) {
			t.Fatal("exact bag/stash placement or retained metadata changed")
		}
		all := append(append([]database.Item{}, saved.Inventory...), saved.Stash...)
		seen := make(map[string]database.Item)
		for _, item := range all {
			if item.ID != "" {
				if _, exists := seen[item.ID]; exists {
					t.Fatal("duplicate item custody")
				}
				seen[item.ID] = item
			}
		}
		if len(seen) != 25+index || seen["pending-original"].Potency != 7 || seen["pending-original"].Stats["strength"] != 3 {
			t.Fatal("lost exact retained gear")
		}
		for _, item := range fixture.Inventory {
			if item.ID == "prior-sale" || (index == 0 && item.ID == "current-sale") {
				if _, ok := seen[item.ID]; ok {
					t.Fatal("sold item survived")
				}
				continue
			}
			if !reflect.DeepEqual(seen[item.ID], item) {
				t.Fatal("unrelated item changed")
			}
		}
	}

	t.Log("real correlated wallet baselines and exact fresh-login saves verified")
}
