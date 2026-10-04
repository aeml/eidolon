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

// Twenty actual clients share one normal server/DB. Not a raid/event clear,
// renderer check, full settlement/restart or declared100-player capacity proof.
func TestLoadCombinedActualConcurrentWorkloadsAndSaves(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires an absolute prepared load-driver binary path")
	}
	fixtures := make([]*database.Character, 20)
	credentials := make([]map[string]string, 20)
	for index := range fixtures {
		var fixture *database.Character
		var password string
		if index < 4 {
			fixture, password = loadPreparedPartyFixture(t, repo, index)
		} else {
			fixture, password = resourceJournalFixture(t, repo)
			fixture.EP, fixture.Gold = 43, 100000 // Explicit disposable initial bankroll.
			fixture.X, fixture.Z = 0, 180
			if index >= 16 {
				fixture.X, fixture.Z = float64(index-16)*2, 200
			}
			fixture.Resources.Health = 100
			fixture.Inventory = []database.Item{{ID: "combined-keep-bag", Name: "Combined preservation fixture", Type: "ARMOR", Slot: "chest", Rarity: "LEGENDARY", Level: 1, Stack: 1, MaxStack: 1, Value: 9999, StatScaleVersion: game.ItemStatScaleVersion}}
			if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
				t.Fatal("could not persist disposable prepared character")
			}
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
	address, stop := compatStartServer(t, binary, uri, 179, "-save-journal-dir", t.TempDir())
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "combined", "-n", "20", "-credentials-file", credentialPath, "-casino-bet", "100", "-party-combat-x", "400", "-party-combat-z", "600", "-duration", "120s", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Party coverage|Combined casino coverage|Combined workload): [a-z_0-9= -]+$`).FindString(line); match != "" {
			t.Log(match) // Aggregate fields only; never raw credential/socket logs.
		}
	}
	if runErr != nil {
		t.Fatal("actual combined driver failed; raw synthetic socket logs omitted")
	}
	if !strings.Contains(string(output), "Combined workload: clients=20 party_clients=4 poker_clients=2 blackjack_clients=4 house_clients=4 slots_clients=2 town_clients=2 social_clients=2") || !regexp.MustCompile(`Party coverage: groups=1 formed=1 members=4 min_impacts=[1-9][0-9]* damage_events=[1-9][0-9]* heal_events=[1-9][0-9]*`).Match(output) {
		t.Fatal("missing configured roles, party impacts or real healing")
	}
	stop() // Normal disconnect/shutdown; table recovery remains authoritative.
	for index, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) {
			t.Fatal("missing a fresh normal combined-workload character save")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || actual.Gold < 0 || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) || !reflect.DeepEqual(actual.Inventory, fixture.Inventory) {
			t.Fatal("combined profile changed class, EP, equipped gear or preserved bag")
		}
		if index < 4 && (actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP) {
			t.Fatal("a party member has no persisted real-combat progression")
		}
		if index >= 4 && index < 16 && len(actual.CasinoWalletCheckpoints) == 0 {
			t.Fatal("an assigned casino client has no durable wallet checkpoint")
		}
		if index >= 16 && actual.Gold != fixture.Gold {
			t.Fatal("town/social activity mutated prepared inventory or bankroll")
		}
	}
	t.Logf("twenty normal clients: party/healing, paid poker/blackjack/house/slots, town/social attempts and fresh preserved-gear saves; elapsed=%s; unfinished final casino rounds retained, not final-settlement/raid/event/capacity proof", time.Since(started).Round(time.Millisecond))
}
