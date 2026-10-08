package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Disposable saved equipment and bounded existing QA waypoints are explicit
// preparation. Real browser input/replication/draws, not natural progression,
// enemy balance, a dungeon clear or physical-phone performance certification.
func TestTerrainActualEquippedBrowserParty(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_TERRAIN_BROWSER_NODE"), os.Getenv("EIDOLON_TERRAIN_BROWSER_EVIDENCE")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) {
		t.Fatal("requires absolute browser Node and owned evidence paths")
	}
	quality := os.Getenv("EIDOLON_TERRAIN_PARTY_QUALITY")
	if quality != "high" && quality != "low" {
		t.Fatal("requires explicit high or low party quality")
	}
	mode := os.Getenv("EIDOLON_TERRAIN_PARTY_RENDER_MODE")
	if mode != "four-browser" && mode != "single-renderer" {
		t.Fatal("requires explicit four-browser or single-renderer scope")
	}
	type account struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Class    string `json:"characterClass"`
	}
	accounts := make([]account, 4)
	fixtures := make([]*database.Character, 4)
	names := make([]string, 4)
	for index := range accounts {
		fixture, password := loadPreparedClassFixture(t, repo, index, 30)
		fixture.X, fixture.Z = -1.25+float64(index)*2, 200
		for slot, itemID := range map[string]string{"neck": "necklace", "trinket1": "amulet-of-power", "trinket2": "orb-of-mana"} {
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: itemID, Rarity: game.RarityRare, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal(err)
			}
			fixture.Equipment[slot] = databaseItem(items[0])
		}
		fixture.SavedHotbar = []string{fixture.UnlockedSkills[0]}
		if fixture.Class == "Cleric" {
			fixture.SavedHotbar = []string{"Healing Light"}
		}
		if len(fixture.Equipment) != 14 {
			t.Fatal("party render fixture needs every equipped slot")
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures[index], names[index] = fixture, fixture.Name
		accounts[index] = account{fixture.Name, password, fixture.Class}
	}
	encoded, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal("cannot encode isolated browser accounts")
	}
	address, stop := compatStartServer(t, binary, uri, 1879, "-save-journal-dir", t.TempDir(),
		"-terrain-profile", game.RaisedEarthTerrainProfile, "-qa-usernames", strings.Join(names, ","))
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 240*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test",
		"tests/e2e/terrain-equipped-party.spec.js", "--workers=1", "--output="+filepath.Join(evidence, "browser-results"))
	command.Dir = root
	command.Env = append(os.Environ(),
		"EIDOLON_E2E_TERRAIN_PARTY=1", "EIDOLON_E2E_TERRAIN_PARTY_ACCOUNTS="+string(encoded),
		"EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome",
		"EIDOLON_E2E_WEB_PORT=4190", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4190", "EIDOLON_E2E_REUSE_SERVER=0",
		"EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_TERRAIN_PROFILE="+game.RaisedEarthTerrainProfile,
		"EIDOLON_E2E_BACKEND_ORIGIN_IP=", "EIDOLON_E2E_HEADLESS=1", "CI=", "PLAYWRIGHT_NO_COPY_PROMPT=1")
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
	stop() // Flush normal browser disconnects before comparing stored gear.
	if runErr != nil {
		t.Fatalf("equipped browser party failed; owned post-login evidence=%s", evidence)
	}
	for _, fixture := range fixtures {
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || saved == nil || !saved.LastLogout.After(started) || saved.PartyID == "" || saved.InstanceID != "" ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || !reflect.DeepEqual(saved.Inventory, fixture.Inventory) || saved.EP != fixture.EP {
			t.Fatal("fresh connected-party save lost its membership, gear, bag or EP", err)
		}
	}
	t.Logf("actual four-class %s party mode=%s and preserved fourteen-slot saves passed; owned evidence=%s", quality, mode, evidence)
}
