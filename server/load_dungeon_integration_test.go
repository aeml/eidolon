package main

import (
	"context"
	"encoding/json"
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
)

// One opt-in earned four-class run, not an automatic per-release campaign or
// a general100-player, raid, fresh-process or human pacing acceptance test.
func TestLoadDungeonActualFourClassClearExitAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary")
	}
	fixtures := make([]*database.Character, 4)
	credentials := make([]map[string]string, 4)
	for index := range fixtures {
		fixture, password := loadPreparedPartyFixture(t, repo, index)
		fixture.X, fixture.Z = -1.25+float64(index), 200
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not persist disposable town starting position")
		}
		fixtures[index], credentials[index] = fixture, map[string]string{"username": fixture.Name, "password": password}
	}
	encoded, err := json.Marshal(credentials)
	if err != nil {
		t.Fatal("could not encode disposable credentials")
	}
	credentialPath := filepath.Join(t.TempDir(), "test-credentials.json")
	if os.WriteFile(credentialPath, encoded, 0600) != nil {
		t.Fatal("could not store disposable credentials")
	}
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 13*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "party-dungeon", "-n", "4", "-credentials-file", credentialPath, "-dungeon-type", "verdant_bastion_catacombs", "-dungeon-level", "30", "-dungeon-difficulty", "normal", "-duration", "12m", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		for _, evidence := range encounterLoadDiagnostics(line) {
			t.Log(evidence)
		}
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Recovery coverage|Party coverage|Dungeon coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match)
		}
	}
	if runErr != nil {
		t.Fatal("actual dungeon driver failed; raw synthetic socket logs omitted")
	}
	coverage := regexp.MustCompile(`Dungeon coverage: groups=1 entered=4 cleared=4 exited=4 cleared_rooms=([0-9]+) cleared_bosses=([0-9]+) reentry_requests=([0-9]+) checkpoint_returns=([0-9]+)`).FindSubmatch(output)
	if coverage == nil {
		t.Fatal("missing every-client earned dungeon clear and town exit")
	}
	bosses, _ := strconv.Atoi(string(coverage[2]))
	if bosses < 1 || bosses > 128 || string(coverage[3]) != string(coverage[4]) {
		t.Fatal("invalid boss/checkpoint coverage")
	}
	stop() // Flush ordinary disconnect/shutdown before independent durable checks.
	sharedVictories := map[string]bool{}
	for index, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) || actual.InstanceID != "" {
			t.Fatal("missing fresh normal town save after dungeon exit")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || actual.Gold < 0 {
			t.Fatal("dungeon run changed prepared class, EP or equipped gear")
		}
		preserved := false
		for _, item := range actual.Inventory {
			if reflect.DeepEqual(item, fixture.Inventory[0]) {
				preserved = true
			}
		}
		if !preserved {
			t.Fatal("dungeon bot lost its protected initial bag item")
		}
		if actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP {
			t.Fatal("a party member has no saved earned progression")
		}
		victories := 0
		for id := range actual.ItemDeliveryReceipts {
			if !strings.HasPrefix(id, "bossvictory:") {
				continue
			}
			record, err := repo.GetBossVictory(id)
			if err != nil || record == nil || record.Validate() != nil || record.State != database.BossVictoryComplete || record.DungeonType != "verdant_bastion_catacombs" || record.RunLevel != 30 || !database.BossVictoryCharacterReceiptMatches(actual, record.BossVictoryOperation) {
				t.Fatal("boss clear lacks matching independent durable original reward proof")
			}
			if index == 0 {
				sharedVictories[id] = true
			} else if !sharedVictories[id] {
				t.Fatal("party members saved different boss victories")
			}
			victories++
		}
		if victories != bosses {
			t.Fatal("not every party member saved each cleared boss's original credit")
		}
	}
	t.Logf("four normally equipped level30 classes: earned Verdant clear, per-client town exit, shared durable boss rewards, XP and preserved gear/bag/EP; elapsed=%s; no raid/capacity/human-pacing/restart claim", time.Since(started).Round(time.Millisecond))
}
