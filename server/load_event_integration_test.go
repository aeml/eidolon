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

// Opt-in real-clock event check, not a per-release campaign or schedule override.
// Start during the first minute of a Root window; never wait through all realms
// or advance the server clock merely to get a successful result.
func TestLoadEventActualFourClassRootClearExitAndSaves(t *testing.T) {
	if os.Getenv("EIDOLON_LOAD_EVENT_FULL") != "1" {
		t.Skip("explicit naturally scheduled four-class event check only")
	}
	period := int64(game.PublicEventPeriod / time.Second)
	now := time.Now()
	if now.Unix()%period > 40 || now.Unix()/period%4 != 0 {
		t.Skip("requires first40s of an actual Root announcement; no accelerated clock")
	}
	repo, uri, binary := resourceJournalIntegration(t)
	driver := os.Getenv("EIDOLON_LOADTEST_BINARY")
	if !filepath.IsAbs(driver) {
		t.Fatal("requires absolute prepared load-driver binary")
	}
	site := game.PublicEventSites()[0]
	fixtures := make([]*database.Character, 4)
	credentials := make([]map[string]string, 4)
	for index := range fixtures {
		fixture, password := loadPreparedClassFixture(t, repo, index, site.Level)
		// The shared party fixture starts its tank wounded to exercise healing.
		// Here start with normal full preparation; injuries/recovery must come
		// from this short, naturally timed encounter, not a forced initial trip.
		fixture.Resources.Health = 10000 // Login clamps this to build-derived max.
		fixture.X, fixture.Z = site.X+float64(index), site.Z
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal("could not persist disposable event starting fixture")
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, driver, "-addr", address, "-scheme", "ws", "-scenario", "party-event", "-n", "4", "-credentials-file", credentialPath, "-event-site", site.ID, "-duration", "9m", "-admission-timeout", "5s")
	started := time.Now()
	output, runErr := command.CombinedOutput()
	for _, line := range strings.Split(string(output), "\n") {
		if match := regexp.MustCompile(`(?:Load summary|State coverage|Own state coverage|Admission coverage|Recovery coverage|Party coverage|Event coverage): [a-z_0-9= ]+$`).FindString(line); match != "" {
			t.Log(match)
		}
	}
	if runErr != nil {
		t.Fatal("actual event driver failed; raw synthetic socket logs omitted")
	}
	if !regexp.MustCompile(`Event coverage: groups=1 selected=1 present=4 completed=4 exited=4 min_wave_views=4`).Match(output) {
		t.Fatal("missing every-client normal event waves, completion and town exit")
	}
	stop() // Flush normal saves before independent Mongo reads.
	for _, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || actual == nil || !actual.LastLogout.After(started) || actual.InstanceID != "" {
			t.Fatal("missing fresh normal town save after event exit")
		}
		if actual.Class != fixture.Class || actual.EP != fixture.EP || actual.Gold < fixture.Gold || !reflect.DeepEqual(actual.Equipment, fixture.Equipment) {
			t.Fatal("event altered prepared class, equipment, EP or lost starting Gold")
		}
		preserved := false
		for _, item := range actual.Inventory {
			if reflect.DeepEqual(item, fixture.Inventory[0]) {
				preserved = true
			}
		}
		if !preserved {
			t.Fatal("event bot lost its protected initial bag item")
		}
		if actual.Level < fixture.Level || actual.Level == fixture.Level && actual.XP <= fixture.XP {
			t.Fatal("member lacks independently saved earned progression")
		}
	}
	t.Logf("four uncommon/rare-equipped level35 class roles: naturally scheduled Root waves/champion/completion and town exits, independently saved XP/Gold and preserved gear/bag sentinel/EP; elapsed=%s; no unique-kill/all-realms/100-player/headroom/pacing claim", time.Since(started).Round(time.Millisecond))
}
