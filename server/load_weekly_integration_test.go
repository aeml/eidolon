package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Prepared level, equipment and chapter access are fixtures. The normal server
// must earn the encounter, original shared victory and each personal weekly cache.
func TestLoadWeeklyActualFiveRolesPhasesExitAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver binary")
	}
	fixtures := make([]*database.Character, 5)
	credentials := make([]map[string]string, 5)
	for index := range fixtures {
		fixture, password := loadPreparedClassFixture(t, repo, index%4, game.MaxPlayerLevel)
		fixture.X, fixture.Z = -1.25+float64(index), 200
		fixture.Resources.Health, fixture.Resources.Mana = 10000, 10000 // Initial only; normal login clamps maxima.
		fixture.Quests = []database.Quest{
			{ID: game.ChronicleGateOpenedID, Accepted: true, Completed: true, Count: 1, MaxCount: 1},
			{ID: game.ChronicleDarkKingID, Type: "KILL", Target: "UmbraPrime", Category: game.QuestCategoryChronicle, Accepted: true, MaxCount: 1},
		}
		// Use legal role-appropriate body armor and offhands, not an all-cloth tank.
		gear := []string{"pendant", "amulet-of-power"}
		switch fixture.Class {
		case "Fighter", "Cleric":
			gear = append(gear, "iron-helm", "plate-mail", "plate-greaves", "iron-boots", "iron-gauntlets", "steel-pauldrons", "plated-girdle", "wooden-shield")
		case "Rogue":
			gear = []string{"choker", "talisman-of-speed", "leather-cap", "leather-tunic", "leather-pants", "leather-boots", "leather-gloves", "reinforced-spaulders", "studded-belt"}
		case "Wizard":
			gear = []string{"necklace", "orb-of-mana", "spell-tome"}
		}
		for gearIndex, id := range gear {
			rarity := game.RarityRare
			if gearIndex%2 == 1 {
				rarity = game.RarityUncommon
			}
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: id, Rarity: rarity, Level: game.MaxPlayerLevel, Quantity: 1})
			if err != nil {
				t.Fatal("could not prepare canonical role equipment")
			}
			fixture.Equipment[items[0].Slot] = databaseItem(items[0])
		}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not save disposable starting fixture")
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
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "party-raid", "-n", "5", "-credentials-file", credentialPath, "-raid-type", "weekly_raid", "-duration", "20m", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Recovery coverage|Party coverage|Dungeon coverage|Weekly raid coverage|Failure coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match)
		}
	}
	if runErr != nil {
		t.Fatal("actual weekly raid driver failed; raw synthetic socket logs omitted")
	}
	if !regexp.MustCompile(`Weekly raid coverage: groups=1 converted=true prepared=true ready_members=5 phase_members=5 min_phase_views=4`).Match(output) ||
		!regexp.MustCompile(`Dungeon coverage: groups=1 entered=5 cleared=5 exited=5 cleared_rooms=1 cleared_bosses=1 `).Match(output) {
		t.Fatal("missing every-client ordered phases, earned boss clear or town exit")
	}
	stop()
	sharedVictory := ""
	for _, fixture := range fixtures {
		actual, err := repo.GetWeeklyRaidCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) || actual.InstanceID != "" {
			t.Fatal("missing fresh normal town save")
		}
		if actual.Class != fixture.Class || actual.Level != game.MaxPlayerLevel || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || actual.Gold < fixture.Gold+15000 {
			t.Fatal("prepared identity/gear/EP changed or weekly Gold not saved")
		}
		preserved := false
		for _, item := range actual.Inventory {
			preserved = preserved || reflect.DeepEqual(item, fixture.Inventory[0])
		}
		if !preserved || actual.ResonanceLevel <= fixture.ResonanceLevel || len(actual.WeeklyRaidCompletions) != 0 {
			t.Fatal("missing protected bag item, earned resonance or settled completion outbox")
		}
		ready := false
		for _, quest := range actual.Quests {
			if quest.ID == game.ChronicleDarkKingID {
				ready = quest.Accepted && !quest.Completed && quest.Count == 1 && quest.MaxCount == 1 && quest.GrantedGold == 0 && quest.GrantedXP == 0 && quest.GrantedResonanceXP == 0
			}
		}
		if !ready {
			t.Fatal("missing earned finale readiness or story auto-claimed")
		}
		victories := 0
		for id := range actual.ItemDeliveryReceipts {
			if !strings.HasPrefix(id, "bossvictory:") {
				continue
			}
			record, err := repo.GetBossVictory(id)
			if err != nil || record == nil || record.Validate() != nil || record.State != database.BossVictoryComplete || record.DungeonType != "weekly_raid" || record.BossType != "UmbraPrime" || record.RunLevel != game.MaxPlayerLevel || !database.BossVictoryCharacterReceiptMatches(actual, record.BossVictoryOperation) {
				t.Fatal("missing matching durable original Dark King victory")
			}
			if sharedVictory == "" {
				sharedVictory = id
			} else if sharedVictory != id {
				t.Fatal("members saved different raid victories")
			}
			week := database.CurrentRaidWeek(record.CreatedAt)
			claimed, err := repo.HasWeeklyRaidReward("player-"+fixture.Name, record.CreatedAt)
			if err != nil || !claimed || !actual.WeeklyRaidRewardReceipts[week] {
				t.Fatal("missing durable personal weekly lockout/character receipt")
			}
			victories++
		}
		if victories != 1 {
			t.Fatal("member did not save exactly one original raid victory")
		}
	}
	pending, err := repo.PendingWeeklyRaidRewards()
	if err != nil || len(pending) != 0 {
		t.Fatal("weekly delivery remains pending")
	}
	t.Logf("five prepared level100 uncommon/rare class roles: actual ordered four-phase Dark King clear, town exits, shared original victory, personal weekly cache receipts and unclaimed finale readiness; independent gear/bag/EP/resonance/Gold saves; elapsed=%s; no campaign, human balance, aid-mechanics or capacity claim", time.Since(started).Round(time.Millisecond))
}
