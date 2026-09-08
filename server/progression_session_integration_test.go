package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

// Opt-in only: starts two explicitly supplied builds against a disposable
// loopback Mongo. Ordinary unit/CI runs never contact a database through this
// test. Fixtures are synthetic compatibility saves, not earned-play evidence.
func TestProgressionActualLoginRollback(t *testing.T) {
	if os.Getenv("EIDOLON_COMPAT_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires dedicated compatibility database and both built binaries")
	}
	uri := os.Getenv("EIDOLON_COMPAT_MONGO_URI")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires explicit isolated loopback Mongo URI")
	}
	bridge, candidate := os.Getenv("EIDOLON_COMPAT_BRIDGE_BINARY"), os.Getenv("EIDOLON_COMPAT_CANDIDATE_BINARY")
	if !filepath.IsAbs(bridge) || !filepath.IsAbs(candidate) || bridge == candidate {
		t.Fatal("requires distinct absolute bridge/candidate binary paths")
	}
	db, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(context.Background())
	secret := make([]byte, 24)
	if _, err := rand.Read(secret); err != nil {
		t.Fatal(err)
	}
	password := hex.EncodeToString(secret)
	runID := make([]byte, 8)
	if _, err := rand.Read(runID); err != nil {
		t.Fatal(err)
	}
	type fixture struct {
		name  string
		saved *database.Character
	}
	fixtures := []fixture{}
	for classIndex, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for caseIndex, initial := range []struct{ level, xp, version int }{
			{30, compatRequirement(1, 30) / 2, 0},
			{30, compatRequirement(1, 30) + 123, 1},
			{50, compatRequirement(2, 50) / 3, 2},
			{100, compatRequirement(1, 100), 0},
			{99, compatRequirement(1, 99) + 321, 1},
		} {
			name := fmt.Sprintf("compat-%s-%d-%d", hex.EncodeToString(runID), classIndex, caseIndex)
			if err := db.CreateUser(name, name+"@example.invalid", password); err != nil {
				t.Fatal(err)
			}
			character := &database.Character{Name: name, Class: class,
				Level: initial.level, XP: initial.xp, ProgressionVersion: initial.version,
				X: -1.25, Z: 200, Gold: 54321, SkillPoints: 0, SelectedBranch: "C",
				ResonanceLevel: 3, ResonanceXP: 456, ResonancePoints: 1,
				ResonanceRanks: map[string]int{"power": 1, "ward": 1, "fortune": 0},
				Stats:          database.Stats{Strength: 72, Dexterity: 63, Intelligence: 84, Wisdom: 65, Vitality: 76},
				LastDailyQuest: time.Now(),
				Quests: []database.Quest{
					{ID: "chronicle_01_bell_below", Type: "KILL", Target: "Skeleton", Category: "chronicle",
						Accepted: true, Count: 1, MaxCount: 3, RewardXP: 0, RewardGold: 0},
					{ID: "compat_future_diary", Type: "INVESTIGATE", Target: "compat_diary", Category: "chronicle",
						Accepted: true, Count: 2, MaxCount: 3, InvestigationMask: 5, LegacyOptional: true,
						RewardXP: 777, RewardGold: 333},
					{ID: "compat_future_hunt", Type: "KILL", Target: "Skeleton", Category: "chronicle",
						Accepted: true, Count: 7, MaxCount: 11, RewardXP: 0, RewardGold: 0},
				},
			}
			gear := database.Item{ID: "compat-earned-chest", Name: "Compatibility Chest", Type: "ARMOR", Slot: "chest",
				Rarity: "RARE", Level: 30, Potency: 2, Value: 789, Stack: 1, MaxStack: 1,
				Stats: map[string]int{"vitality": 7, "wisdom": 3}, StatScaleVersion: game.ItemStatScaleVersion,
				ForgeBasis: &forging.Basis{Level: 20, Potency: 1, Value: 600, Stats: map[string]int{"vitality": 5, "wisdom": 2}}}
			character.Equipment = map[string]database.Item{"chest": gear}
			gear.ID = "compat-bag-chest"
			character.Inventory = []database.Item{gear}
			gear.ID = "compat-stash-chest"
			character.Stash = []database.Item{gear}
			gear.ID = "compat-buyback-chest"
			character.Buyback = []database.Item{gear}
			if err := db.SetFirstCharacter(name, character); err != nil {
				t.Fatal(err)
			}
			fixtures = append(fixtures, fixture{name, character})
		}
	}
	// A bridge login handles old and new saves first, then activation, rollback,
	// reactivation, and same-version reload. Every hop uses a newly started server
	// and ordinary login/join/disconnect, never resume or in-memory conversion.
	for phase, version := range []int{1, 2, 1, 2, 2} {
		binary := bridge
		if version == 2 {
			binary = candidate
		}
		address, stop := compatStartServer(t, binary, uri, phase)
		for i := range fixtures {
			f := &fixtures[i]
			expected := compatExpected(f.saved, version)
			joinedAt := time.Now()
			compatLoginAndDisconnect(t, address, f.name, password, f.saved.Class)
			var actual *database.Character
			deadline := time.Now().Add(15 * time.Second)
			for time.Now().Before(deadline) {
				actual, err = db.GetCharacter(f.name, f.name)
				if err == nil && actual.LastLogout.After(joinedAt) {
					break
				}
				time.Sleep(50 * time.Millisecond)
			}
			if err != nil || actual == nil || !actual.LastLogout.After(joinedAt) {
				t.Fatalf("phase%d fixture%d: actual disconnect snapshot was not persisted", phase, i)
			}
			if actual.ProgressionVersion != version || actual.Level != expected.Level || actual.XP != expected.XP ||
				actual.Gold != expected.Gold || actual.SkillPoints != expected.SkillPoints || actual.Stats != expected.Stats ||
				actual.ResonanceLevel != expected.ResonanceLevel || actual.ResonanceXP != expected.ResonanceXP ||
				actual.ResonancePoints != expected.ResonancePoints || !reflect.DeepEqual(actual.ResonanceRanks, expected.ResonanceRanks) {
				t.Fatalf("phase%d fixture%d: progression/assets changed unexpectedly (level%d XP%d version%d)", phase, i, actual.Level, actual.XP, actual.ProgressionVersion)
			}
			if !reflect.DeepEqual(actual.Equipment, expected.Equipment) {
				t.Fatalf("phase%d fixture%d: equipped earned gear changed", phase, i)
			}
			for _, container := range []struct {
				name             string
				actual, expected []database.Item
			}{
				{"bag", actual.Inventory, expected.Inventory}, {"stash", actual.Stash, expected.Stash},
				{"buyback", actual.Buyback, expected.Buyback},
			} {
				items := []database.Item{}
				for _, item := range container.actual {
					if item.ID != "" {
						items = append(items, item)
					}
				}
				if !reflect.DeepEqual(items, container.expected) {
					t.Fatalf("phase%d fixture%d: %s earned items or Forge precision changed", phase, i, container.name)
				}
			}
			for _, promised := range f.saved.Quests[:3] {
				var found *database.Quest
				for j := range actual.Quests {
					if actual.Quests[j].ID == promised.ID {
						found = &actual.Quests[j]
						break
					}
				}
				if found == nil || found.Count != promised.Count || found.MaxCount != promised.MaxCount ||
					found.RewardXP != promised.RewardXP || found.RewardGold != promised.RewardGold ||
					found.InvestigationMask != promised.InvestigationMask || found.LegacyOptional != promised.LegacyOptional ||
					found.Completed != promised.Completed || found.Accepted != promised.Accepted {
					t.Fatalf("phase%d fixture%d: quest promise/discovery lost for %s", phase, i, promised.ID)
				}
			}
			// Keep the three protected fixtures at the front of our expectation;
			// the actual catalog can legitimately reorder and append definitions.
			expected.ProgressionVersion = version
			f.saved = expected
		}
		stop()
		t.Logf("COMPAT phase=%d version=%d actual_login_disconnect_saves=%d", phase, version, len(fixtures))
	}
}

