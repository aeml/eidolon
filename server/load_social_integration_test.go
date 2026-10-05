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

// A short two-player check of normal delivered town/social responses and fresh
// independent saves. Not sustained100-client or full combined acceptance.
func TestLoadSocialActualDeliveredRegistriesAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary path")
	}
	fixtures := make([]*database.Character, 2)
	credentials := make([]map[string]string, 2)
	for index := range fixtures {
		fixture, password := resourceJournalFixture(t, repo)
		fixture.X, fixture.Z, fixture.EP = float64(index), 200, 43
		fixture.Inventory = []database.Item{{ID: "social-keep-bag", Name: "Social preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion}}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not save disposable social fixture")
		}
		fixtures[index], credentials[index] = fixture, map[string]string{"username": fixture.Name, "password": password}
	}
	encoded, err := json.Marshal(credentials)
	if err != nil {
		t.Fatal("could not encode disposable credentials")
	}
	credentialPath := filepath.Join(t.TempDir(), "test-credentials.json")
	if err := os.WriteFile(credentialPath, encoded, 0600); err != nil {
		t.Fatal("could not store disposable credentials")
	}
	address, stop := compatStartServer(t, binary, uri, 180, "-save-journal-dir", t.TempDir())
	started := time.Now()
	for _, scenario := range []string{"town", "social"} {
		ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
		command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", scenario, "-n", "2", "-credentials-file", credentialPath, "-duration", "12s", "-admission-timeout", "5s")
		output, runErr := command.CombinedOutput()
		cancel()
		for _, line := range strings.Split(string(output), "\n") {
			if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Social coverage): [a-z_0-9= -]+$`).FindString(line); match != "" {
				t.Log(match)
			}
		}
		if runErr != nil {
			t.Fatal("actual social driver failed; private socket logs omitted")
		}
		registries := 0
		if scenario == "social" {
			registries = 2
		}
		expected := fmt.Sprintf("Social coverage: clients=2 complete=2 failed=0 own_chat=2 own_presence=%d friends=%d guild=%d pvp=%d leaderboard=%d", registries, registries, registries, registries, registries)
		if !strings.Contains(string(output), expected) {
			t.Fatal("missing each-client delivered social outcomes")
		}
	}
	stop()
	for _, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) {
			t.Fatal("missing fresh normal social disconnect save")
		}
		if actual.Class != fixture.Class || actual.Level != fixture.Level || actual.XP != fixture.XP || actual.Gold != fixture.Gold || actual.EP != fixture.EP || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || !reflect.DeepEqual(actual.Inventory, fixture.Inventory) {
			t.Fatal("social reads/chat changed progression, funds or preserved equipment/bag")
		}
	}
	t.Log("two ordinary town/chat and two social/chat/presence/friend/guild/PvP/leaderboard deliveries; independent fresh saves preserve progression/Gold/EP/gear/bag; no capacity, AFK-time or uniquely correlated registry acknowledgement claim")
}
