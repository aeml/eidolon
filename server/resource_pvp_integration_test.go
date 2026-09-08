package main

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

type resourcePvPStatus struct {
	Queued    int                 `json:"queued"`
	Challenge *game.DuelChallenge `json:"challenge"`
	Match     *game.PvPMatch      `json:"match"`
}

func resourceWaitPvPStatus(t *testing.T, connection *websocket.Conn, wanted func(resourcePvPStatus) bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var status resourcePvPStatus
		resourceReadMessage(t, connection, MsgPvPUpdate, &status)
		if wanted(status) {
			return
		}
	}
	t.Fatal("expected authoritative PvP state never arrived")
}

// Prepared level30 saves; ordinary consent/queue, scene entry, repeat Join,
// disconnect-forfeit or controlled restart and fresh credential logins. Arena
// entry/exit intentionally restores resources under the existing game policy.
func TestResourceActualPvPForfeitAndShutdownRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, route := range []string{"duel_disconnect", "arena_disconnect", "arena_shutdown"} {
		for _, classes := range [][]string{{"Fighter", "Wizard"}, {"Rogue", "Cleric"}, {"Fighter", "Wizard", "Rogue", "Cleric"}} {
			teamSize := len(classes) / 2
			if route == "duel_disconnect" && teamSize != 1 {
				continue // Practice duels are strictly one versus one.
			}
			t.Run(fmt.Sprintf("%s/%s", route, strings.Join(classes, "_")), func(t *testing.T) {
				dir := t.TempDir()
				address, stop := compatStartServer(t, binary, uri, 60, "-save-journal-dir", dir)
				fixtures := make([]*database.Character, len(classes))
				passwords := make([]string, len(classes))
				connections := make([]*websocket.Conn, len(classes))
				for i, class := range classes {
					fixture, password := resourceJournalFixture(t, repo)
					fixture.Class, fixture.Resources.Mana = class, 0
					if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
						t.Fatal(err)
					}
					fixtures[i], passwords[i] = fixture, password
					connections[i], _ = resourceLoginCharacter(t, address, fixture.Name, password, class)
					resourceProbe(t, connections[i], 0, false)
				}
				if route == "duel_disconnect" {
					resourceSend(t, connections[0], MsgDuelRequest, GuildTargetPayload{Username: fixtures[1].Name})
					resourceWaitPvPStatus(t, connections[1], func(status resourcePvPStatus) bool {
						return status.Challenge != nil && status.Challenge.RequesterID == "player-"+fixtures[0].Name
					})
					resourceSend(t, connections[1], MsgDuelRespond, DuelRespondPayload{RequesterID: "player-" + fixtures[0].Name, Accept: true})
				} else {
					if teamSize == 2 {
						for _, leader := range []int{0, 2} {
							resourceFormParty(t, connections[leader], connections[leader+1], fixtures[leader].Name, fixtures[leader+1].Name)
						}
					}
					resourceSend(t, connections[0], MsgArenaQueue, ArenaQueuePayload{TeamSize: teamSize})
					resourceWaitPvPStatus(t, connections[0], func(status resourcePvPStatus) bool { return status.Queued == teamSize })
					resourceSend(t, connections[teamSize], MsgArenaQueue, ArenaQueuePayload{TeamSize: teamSize})
				}
				firstScene := resourceReadScene(t, connections[0])
				if firstScene.Type != "pvp_arena" || firstScene.InstanceID == "" {
					t.Fatal("ordinary PvP admission did not enter an arena")
				}
				for _, connection := range connections[1:] {
					if scene := resourceReadScene(t, connection); scene.Type != "pvp_arena" || scene.InstanceID != firstScene.InstanceID {
						t.Fatal("ordinary PvP admission did not bind every teammate/opponent to one arena")
					}
				}
				for i, connection := range connections {
					resourceProbe(t, connection, 445, false)
					mana := 445
					if classes[i] == "Wizard" {
						resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball", TargetX: 0, TargetZ: 12})
						var cast game.AbilityResult
						resourceReadMessage(t, connection, MsgAbilityResult, &cast)
						if !cast.Accepted || cast.Mana != 415 {
							t.Fatalf("ordinary arena cast failed: %+v", cast)
						}
						mana = 415
					}
					resourceSend(t, connection, MsgJoin, JoinPayload{Type: classes[i]})
					resourceReadMessage(t, connection, MsgQuestUpdate, nil)
					if scene := resourceReadScene(t, connection); scene.InstanceID != firstScene.InstanceID {
						t.Fatal("repeat Join escaped PvP")
					}
					resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "not-an-unlocked-skill"})
					var probe game.AbilityResult
					resourceReadMessage(t, connection, MsgAbilityResult, &probe)
					if probe.Accepted || (probe.Reason != "locked" && probe.Reason != "global_cooldown") || probe.Mana != mana {
						t.Fatalf("repeat Join changed arena resources or skill authority: %+v", probe)
					}
				}
				if route != "arena_shutdown" {
					resourceCloseAndWait(t, repo, connections[0], fixtures[0].Name)
					for i := 1; i < len(connections); i++ {
						if scene := resourceReadScene(t, connections[i]); scene.InstanceID != "" || scene.Type != "overworld" {
							t.Fatal("forfeit did not restore every teammate/opponent's scene")
						}
						resourceCloseAndWait(t, repo, connections[i], fixtures[i].Name)
					}
				}
				stop()
				for _, fixture := range fixtures {
					saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
					if err != nil || !reflect.DeepEqual(saved.Resources, &database.CharacterResources{Version: 1, Health: 145, Mana: 445}) || saved.InstanceID != "" ||
						saved.X != fixture.X || saved.Z != fixture.Z || saved.Gold != fixture.Gold || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
						t.Fatal("PvP exit/shutdown failed existing recovery policy or changed unrelated state")
					}
				}
				address, stopRecovered := compatStartServer(t, binary, uri, 61, "-save-journal-dir", dir)
				defer stopRecovered()
				for i, fixture := range fixtures {
					connection, _ := resourceLoginCharacter(t, address, fixture.Name, passwords[i], classes[i])
					resourceProbe(t, connection, 445, false)
					saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
					if saved.Resources.Health != 145 || saved.Resources.Mana != 445 || saved.InstanceID != "" {
						t.Fatal("fresh-process login changed resolved arena resources")
					}
					profile, err := repo.GetPvPProfile("player-" + fixture.Name)
					if err != nil {
						t.Fatal(err)
					}
					wantRating, wantWins, wantLosses, wantHonor, wantPoints := 1000, 0, 0, 0, 0
					if route == "arena_disconnect" {
						if i < teamSize {
							wantRating, wantLosses, wantHonor, wantPoints = 980, 1, 15, 1
						} else {
							wantRating, wantWins, wantHonor, wantPoints = 1025, 1, 50, 3
						}
					}
					if profile.Rating != wantRating || profile.Wins != wantWins || profile.Losses != wantLosses || profile.Honor != wantHonor || profile.SeasonPoints != wantPoints {
						t.Fatalf("wrong or duplicated %s PvP result after reconnect: %+v", route, profile)
					}
				}
			})
		}
	}
}

