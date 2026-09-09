package main

import (
	"fmt"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
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
				entryStarted := time.Now()
				beforeEntry := townFixtureRead(t, connection, fixture, 0)
				resourceSend(t, connection, MsgGetDungeonStatus, map[string]string{"dungeonType": "verdant_bastion_catacombs"})
				resourceReadMessage(t, connection, MsgGetDungeonStatus, nil) // Ordinary solo-party creation.
				resourceSend(t, connection, MsgEnterDungeon, map[string]any{"dungeonType": "verdant_bastion_catacombs", "difficulty": "normal", "runLevel": 30})
				initialScene := resourceReadScene(t, connection)
				if !strings.HasPrefix(initialScene.InstanceID, "dungeon_") || initialScene.Type != "verdant_bastion_catacombs" || len(initialScene.Layout.Rooms) < 3 || initialScene.Layout.GenerationSeed == "" {
					t.Fatal("ordinary entry did not create a real regional dungeon")
				}
				entered := wellRestedReadActorAfter(t, connection, fixture.Name, time.Now(), func(e *statepb.Entity) bool { return e.InstanceId == initialScene.InstanceID && e.SafeZoneId == "" })
				// Portal latency permits only bounded ordinary town healing before
				// departure. A rest expiry can clamp a pool to its lower maximum.
				elapsed := time.Since(entryStarted).Seconds()
				for _, pool := range [][4]float64{{float64(beforeEntry.Health), float64(entered.Health), float64(entered.MaxHealth), 159}, {float64(beforeEntry.Mana), float64(entered.Mana), float64(entered.MaxMana), 489}} {
					lower := math.Min(pool[0], pool[2])
					upper := math.Min(pool[2], pool[0]+math.Ceil(pool[3]*.1*elapsed)+1)
					if pool[1] < lower || pool[1] > upper {
						t.Fatalf("portal altered resources beyond possible town recovery: %v interval[%f,%f]", pool, lower, upper)
					}
				}
				// Zero Vitality/Wisdom means exactly no passive regeneration here.
				// Wait for the small legitimately earned town bank to expire using
				// real server time, then assert exact bars and real cast costs.
				settled := wellRestedReadActorAfter(t, connection, fixture.Name, time.Now().Add(300*time.Millisecond), func(e *statepb.Entity) bool { return e.WellRestedSeconds == 0 })
				if settled.SafeZoneId != "" || settled.MaxHealth != 145 || settled.MaxMana != 445 || settled.Health != min(entered.Health, 145) || settled.Mana != min(entered.Mana, 445) {
					t.Fatal("dungeon healed resources or failed to expire/clamp rested maxima")
				}
				health, mana := int(settled.Health), int(settled.Mana)
				if class == "Wizard" {
					start := initialScene.Layout.Rooms[0]
					resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball", TargetX: start.X + 1, TargetZ: start.Z})
					var cast game.AbilityResult
					resourceReadMessage(t, connection, MsgAbilityResult, &cast)
					if !cast.Accepted || cast.Mana != mana-30 {
						t.Fatalf("ordinary dungeon Fireball failed: %+v", cast)
					}
					mana -= 30
				} else {
					resourceProbe(t, connection, mana, false)
				}
				saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
				if saved.Resources.Health != health || saved.Resources.Mana != mana || saved.WellRested != nil || saved.InstanceID != initialScene.InstanceID || saved.DungeonProgress == nil {
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
				expected := *restored
				if dead {
					expected.Resources = &database.CharacterResources{Version: 1, Health: 145, Mana: 445}
				}
				townFixtureProbe(t, connection, &expected)
				final := resourceCloseAndWait(t, repo, connection, fixture.Name)
				assertTownFixtureSave(t, &expected, final, 0)
				if final.InstanceID != "" || final.DungeonProgress != nil || final.X != -1.25 || final.Z != 200 ||
					final.Gold != saved.Gold || final.XP != saved.XP || !reflect.DeepEqual(final.Equipment, saved.Equipment) {
					t.Fatal("town recovery changed rewards/equipment or violated normal Recall/Respawn resource rules")
				}
			})
		}
	}
}
