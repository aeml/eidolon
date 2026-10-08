package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
)

// Opt-in disposable Mongo only, using the existing bounded process/socket/save
// helpers. Prepared compatibility fixtures, not earned progression or a soak.
func TestTerrainActualSavedSessionsAcrossProfileChanges(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	secret := make([]byte, 24)
	if _, err := rand.Read(secret); err != nil {
		t.Fatal(err)
	}
	password := hex.EncodeToString(secret)
	prefix := "terrain-save-" + hex.EncodeToString(secret[:6])
	var fixtures []*database.Character
	for index, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		name := fmt.Sprintf("%s-%d", prefix, index)
		stat := map[string]string{"Fighter": "strength", "Rogue": "dexterity", "Wizard": "intelligence", "Cleric": "intelligence"}[class]
		gear := database.Item{ID: name + "-chest", Name: "Robes", Type: "ARMOR", Slot: "chest", Rarity: "RARE",
			Level: 1, Potency: 2, Stack: 1, MaxStack: 1, Stats: map[string]int{stat: 7}, StatScaleVersion: game.ItemStatScaleVersion}
		bag, stash, buyback := gear, gear, gear
		bag.ID, stash.ID, buyback.ID = name+"-bag", name+"-stash", name+"-buyback"
		fixture := &database.Character{Name: name, Class: class, Level: 31, XP: 17,
			ProgressionVersion: game.CurrentProgressionVersion, Gold: 4567, EP: 9,
			X: -102, Y: 0, Z: -321, LastDailyQuest: time.Now().Truncate(time.Millisecond),
			// Zero regen attributes isolate short load/save checks from ordinary
			// elapsed recovery. No live-player regen or combat rule is changed.
			Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
			Resources: &database.CharacterResources{Version: 1, Health: 37, Mana: 13},
			Equipment: map[string]database.Item{"chest": gear}, Inventory: []database.Item{bag},
			Stash: []database.Item{stash}, Buyback: []database.Item{buyback},
			Quests: []database.Quest{{ID: "chronicle_01_bell_below", Type: "KILL", Target: "Skeleton",
				Category: "chronicle", Accepted: true, Count: 1, MaxCount: 3}},
			ResonanceLevel: 3, ResonanceXP: 456, ResonancePoints: 1,
			ResonanceRanks: map[string]int{"power": 1, "ward": 1},
		}
		if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
			t.Fatal(err)
		}
		if err := repo.SetFirstCharacter(name, fixture); err != nil {
			t.Fatal(err)
		}
		fixtures = append(fixtures, fixture)
	}
	journal := t.TempDir()
	for phase, profile := range []string{game.FlatTerrainProfile, game.RaisedEarthTerrainProfile, game.FlatTerrainProfile, game.RaisedEarthTerrainProfile} {
		address, stop := compatStartServer(t, binary, uri, 1870+phase,
			"-terrain-profile", profile, "-save-journal-dir", journal)
		for index, fixture := range fixtures {
			connection, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { connection.Close() })
			resourceSend(t, connection, MsgLogin, map[string]string{"username": fixture.Name, "password": password})
			var login struct {
				TerrainProfile string `json:"terrainProfile"`
			}
			resourceReadMessage(t, connection, "login_success", &login)
			if login.TerrainProfile != profile {
				t.Fatalf("phase%d/%s negotiated the wrong terrain", phase, fixture.Class)
			}
			resourceSend(t, connection, MsgJoin, JoinPayload{Type: fixture.Class})
			resourceReadMessage(t, connection, MsgQuestUpdate, nil)
			actor := wellRestedReadActor(t, connection, fixture.Name, func(*statepb.Entity) bool { return true })
			saved := resourceCloseAndWait(t, repo, connection, fixture.Name)
			if saved.InstanceID != "" || math.Hypot(saved.X-float64(actor.X), saved.Z-float64(actor.Z)) > .001 ||
				math.Abs(saved.Y-float64(actor.Y)) > .001 {
				t.Fatalf("phase%d/%s saved position differs from authoritative joined actor", phase, fixture.Class)
			}
			if profile == game.FlatTerrainProfile {
				if saved.Y != 0 || saved.X != fixture.X || saved.Z != fixture.Z {
					t.Fatalf("phase%d/%s flat position (%g,%g,%g), expected (%g,0,%g)", phase, fixture.Class,
						saved.X, saved.Y, saved.Z, fixture.X, fixture.Z)
				}
			} else {
				if saved.Y <= 1 || math.Hypot(saved.X+102, saved.Z+321) > 25 {
					t.Fatalf("phase%d/%s raised admission failed local height/escape bounds", phase, fixture.Class)
				}
				if phase == 1 && saved.X == fixture.X && saved.Z == fixture.Z {
					t.Fatal("legacy save inside the new rock formation was not recovered")
				}
				if phase == 3 && (saved.X != fixture.X || saved.Z != fixture.Z) {
					t.Fatal("re-enabling terrain moved the already corrected character again")
				}
			}
			if phase == 0 {
				if saved.Gold != 4567 || saved.EP != 9 || saved.Level != 31 || saved.XP != 17 ||
					!reflect.DeepEqual(saved.Resources, fixture.Resources) || !reflect.DeepEqual(saved.Equipment, fixture.Equipment) {
					t.Fatal("flat baseline failed to retain prepared progression, resources, currency or equipped gear")
				}
			} else {
				// Permit only the intended terrain coordinate correction and the
				// fresh save receipt/logout timestamp. Compare every other stored
				// character field, including all containers and quest/build data.
				before, after := *fixture, *saved
				before.X, before.Y, before.Z = after.X, after.Y, after.Z
				before.LastLogout, before.LastSaveID = after.LastLogout, after.LastSaveID
				if !reflect.DeepEqual(before, after) {
					t.Fatalf("phase%d/%s terrain profile changed non-position saved character fields", phase, fixture.Class)
				}
			}
			fixtures[index] = saved
		}
		stop() // No second writer is started until the original process exits.
		t.Logf("phase%d %s: four ordinary logins and fresh Mongo disconnect saves passed", phase, profile)
	}
}