func compatRequirement(version, level int) int {
	if version <= 1 {
		return int(100 * math.Pow(1.2, float64(level-1)))
	}
	return 100 + 25*(level-1)*(level-1)
}

func compatExpected(before *database.Character, version int) *database.Character {
	after := *before
	oldLevel := before.Level
	if oldLevel < 100 {
		for after.Level < 100 && after.XP >= compatRequirement(before.ProgressionVersion, after.Level) {
			after.XP -= compatRequirement(before.ProgressionVersion, after.Level)
			after.Level++
		}
		if after.Level == 100 {
			after.ResonanceXP += after.XP
		} else if max(1, before.ProgressionVersion) != version {
			after.XP = int(int64(after.XP) * int64(compatRequirement(version, after.Level)) / int64(compatRequirement(before.ProgressionVersion, after.Level)))
		}
	}
	if after.Level == 100 {
		after.XP = compatRequirement(version, 100)
	}
	levels := after.Level - oldLevel
	after.Stats.Strength += 2 * levels
	after.Stats.Vitality += 2 * levels
	after.Stats.Dexterity += levels
	after.Stats.Intelligence += levels
	after.Stats.Wisdom += levels
	return &after
}

func compatStartServer(t *testing.T, binary, uri string, phase int) (string, func()) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	listener.Close()
	evidence, err := os.MkdirTemp("", "eidolon-compat-session-")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("COMPAT phase=%d owned_server_evidence=%s", phase, evidence)
	logFile, err := os.Create(filepath.Join(evidence, "server.log"))
	if err != nil {
		t.Fatal(err)
	}
	command := exec.Command(binary, "-addr", address, "-mongo-uri", uri,
		"-log-file", "", "-suspicious-log-file", "", "-economy-metrics-file", "")
	command.Stdout, command.Stderr = logFile, logFile
	if err := command.Start(); err != nil {
		logFile.Close()
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	stopped := false
	stop := func() {
		if stopped {
			return
		}
		stopped = true
		command.Process.Signal(os.Interrupt)
		select {
		case err := <-done:
			if err != nil {
				t.Errorf("phase%d owned server shutdown failed: %v (evidence %s)", phase, err, evidence)
			}
		case <-time.After(5 * time.Second):
			command.Process.Kill()
			<-done
			t.Errorf("phase%d owned server required forced shutdown (evidence %s)", phase, evidence)
		}
		logFile.Close()
		contents, err := os.ReadFile(filepath.Join(evidence, "server.log"))
		if err != nil {
			t.Error(err)
			return
		}
		for _, marker := range []string{"WARNING: DATA RACE", "panic:", "fatal error:", "Worker panic:", "Recovered from panic in Update:"} {
			if strings.Contains(string(contents), marker) {
				t.Errorf("phase%d owned server contains %q (evidence %s)", phase, marker, evidence)
			}
		}
	}
	t.Cleanup(stop)
	client := &http.Client{Timeout: time.Second}
	for attempt := 0; attempt < 60; attempt++ {
		select {
		case err := <-done:
			stopped = true
			logFile.Close()
			t.Fatalf("phase%d owned server exited: %v", phase, err)
		default:
		}
		response, err := client.Get("http://" + address + "/healthz")
		if err == nil {
			var health struct{ Status, Database, Commit string }
			decodeErr := json.NewDecoder(response.Body).Decode(&health)
			response.Body.Close()
			if decodeErr == nil && response.StatusCode == 200 && health.Status == "ok" && health.Database == "ready" && health.Commit == filepath.Base(binary) {
				return address, stop
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("phase%d owned build never became ready", phase)
	return "", stop
}

func compatLoginAndDisconnect(t *testing.T, address, username, password, class string) {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	send := func(kind string, payload any) {
		if err := conn.WriteJSON(map[string]any{"type": kind, "payload": payload}); err != nil {
			t.Fatal(err)
		}
	}
	send("login", map[string]string{"username": username, "password": password})
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message struct{ Type string }
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == "error" {
			t.Fatal("ordinary compatibility login/join rejected")
		}
		if message.Type == "login_success" {
			send("join", map[string]string{"type": class})
		}
		if message.Type == "quest_update" {
			return
		}
	}
}
