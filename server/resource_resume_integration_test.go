package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

func resourceCloseAndWait(t *testing.T, repo *database.DB, conn *websocket.Conn, username string) *database.Character {
	t.Helper()
	prior, err := repo.GetCharacter(username, username)
	if err != nil {
		t.Fatal(err)
	}
	closedAt := time.Now()
	conn.Close()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		saved, err := repo.GetCharacter(username, username)
		if err == nil && resourceFreshDisconnect(saved, prior.LastLogout, closedAt) {
			return saved
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatal("no fresh saved disconnect after ordinary resource session")
	return nil
}

func resourceProbe(t *testing.T, conn *websocket.Conn, mana int, dead bool) {
	t.Helper()
	resourceSend(t, conn, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
	var result game.AbilityResult
	resourceReadMessage(t, conn, MsgAbilityResult, &result)
	want := "locked"
	if dead {
		want = "dead"
	}
	if result.Accepted || result.Reason != want || result.Mana != mana {
		t.Fatalf("resource/death probe got%+v want mana%d reason%s", result, mana, want)
	}
}

// Prepared saves, ordinary login/token resume/replay rejection/Recall/Respawn.
// Level30 fixtures retain ordinary town recovery. Exact bars are derived from
// each online bank interval, rather than treating requested healing as a refill.
func TestResourceActualTokenResumeAndDeathRecovery(t *testing.T) {
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
	address, stop := compatStartServer(t, binary, uri, 20, "-save-journal-dir", t.TempDir())
	defer stop()
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, dead := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dead=%v", class, dead), func(t *testing.T) {
				name := fmt.Sprintf("resource-resume-%s-%d", class, time.Now().UnixNano())
				password := name + "-prepared-only"
				hp := 17
				if dead {
					hp = 0
				}
				fixture := &database.Character{Name: name, Class: class, Level: 30,
					ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200, Gold: 1234,
					LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
					Resources: &database.CharacterResources{Version: 1, Health: hp, Mana: 0, Dead: dead}}
				if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
					t.Fatal(err)
				}
				if err := repo.SetFirstCharacter(name, fixture); err != nil {
					t.Fatal(err)
				}
				first, token := resourceLoginCharacter(t, address, name, password, class)
				townFixtureProbe(t, first, fixture)
				initialSave := resourceCloseAndWait(t, repo, first, name)
				assertTownFixtureSave(t, fixture, initialSave, 0)

				resumed, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { resumed.Close() })
				resourceSend(t, resumed, MsgResumeSession, map[string]string{"token": token})
				var reply struct {
					PlayerID    string `json:"playerID"`
					ResumeToken string `json:"resumeToken"`
				}
				resourceReadMessage(t, resumed, MsgResumeSession, &reply)
				if reply.PlayerID != "player-"+name || reply.ResumeToken == "" || reply.ResumeToken == token {
					t.Fatal("resume did not bind character and rotate token")
				}
				resourceReadMessage(t, resumed, MsgQuestUpdate, nil)
				townFixtureProbe(t, resumed, initialSave)

				replay, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { replay.Close() })
				resourceSend(t, replay, MsgResumeSession, map[string]string{"token": token})
				var rejection string
				resourceReadMessage(t, replay, MsgError, &rejection)
				if !strings.Contains(rejection, "Session token invalid or expired") {
					t.Fatalf("replay rejected for wrong reason: %s", rejection)
				}
				replay.Close()
				townFixtureProbe(t, resumed, initialSave)
				resumedSave := resourceCloseAndWait(t, repo, resumed, name)
				assertTownFixtureSave(t, initialSave, resumedSave, 0)

				// A subsequent ordinary login remains dead/empty until the normal
				// recovery command; living Recall is never a mana refill.
				third, _ := resourceLoginCharacter(t, address, name, password, class)
				townFixtureProbe(t, third, resumedSave)
				resourceSend(t, third, MsgRecall, TownRecoveryPayload{})
				if dead {
					resourceReadMessage(t, third, MsgError, &rejection)
					if !strings.Contains(rejection, "use Respawn") {
						t.Fatalf("dead recall rejected for wrong reason: %s", rejection)
					}
					townFixtureProbe(t, third, resumedSave)
					resourceSend(t, third, MsgRespawn, TownRecoveryPayload{})
				}
				resourceReadMessage(t, third, MsgMovementContext, nil)
				expected := *resumedSave
				if dead {
					expected.Resources = &database.CharacterResources{Version: 1, Health: 145, Mana: 245}
				}
				townFixtureProbe(t, third, &expected)
				final := resourceCloseAndWait(t, repo, third, name)
				assertTownFixtureSave(t, &expected, final, 0)
			})
		}
	}
}
