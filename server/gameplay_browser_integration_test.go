package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Saved positions, gear and an accepted diary are explicit preparation. The
// browser must perform every jump, walk, cast and window action through inputs.
func TestGameplayBrowserRoofRecallAndWindowInputs(t *testing.T) {
	if os.Getenv("EIDOLON_GAMEPLAY_NATIVE") != "1" {
		t.Skip("explicit disposable native gameplay fixture required")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_GAMEPLAY_BROWSER_NODE"), os.Getenv("EIDOLON_GAMEPLAY_BROWSER_EVIDENCE")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) {
		t.Fatal("requires absolute native browser Node and owned evidence paths")
	}
	type account struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Class    string `json:"characterClass"`
	}
	accounts := make([]account, 6)
	fixtures := make([]*database.Character, 6)
	names := make([]string, 6)
	for i := range accounts {
		index, level := i, 30
		if i >= 4 {
			index, level = 3, 75
			if i == 5 {
				index = 0
			}
		}
		fixture, password := loadPreparedClassFixture(t, repo, index, level)
		fixture.X, fixture.Y, fixture.Z = -106, 0, 130
		fixture.Resources.Health = 100000
		for slot, itemID := range map[string]string{"neck": "necklace", "trinket1": "amulet-of-power", "trinket2": "orb-of-mana"} {
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: itemID, Rarity: game.RarityRare, Level: level, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			fixture.Equipment[slot] = databaseItem(items[0])
		}
		if len(fixture.Equipment) != 14 {
			t.Fatal("native route requires every equipped slot")
		}
		if i == 4 {
			fixture.X, fixture.Z = 150, 218
			fixture.Quests = []database.Quest{
				{ID: "chronicle_01_bell_below", Category: game.QuestCategoryChronicle, Type: "KILL", Target: "Skeleton", Count: 3, MaxCount: 3, Accepted: true, Completed: true},
				{ID: game.ChronicleInvestigationCatalog()[0].ID, Category: game.QuestCategoryChronicle, Type: "INVESTIGATE", MaxCount: 1, Accepted: true},
			}
		}
		if i == 5 {
			fixture.X, fixture.Z = 980, 220
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures[i], names[i], accounts[i] = fixture, fixture.Name, account{fixture.Name, password, fixture.Class}
	}
	encoded, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 750, "-save-journal-dir", t.TempDir(),
		"-terrain-profile", game.FlatTerrainProfile, "-qa-usernames", strings.Join(names, ","))
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 300*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test",
		"tests/e2e/gameplay-roofs-and-casts.spec.js", "--workers=1", "--retries=0", "--max-failures=1",
		"--reporter=line,json", "--output="+filepath.Join(evidence, "browser-results"))
	command.Dir = root
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Cancel = func() error {
		if command.Process == nil {
			return os.ErrProcessDone
		}
		if err := syscall.Kill(-command.Process.Pid, syscall.SIGTERM); err != nil && err != syscall.ESRCH {
			return err
		}
		return nil
	}
	command.WaitDelay = 5 * time.Second
	command.Env = append(os.Environ(), "EIDOLON_E2E_GAMEPLAY_INTERACTIONS=1", "EIDOLON_GAMEPLAY_BROWSER_ACCOUNTS="+string(encoded),
		"EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome", "EIDOLON_E2E_REQUIRE_NATIVE_GPU=1",
		"EIDOLON_E2E_WEB_PORT=4196", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4196", "EIDOLON_E2E_REUSE_SERVER=0",
		"EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_BACKEND_ORIGIN_IP=", "EIDOLON_E2E_HEADLESS=1",
		"PLAYWRIGHT_JSON_OUTPUT_FILE="+filepath.Join(evidence, "browser-results.json"), "PLAYWRIGHT_NO_COPY_PROMPT=1", "CI=")
	log, err := os.OpenFile(filepath.Join(evidence, "browser.log"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	command.Stdout, command.Stderr = log, log
	started := time.Now()
	runErr := command.Run()
	if err := log.Close(); err != nil {
		t.Fatal(err)
	}
	stop()
	if runErr != nil {
		t.Fatalf("native roof/cast/window input route failed; owned evidence=%s", evidence)
	}
	for i, fixture := range fixtures {
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || saved == nil || !saved.LastLogout.After(started) || saved.InstanceID != "" ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || !reflect.DeepEqual(saved.Inventory, fixture.Inventory) ||
			saved.Gold != fixture.Gold || saved.EP != fixture.EP {
			t.Fatal("native input route changed retained gear, bag or wallet", err)
		}
		if i == 4 {
			confirmed := false
			for _, quest := range saved.Quests {
				if quest.ID == game.ChronicleInvestigationCatalog()[0].ID {
					confirmed = quest.Count == 1 && quest.InvestigationMask == 1 && !quest.Completed
				}
			}
			if !confirmed {
				t.Fatal("phone Use discovery lacks saved manual-turn-in evidence")
			}
		}
	}
	t.Logf("six prepared equipped accounts: four desktop roof/input routes, one emulated touch cast, one High/Low Earth fence view; no physical-device, performance, stress or earned-campaign claim; evidence=%s", evidence)
}
