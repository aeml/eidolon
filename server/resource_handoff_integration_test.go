package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func resourceReadMessage(t *testing.T, conn *websocket.Conn, wanted string, payload any) {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == MsgError && wanted != MsgError {
			t.Fatalf("ordinary resource session rejected: %s", message.Payload)
		}
		if message.Type == wanted {
			if payload != nil {
				if err := json.Unmarshal(message.Payload, payload); err != nil {
					t.Fatal(err)
				}
			}
			return
		}
	}
}

func resourceSend(t *testing.T, conn *websocket.Conn, kind string, payload any) {
	t.Helper()
	if err := conn.WriteJSON(map[string]any{"type": kind, "payload": payload}); err != nil {
		t.Fatal(err)
	}
}

func resourceOpenCharacter(t *testing.T, address, username, password string) *websocket.Conn {
	conn, _ := resourceLoginCharacter(t, address, username, password, "Wizard")
	return conn
}

func resourceLoginCharacter(t *testing.T, address, username, password, class string) (*websocket.Conn, string) {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	resourceSend(t, conn, MsgLogin, map[string]string{"username": username, "password": password})
	var login struct {
		ResumeToken string `json:"resumeToken"`
	}
	resourceReadMessage(t, conn, "login_success", &login)
	if login.ResumeToken == "" {
		t.Fatal("login omitted resume token")
	}
	resourceSend(t, conn, MsgJoin, JoinPayload{Type: class})
	resourceReadMessage(t, conn, MsgQuestUpdate, nil)
	return conn, login.ResumeToken
}