// Exercise the same invitation/acceptance flow players use, not direct party
// injection. Wait for the complete membership before the leader queues 2v2.
func resourceFormParty(t *testing.T, leader, member *websocket.Conn, leaderName, memberName string) {
	t.Helper()
	resourceSend(t, leader, MsgPartyInvite, PartyInvitePayload{TargetName: memberName})
	var invite PartyRequestPayload
	resourceReadMessage(t, member, MsgPartyRequest, &invite)
	if invite.TargetName != leaderName {
		t.Fatal("party invitation came from the wrong player")
	}
	resourceSend(t, member, MsgPartyResponse, PartyResponsePayload{InviterName: leaderName, Accepted: true})
	for _, connection := range []*websocket.Conn{leader, member} {
		deadline := time.Now().Add(10 * time.Second)
		joined := false
		for time.Now().Before(deadline) {
			var party struct {
				LeaderID string `json:"leaderId"`
				Members  []struct {
					ID string `json:"id"`
				} `json:"members"`
			}
			resourceReadMessage(t, connection, MsgPartyUpdate, &party)
			if party.LeaderID == "player-"+leaderName && len(party.Members) == 2 {
				ids := map[string]bool{}
				for _, participant := range party.Members {
					ids[participant.ID] = true
				}
				joined = ids["player-"+leaderName] && ids["player-"+memberName]
				if joined {
					break
				}
			}
		}
		if !joined {
			t.Fatal("accepted invitation did not form the expected two-player party")
		}
	}
}
