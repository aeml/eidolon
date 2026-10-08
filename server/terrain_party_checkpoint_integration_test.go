package main

import (
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
)

// Opt-in disposable Mongo only. The approach rooms are prepared, but the boss
// kill, four-class consent/casts, credit and checkpoint are earned on sockets.
// This is profile/save compatibility, not a complete dungeon or pacing playtest.
func TestTerrainActualEarnedPartyCheckpointAcrossProfileChanges(t *testing.T) {
	testBossVictoryActualPartyKillCrashAndRecovery(t, true)
}

func terrainCheckpointLogin(t *testing.T, address, username, password, class, profile string) *websocket.Conn {
	t.Helper()
	connection, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	resourceSend(t, connection, MsgLogin, map[string]string{"username": username, "password": password})
	var login struct {
		TerrainProfile string `json:"terrainProfile"`
	}
	resourceReadMessage(t, connection, "login_success", &login)
	if login.TerrainProfile != profile {
		t.Fatalf("negotiated terrain %q, expected %q", login.TerrainProfile, profile)
	}
	resourceSend(t, connection, MsgJoin, JoinPayload{Type: class})
	resourceReadMessage(t, connection, MsgQuestUpdate, nil)
	return connection
}

func terrainEarnedPartyCheckpointRecovery(t *testing.T, repo *database.DB, uri, binary, journal, address string,
	stop func(), fixtures []*database.Character, passwords []string, record *database.BossVictoryRecord) {
	t.Helper()
	instanceID := record.InstanceID
	before := make([]*database.Character, len(fixtures))
	connections := make([]*websocket.Conn, len(fixtures))
	for i, fixture := range fixtures {
		var err error
		before[i], err = repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || before[i] == nil || before[i].DungeonProgress == nil {
			t.Fatal("no saved earned checkpoint", err)
		}
		connections[i] = terrainCheckpointLogin(t, address, fixture.Name, passwords[i], fixture.Class, game.FlatTerrainProfile)
		if scene := resourceReadScene(t, connections[i]); scene.InstanceID != instanceID {
			t.Fatal("party did not restore the original shared run")
		}
	}
	assertIdentity := func(index int, saved *database.Character, dungeon bool) {
		t.Helper()
		prior := before[index]
		if !database.BossVictoryCharacterReceiptMatches(saved, record.BossVictoryOperation) ||
			saved.Gold != prior.Gold || saved.XP != prior.XP || saved.Level != prior.Level || saved.EP != prior.EP ||
			!reflect.DeepEqual(saved.Equipment, prior.Equipment) || !reflect.DeepEqual(saved.Inventory, prior.Inventory) ||
			!reflect.DeepEqual(saved.PendingBossLoot, prior.PendingBossLoot) || !reflect.DeepEqual(saved.Quests, prior.Quests) {
			t.Fatalf("%s changed earned credit, manual turn-in, currency, gear or private loot", fixtures[index].Class)
		}
		if dungeon {
			progress := saved.DungeonProgress
			if saved.InstanceID != instanceID || progress == nil || progress.CreatedAt != prior.DungeonProgress.CreatedAt ||
				progress.PartyID != prior.PartyID || saved.PartyID != prior.PartyID ||
				!reflect.DeepEqual(progress.Layout, prior.DungeonProgress.Layout) ||
				!reflect.DeepEqual(progress.Rooms, prior.DungeonProgress.Rooms) || !progress.Rooms[2].Cleared || saved.Y != 0 {
				t.Fatal("terrain switch lost or rerolled the earned dungeon checkpoint")
			}
		}
	}
	// Keep the whole real party online. Recall everyone, then each member uses
	// the normal guide entry message; no instance IDs or room flags are injected.
	for i, connection := range connections {
		resourceSend(t, connection, MsgRecall, TownRecoveryPayload{})
		if scene := resourceReadScene(t, connection); scene.InstanceID != "" || scene.Type != "overworld" {
			t.Fatal("ordinary party Recall did not return to town")
		}
		wellRestedReadActor(t, connection, fixtures[i].Name, func(actor *statepb.Entity) bool {
			return actor.InstanceId == "" && actor.X == -1.25 && actor.Y == 0 && actor.Z == 200
		})
	}
	for i, connection := range connections {
		resourceSend(t, connection, MsgEnterDungeon, map[string]any{
			"dungeonType": "verdant_bastion_catacombs", "difficulty": "normal", "runLevel": 30,
		})
		if scene := resourceReadScene(t, connection); scene.InstanceID != instanceID {
			t.Fatal("guide entry replaced the party's active checkpoint run")
		}
		wellRestedReadActor(t, connection, fixtures[i].Name, func(actor *statepb.Entity) bool {
			return actor.InstanceId == instanceID && actor.X == 20000 && actor.Y == 0 && actor.Z == 19850
		})
		assertIdentity(i, resourceCloseAndWait(t, repo, connection, fixtures[i].Name), true)
	}
	stop() // A new profile never starts while the previous writer is alive.
	t.Log("earned four-class checkpoint: flat rollback, ordinary Recall/guide re-entry and fresh disconnect saves passed")

	address, stopRaised := compatStartServer(t, binary, uri, 747, "-save-journal-dir", journal, "-terrain-profile", game.RaisedEarthTerrainProfile)
	for i, fixture := range fixtures {
		connection := terrainCheckpointLogin(t, address, fixture.Name, passwords[i], fixture.Class, game.RaisedEarthTerrainProfile)
		if scene := resourceReadScene(t, connection); scene.InstanceID != instanceID {
			t.Fatal("raised reactivation replaced the saved dungeon")
		}
		wellRestedReadActor(t, connection, fixture.Name, func(actor *statepb.Entity) bool {
			return actor.InstanceId == instanceID && actor.X == 20000 && actor.Y == 0 && actor.Z == 19850
		})
		assertIdentity(i, resourceCloseAndWait(t, repo, connection, fixture.Name), true)
	}
	stopRaised()
	t.Log("earned four-class checkpoint: raised reactivation restored original ground, gear, loot, quest credit and run age")

	// Expiry is an explicit saved-time fixture, not a 16-minute sleep. Preserve
	// all other post-images and prove the user's existing 15-minute rule stays.
	for _, fixture := range fixtures {
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil {
			t.Fatal(err)
		}
		saved.LastLogout = time.Now().Add(-16 * time.Minute).Truncate(time.Millisecond)
		if err := repo.SaveCharacter(fixture.Name, saved); err != nil {
			t.Fatal(err)
		}
	}
	address, stopExpired := compatStartServer(t, binary, uri, 748, "-save-journal-dir", journal, "-terrain-profile", game.FlatTerrainProfile)
	for i, fixture := range fixtures {
		connection := terrainCheckpointLogin(t, address, fixture.Name, passwords[i], fixture.Class, game.FlatTerrainProfile)
		wellRestedReadActor(t, connection, fixture.Name, func(actor *statepb.Entity) bool {
			return actor.InstanceId == "" && actor.X == -1.25 && actor.Y == 0 && actor.Z == 200
		})
		saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
		assertIdentity(i, saved, false)
		if saved.InstanceID != "" || saved.DungeonProgress != nil {
			t.Fatal("expired logout retained a dungeon resume snapshot")
		}
	}
	stopExpired()
	t.Log("earned four-class checkpoint: explicit 16-minute saved logout expires to town without changing earned rewards")
}