// Real sockets and the production server; zero Wisdom isolates resource
// preservation from elapsed regeneration. No gameplay balance is changed.
func TestResourceActualLiveHandoff(t *testing.T) {
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
	name := fmt.Sprintf("resource-handoff-%d", time.Now().UnixNano())
	password := name + "-prepared-only"
	fixture := &database.Character{Name: name, Class: "Wizard", Level: 1,
		ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200, Gold: 1234,
		LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
		Resources: &database.CharacterResources{Version: 1, Health: 17, Mana: 100},
		Equipment: map[string]database.Item{"chest": {ID: "handoff-chest", Name: "Handoff Chest", Type: "ARMOR", Slot: "chest", Rarity: "RARE", Level: 1, Stack: 1, MaxStack: 1,
			StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{"vitality": 20}}}}
	if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetFirstCharacter(name, fixture); err != nil {
		t.Fatal(err)
	}
	// An offline refund must preserve every resource and equipment field.
	if err := repo.CreditCharacterGold(name, name, 43); err != nil {
		t.Fatal(err)
	}
	credited, err := repo.GetCharacter(name, name)
	if err != nil || credited.Gold != 1277 || !reflect.DeepEqual(credited.Resources, fixture.Resources) || !reflect.DeepEqual(credited.Equipment, fixture.Equipment) {
		t.Fatal("gold credit replaced unrelated state")
	}
	if err := repo.CreditCharacterGold(name, name, -1); err == nil {
		t.Fatal("negative credit accepted")
	}
	if err := repo.CreditCharacterGold(name, "missing", 1); err == nil {
		t.Fatal("missing character credit accepted")
	}

	address, stop := compatStartServer(t, binary, uri, 10, "-save-journal-dir", t.TempDir())
	defer stop()
	first := resourceOpenCharacter(t, address, name, password)
	resourceSend(t, first, MsgAbility, AbilityPayload{SkillName: "Fireball", TargetX: -1.25, TargetZ: 220})
	var cast game.AbilityResult
	resourceReadMessage(t, first, MsgAbilityResult, &cast)
	if !cast.Accepted || cast.Mana != 70 {
		t.Fatalf("prepared ordinary cast: %+v", cast)
	}
	// Repeated Join must keep live mana/cooldowns even while the saved bar is100.
	for i := 0; i < 2; i++ {
		resourceSend(t, first, MsgJoin, JoinPayload{Type: "Wizard"})
		var cooldowns struct {
			Cooldowns map[string]float64 `json:"cooldowns"`
		}
		resourceReadMessage(t, first, MsgAbilityCooldowns, &cooldowns)
		if cooldowns.Cooldowns["Fireball"] <= 0 {
			t.Fatal("repeated Join lost active cooldown")
		}
		resourceReadMessage(t, first, MsgQuestUpdate, nil)
		resourceSend(t, first, MsgAbility, AbilityPayload{SkillName: "Fireball"})
		resourceReadMessage(t, first, MsgAbilityResult, &cast)
		if cast.Accepted || cast.Reason != "cooldown" || cast.Mana != 70 {
			t.Fatalf("repeated Join changed mana/cooldown: %+v", cast)
		}
	}
	// Login from a second socket while the first remains open. The first must
	// lose authority, and its later transport cleanup may not retire the second.
	second := resourceOpenCharacter(t, address, name, password)
	first.Close()
	resourceSend(t, second, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
	resourceReadMessage(t, second, MsgAbilityResult, &cast)
	if cast.Accepted || cast.Mana != 70 {
		t.Fatalf("replacement login changed mana: %+v", cast)
	}
	// Give old transport cleanup time to run, then prove the new owner still works.
	time.Sleep(200 * time.Millisecond)
	resourceSend(t, second, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
	resourceReadMessage(t, second, MsgAbilityResult, &cast)
	if cast.Accepted || cast.Mana != 70 {
		t.Fatalf("old cleanup changed new owner: %+v", cast)
	}
	beforeClose, err := repo.GetCharacter(name, name)
	if err != nil {
		t.Fatal(err)
	}
	closedAt := time.Now()
	second.Close()
	deadline := time.Now().Add(10 * time.Second)
	var lastSaved *database.Character
	for time.Now().Before(deadline) {
		saved, err := repo.GetCharacter(name, name)
		lastSaved = saved
		if err == nil && resourceFreshDisconnect(saved, beforeClose.LastLogout, closedAt) {
			if saved.Resources == nil || saved.Resources.Mana != 70 || saved.Resources.Dead || saved.Resources.Health < 17 || saved.Resources.Health > 18 || saved.Gold != 1277 || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
				t.Fatalf("handoff saved wrong state: resources=%+v gold=%d", saved.Resources, saved.Gold)
			}
			t.Log("real cast, two repeated joins, overlapping login, late old disconnect, new-owner command and final resource save passed")
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("replacement owner did not persist fresh disconnect: prior=%s closed=%s last=%+v", beforeClose.LastLogout.Format(time.RFC3339Nano), closedAt.Format(time.RFC3339Nano), lastSaved)
}

// BSON DateTime stores milliseconds. A save immediately after socket closure
// can therefore round down before the nanosecond local timestamp. Require a
// strictly newer persisted save AND the closure time at storage precision.
func resourceFreshDisconnect(saved *database.Character, previous, closedAt time.Time) bool {
	return saved != nil && saved.LastLogout.After(previous) &&
		!saved.LastLogout.Before(closedAt.Truncate(time.Millisecond))
}

func TestResourceFreshDisconnectUsesBSONPrecisionWithoutAcceptingOldSave(t *testing.T) {
	closedAt := time.Unix(100, 123456789)
	previous := closedAt.Add(-time.Second).Truncate(time.Millisecond)
	for _, tc := range []struct {
		name         string
		saved, prior time.Time
		want         bool
	}{
		{"same storage millisecond", closedAt.Truncate(time.Millisecond), previous, true},
		{"later save", closedAt.Add(time.Millisecond).Truncate(time.Millisecond), previous, true},
		{"earlier millisecond", closedAt.Truncate(time.Millisecond).Add(-time.Millisecond), previous, false},
		{"unchanged previous save", previous, previous, false},
		{"unchanged in closure millisecond", closedAt.Truncate(time.Millisecond), closedAt.Truncate(time.Millisecond), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			actual := resourceFreshDisconnect(&database.Character{LastLogout: tc.saved}, tc.prior, closedAt)
			if actual != tc.want {
				t.Fatalf("fresh=%v want=%v", actual, tc.want)
			}
		})
	}
	if resourceFreshDisconnect(nil, previous, closedAt) {
		t.Fatal("missing save accepted")
	}
}
