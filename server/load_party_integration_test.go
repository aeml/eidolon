package main

import (
	"context"
	"encoding/json"
	"fmt"
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

// Real production server, normal commands, ordinary randomized overworld enemies.
// Prepared disposable saves are not earned progression or capacity acceptance.
func TestLoadPartyActualCombatAndSavedGear(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary path")
	}
	classes := []string{"Fighter", "Cleric", "Rogue", "Wizard"}
	weapons := []string{"iron-sword", "cleric-mace", "steel-dagger", "wooden-staff"}
	type credential struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	credentials := make([]credential, 4)
	fixtures := make([]*database.Character, 4)
	for i, class := range classes {
		fixture, password := resourceJournalFixture(t, repo)
		fixture.Class, fixture.SelectedBranch, fixture.EP = class, "A", 43
		fixture.X, fixture.Z = 400+float64(i), 600
		fixture.Stats = database.Stats{Strength: 68, Vitality: 68, Dexterity: 39, Intelligence: 39, Wisdom: 39}
		fixture.UnlockedSkills = []string{"Charge", "Whirlwind", "Shield Slam", "Iron Fortress"}
		switch class {
		case "Cleric":
			fixture.Stats.Strength, fixture.Stats.Wisdom = 39, 68
			fixture.UnlockedSkills = []string{"Radiant Strike", "Healing Light", "Guardian Embrace", "Purifying Wave"}
		case "Rogue":
			fixture.Stats.Strength, fixture.Stats.Dexterity = 39, 68
			fixture.UnlockedSkills = []string{"Piercing Throw", "Backstab", "Weak Point Mark", "Shadow Lunge"}
		case "Wizard":
			fixture.Stats.Strength, fixture.Stats.Intelligence = 39, 68
			fixture.UnlockedSkills = []string{"Fireball", "Flame Whip", "Flame Tornado", "Meteor Drop"}
		}
		fixture.Resources = &database.CharacterResources{Version: 1, Health: 10000, Mana: 10000}
		if class == "Fighter" {
			fixture.Resources.Health = 350 // A prepared wound, not a player-caused injury.
		}
		fixture.Equipment = map[string]database.Item{}
		for gearIndex, itemID := range []string{weapons[i], "silk-hood", "robes", "silk-skirt", "sandals", "silk-gloves", "velvet-mantle", "silk-sash", "gold-ring", "silver-ring"} {
			rarity := game.RarityUncommon
			if gearIndex%2 == 0 {
				rarity = game.RarityRare
			}
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: itemID, Rarity: rarity, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal("could not prepare legal class equipment")
			}
			slot := items[0].Slot
			if slot == "ring" {
				slot = "ring1"
				if _, found := fixture.Equipment[slot]; found {
					slot = "ring2"
				}
			}
			fixture.Equipment[slot] = databaseItem(items[0])
		}
		if class == "Rogue" {
			items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: "steel-dagger", Rarity: game.RarityRare, Level: 30, Quantity: 1})
			if err != nil {
				t.Fatal("could not prepare legal Rogue offhand")
			}
			fixture.Equipment["offHand"] = databaseItem(items[0])
		}
		fixture.Inventory = []database.Item{{ID: "party-keep-bag", Name: "Party gear preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, Value: 9999, StatScaleVersion: game.ItemStatScaleVersion}}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not persist disposable prepared character")
		}
		fixtures[i], credentials[i] = fixture, credential{Username: fixture.Name, Password: password}
	}
	encoded, err := json.Marshal(credentials)
	if err != nil {
		t.Fatal("could not encode disposable credentials")
	}
	credentialPath := filepath.Join(t.TempDir(), "test-credentials.json")
	if err := os.WriteFile(credentialPath, encoded, 0600); err != nil {
		t.Fatal("could not store disposable credentials")
	}
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 70*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "party-combat", "-n", "4", "-credentials-file", credentialPath, "-party-combat-x", "400", "-party-combat-z", "600", "-duration", "45s", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	// Only aggregate fixed-field summaries may enter retained evidence. Never
	// echo raw socket logs, prepared names, passwords or a credential-file path.
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Party coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match)
		}
	}
	if runErr != nil {
		t.Fatal("actual party driver failed; raw synthetic socket logs omitted")
	}
	if !regexp.MustCompile(`Party coverage: groups=1 formed=1 members=4 min_impacts=[1-9][0-9]* damage_events=[1-9][0-9]* heal_events=[1-9][0-9]* accepted_casts=[1-9][0-9]* denied_casts=[0-9]+ xp_progress_updates=[1-9][0-9]* observed_deaths=[0-9]+ failed=0`).Match(output) {
		t.Fatal("missing real party formation, every-member impact, healing or observed progression")
	}
	stop() // Flush ordinary disconnect saves before independently reading Mongo.
	for _, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) {
			t.Fatal("missing fresh ordinary party disconnect save")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || !reflect.DeepEqual(actual.Inventory, fixture.Inventory) {
			t.Fatal("party profile changed class, EP, equipped gear or preserved bag")
		}
		if actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP {
			t.Fatal("a party member has no persisted progression from real combat")
		}
	}
	t.Log(fmt.Sprintf("four class saves retain gear/bag/EP and each gain XP after ordinary randomized-enemy party combat; elapsed=%s; no dungeon/raid, unique kill attribution or capacity claim", time.Since(started).Round(time.Millisecond)))
}
