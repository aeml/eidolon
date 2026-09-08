package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Explicit disposable database only; the default suite skips external services.
// Real login/join/disconnect and fresh processes exercise the production load
// and save path, not just BSON conversion. These are prepared save fixtures.
func TestResourceActualSavedSessions(t *testing.T) {
	if os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo and built server")
	}
	uri, binary := os.Getenv("EIDOLON_RESOURCE_MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires isolated loopback Mongo URI and absolute binary path")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	random := make([]byte, 24)
	if _, err := rand.Read(random); err != nil {
		t.Fatal(err)
	}
	password, prefix := hex.EncodeToString(random), "resource-"+hex.EncodeToString(random[:8])
	var fixtures []*database.Character
	for classIndex, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, level := range []int{1, 30, 100} {
			maxHP, maxMana := 300+(level-1)*5, 400+(level-1)*5
			for caseIndex, values := range [][2]int{{1, 0}, {50, 25}, {maxHP, maxMana}, {0, 0}} {
				name := fmt.Sprintf("%s-%d-%d-%d", prefix, classIndex, level, caseIndex)
				char := &database.Character{Name: name, Class: class, Level: level,
					ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200,
					Gold: 1234, LastDailyQuest: time.Now(),
					Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10, Vitality: 10, Wisdom: 10},
					Resources: &database.CharacterResources{Version: 1, Health: values[0], Mana: values[1], Dead: values[0] == 0},
					Equipment: map[string]database.Item{"chest": {ID: "resource-test-chest", Name: "Resource Test Chest",
						Type: "ARMOR", Slot: "chest", Rarity: "RARE", Level: 1, Stack: 1, MaxStack: 1,
						StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{"vitality": 20, "intelligence": 30}}},
				}
				if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
					t.Fatal(err)
				}
				if err := repo.SetFirstCharacter(name, char); err != nil {
					t.Fatal(err)
				}
				fixtures = append(fixtures, char)
			}
		}
	}
	for phase := 0; phase < 3; phase++ {
		address, stop := compatStartServer(t, binary, uri, phase)
		for index, fixture := range fixtures {
			joinedAt := time.Now()
			compatLoginAndDisconnect(t, address, fixture.Name, password, fixture.Class)
			var actual *database.Character
			deadline := time.Now().Add(15 * time.Second)
			for time.Now().Before(deadline) {
				actual, err = repo.GetCharacter(fixture.Name, fixture.Name)
				if err == nil && actual.LastLogout.After(joinedAt) {
					break
				}
				time.Sleep(25 * time.Millisecond)
			}
			if err != nil || actual == nil || !actual.LastLogout.After(joinedAt) {
				t.Fatalf("phase%d fixture%d: no fresh persisted disconnect", phase, index)
			}
			if !reflect.DeepEqual(actual.Resources, fixture.Resources) {
				t.Fatalf("phase%d fixture%d: resources got%+v want%+v", phase, index, actual.Resources, fixture.Resources)
			}
			if actual.Gold != fixture.Gold || actual.Level != fixture.Level ||
				!reflect.DeepEqual(actual.Equipment, fixture.Equipment) {
				t.Fatalf("phase%d fixture%d: unrelated progression/equipment changed", phase, index)
			}
		}
		stop()
	}
	t.Logf("144 real saved resource sessions passed across four classes, three levels, partial/full/zero/dead bars and three server processes")
}
