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
	"eidolon-server/internal/game"
)

// Production server/driver on an explicitly owned disposable database. Initial
// equipment and chapter access are fixtures; all encounter/repair credit is earned.
func TestLoadRaidActualFiveClassRolesRepairExitAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver binary")
	}
	definition, _ := game.ElementalRaidDefinitionForType("earth_crystal_raid")
	fixtures := make([]*database.Character, 5)
	credentials := make([]map[string]string, 5)
	for index := range fixtures {
		fixture, password := loadPreparedPartyFixture(t, repo, index%4)
		fixture.X, fixture.Z = -1.25+float64(index), 200
		fixture.Quests = []database.Quest{
			{ID: definition.RequiredDungeonQuest, Accepted: true, Completed: true, Count: 1, MaxCount: 1},
			{ID: definition.RestoredQuest, Type: "REPAIR", Target: definition.RepairTarget, Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 1},
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not persist qualified disposable starting fixture")
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
	ctx, cancel := context.WithTimeout(context.Background(), 21*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "party-raid", "-n", "5", "-credentials-file", credentialPath, "-raid-type", definition.Type, "-duration", "20m", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Recovery coverage|Party coverage|Dungeon coverage|Raid coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match)
		}
	}
	if runErr != nil {
		t.Fatal("actual raid driver failed; raw synthetic socket logs omitted")
	}
	if !regexp.MustCompile(`Raid coverage: groups=1 converted=true prepared=true ready_members=5 restored=5 min_wave_views=3`).Match(output) {
		t.Fatal("missing every-client normal consent/wave/restoration proof")
	}
	coverage := regexp.MustCompile(`Dungeon coverage: groups=1 entered=5 cleared=5 exited=5 cleared_rooms=([0-9]+) cleared_bosses=([0-9]+) reentry_requests=([0-9]+) checkpoint_returns=([0-9]+)`).FindSubmatch(output)
	if coverage == nil {
		t.Fatal("missing every-client earned raid clear and town exit")
	}
	bosses, _ := strconv.Atoi(string(coverage[2]))
	if bosses != 1 || string(coverage[3]) != string(coverage[4]) {
		t.Fatal("invalid raid boss/checkpoint coverage")
	}
	stop()
	sharedVictories := map[string]bool{}
	for index, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) || actual.InstanceID != "" {
			t.Fatal("missing fresh ordinary town save after raid exit")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || actual.Gold < 0 {
			t.Fatal("raid changed prepared class, EP or equipment")
		}
		preserved := false
		for _, item := range actual.Inventory {
			if reflect.DeepEqual(item, fixture.Inventory[0]) {
				preserved = true
			}
		}
		if !preserved {
			t.Fatal("raid bot lost protected initial bag item")
		}
		if actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP {
			t.Fatal("member lacks saved earned progression")
		}
		repairSaved := false
		for _, quest := range actual.Quests {
			if quest.ID == definition.RestoredQuest {
				repairSaved = quest.Accepted && !quest.Completed && quest.Type == "REPAIR" && quest.Target == definition.RepairTarget && quest.MaxCount == 1 && quest.Count == 1 && quest.GrantedGold == 0 && quest.GrantedXP == 0 && quest.GrantedResonanceXP == 0
			}
		}
		if !repairSaved {
			t.Fatal("member lacks durable earned repair readiness or quest was auto-completed/rewarded")
		}
		victories := 0
		for id := range actual.ItemDeliveryReceipts {
			if !strings.HasPrefix(id, "bossvictory:") {
				continue
			}
			record, err := repo.GetBossVictory(id)
			if err != nil || record == nil || record.Validate() != nil || record.State != database.BossVictoryComplete || record.DungeonType != definition.Type || record.RunLevel != definition.RequiredLevel || !database.BossVictoryCharacterReceiptMatches(actual, record.BossVictoryOperation) {
				t.Fatal("raid boss lacks matching durable original reward proof")
			}
			if index == 0 {
				sharedVictories[id] = true
			} else if !sharedVictories[id] {
				t.Fatal("members saved different boss victories")
			}
			victories++
		}
		if victories != bosses {
			t.Fatal("member did not save original raid boss credit")
		}
	}
	t.Logf("five normally equipped level30 class roles: full Earth assault and three-wave Vigil, every-client restoration/town exit, independent saved boss rewards, unclaimed repair readiness, XP and preserved gear/bag/EP; elapsed=%s; no all-realms/DarkKing/capacity/human-pacing claim", time.Since(started).Round(time.Millisecond))
}
