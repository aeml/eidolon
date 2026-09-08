package main

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

type resourceInstanceScene struct {
	InstanceID string             `json:"instanceId"`
	Type       string             `json:"type"`
	Layout     game.DungeonLayout `json:"layout"`
}

func resourceReadScene(t *testing.T, connection *websocket.Conn) resourceInstanceScene {
	t.Helper()
	var scene resourceInstanceScene
	resourceReadMessage(t, connection, MsgEnterInstance, &scene)
	return scene
}

// Ordinary portal entry and real casts; explicit partial-room/death save fixtures
// test restart compatibility, not earned dungeon clears or a player-caused wipe.
func TestResourceActualDungeonRestartAndTownRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, dead := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/dead=%v", class, dead), func(t *testing.T) {
				fixture, password := resourceJournalFixture(t, repo)
				fixture.Class = class
				fixture.Resources.Mana = 0
				if class == "Wizard" {
					fixture.Resources.Mana = 100
				}
				if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
					t.Fatal(err)
				}
				dir := t.TempDir()
				address, stop := compatStartServer(t, binary, uri, 50, "-save-journal-dir", dir)
				connection, _ := resourceLoginCharacter(t, address, fixture.Name, password, class)
				resourceSend(t, connection, MsgGetDungeonStatus, map[string]string{"dungeonType": "verdant_bastion_catacombs"})
				resourceReadMessage(t, connection, MsgGetDungeonStatus, nil) // Ordinary solo-party creation.
				resourceSend(t, connection, MsgEnterDungeon, map[string]any{"dungeonType": "verdant_bastion_catacombs", "difficulty": "normal", "runLevel": 30})
				initialScene := resourceReadScene(t, connection)
				if !strings.HasPrefix(initialScene.InstanceID, "dungeon_") || initialScene.Type != "verdant_bastion_catacombs" || len(initialScene.Layout.Rooms) < 3 || initialScene.Layout.GenerationSeed == "" {
					t.Fatal("ordinary entry did not create a real regional dungeon")
				}
				mana := 0
				if class == "Wizard" {
					start := initialScene.Layout.Rooms[0]
					resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball", TargetX: start.X + 1, TargetZ: start.Z})
					var cast game.AbilityResult
					resourceReadMessage(t, connection, MsgAbilityResult, &cast)
					if !cast.Accepted || cast.Mana != 70 {
						t.Fatalf("ordinary dungeon Fireball failed: %+v", cast)
					}
					mana = 70
				} else {
					resourceProbe(t, connection, 0, false)
				}
				saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
				if saved.Resources.Health != 17 || saved.Resources.Mana != mana || saved.InstanceID != initialScene.InstanceID || saved.DungeonProgress == nil {
					t.Fatal("ordinary dungeon disconnect changed resources or lost its resume snapshot")
				}
				stop()
				// The final shutdown save is authoritative; modify only the explicit
				// prepared room/death fixture after its process has stopped.
				saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
				if err != nil {
					t.Fatal(err)
				}
				if saved.DungeonProgress == nil || len(saved.DungeonProgress.Rooms) < 3 {
					t.Fatal("no partial-progress fixture target")
				}
				saved.DungeonProgress.Rooms[1] = database.DungeonRoomProgress{Explored: true, Cleared: true, Rewarded: true}
				if dead {
					saved.Resources.Health, saved.Resources.Dead = 0, true
				}
				if err := repo.SaveCharacter(fixture.Name, saved); err != nil {
					t.Fatal(err)
				}
				address, stopRecovered := compatStartServer(t, binary, uri, 51, "-save-journal-dir", dir)
				defer stopRecovered()
				connection, _ = resourceLoginCharacter(t, address, fixture.Name, password, class)
				restoredScene := resourceReadScene(t, connection)
				if restoredScene.InstanceID != initialScene.InstanceID || !reflect.DeepEqual(restoredScene.Layout, initialScene.Layout) {
					t.Fatal("fresh-process login changed the authoritative dungeon layout/seed")
				}
				resourceProbe(t, connection, mana, dead)
				restored := resourceCloseAndWait(t, repo, connection, fixture.Name)
				if !reflect.DeepEqual(restored.Resources, saved.Resources) || restored.Gold != saved.Gold || restored.XP != saved.XP ||
					!reflect.DeepEqual(restored.Equipment, saved.Equipment) || !reflect.DeepEqual(restored.DungeonProgress, saved.DungeonProgress) {
					t.Fatal("fresh-process dungeon restore changed resources, room rewards or unrelated character state")
				}
				connection, _ = resourceLoginCharacter(t, address, fixture.Name, password, class)
				resourceReadScene(t, connection) // Consume the resumed dungeon scene before requesting town.
				recovery := MsgRecall
				if dead {
					resourceSend(t, connection, MsgRecall, TownRecoveryPayload{})
					var rejection string
					resourceReadMessage(t, connection, MsgError, &rejection)
					if !strings.Contains(rejection, "use Respawn") {
						t.Fatal("dead character bypassed proper recovery")
					}
					recovery = MsgRespawn
				}
				resourceSend(t, connection, recovery, TownRecoveryPayload{})
				resourceReadMessage(t, connection, MsgMovementContext, nil)
				town := resourceReadScene(t, connection)
				if town.InstanceID != "" || town.Type != "overworld" {
					t.Fatal("normal recovery did not return to the overworld")
				}
				want := &database.CharacterResources{Version: 1, Health: 17, Mana: mana}
				if dead {
					want.Health, want.Mana = 145, 445
				}
				resourceProbe(t, connection, want.Mana, false)
				final := resourceCloseAndWait(t, repo, connection, fixture.Name)
				if !reflect.DeepEqual(final.Resources, want) || final.InstanceID != "" || final.DungeonProgress != nil || final.X != -1.25 || final.Z != 200 ||
					final.Gold != saved.Gold || final.XP != saved.XP || !reflect.DeepEqual(final.Equipment, saved.Equipment) {
					t.Fatal("town recovery changed rewards/equipment or violated normal Recall/Respawn resource rules")
				}
			})
		}
	}
}
