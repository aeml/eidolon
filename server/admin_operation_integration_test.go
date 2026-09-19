package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type rejectedAdminCommit struct{}

func (rejectedAdminCommit) CommitCharacterSave(string, *database.Character, string) error {
	return errors.New("test-injected database write failure")
}

// Real Mongo plus the real private full-save journal. This verifies persistence
// boundaries only; authenticated socket admission and UI are separate gates.
func TestAdminGrantMongoFullSaveJournalRecovery(t *testing.T) {
	if os.Getenv("EIDOLON_ADMIN_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires explicitly disposable loopback Mongo")
	}
	uri := os.Getenv("MONGO_URI")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires isolated loopback Mongo")
	}
	for _, action := range []string{MsgAdminGrantGold, MsgAdminGrantItem} {
		t.Run(action, func(t *testing.T) {
			dir, _ := setupCharacterJournalTest(t)
			oldOperations := adminOperations
			t.Cleanup(func() { adminOperations = oldOperations })
			repo, err := database.New(uri)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { repo.Close(context.Background()) })
			username := fmt.Sprintf("admin-grant-%d", time.Now().UnixNano())
			if err := repo.CreateUser(username, username+"@example.invalid", "temporary-test-password"); err != nil {
				t.Fatal(err)
			}
			baseline := &database.Character{Name: username, Class: "Fighter", Level: 30, Gold: 100,
				XP: 41, EP: 7, InstanceID: "expired-instance", LastLogout: time.Unix(1700000000, 0).UTC(),
				Resources:  &database.CharacterResources{Version: 1, Health: 17, Mana: 0},
				WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 125},
				Equipment:  map[string]database.Item{"head": {ID: "earned-head", Stats: map[string]int{"vitality": 7}}}}
			if err := repo.CreateCharacter(username, baseline); err != nil {
				t.Fatal(err)
			}
			grant := game.AdminGrant{Action: action}
			if action == MsgAdminGrantGold {
				grant.Amount = 10
			} else {
				grant.Items, err = game.GenerateAdminItems(game.AdminItemSpec{Item: "iron-sword", Rarity: game.RarityRare, Level: 70, Quantity: 2})
				if err != nil {
					t.Fatal(err)
				}
			}
			payload, _ := json.Marshal(grant)
			audit, err := database.NewAdminActivity(username, username, action, "request-123456789", "success", "Granted requested reward.", time.Now(), 90)
			if err != nil {
				t.Fatal(err)
			}
			audit.Reason = "Restore a verified test reward."
			op, err := repo.PrepareAdminOperation(database.AdminOperation{Version: 1,
				ID: database.AdminOperationID(username, audit.RequestID), Fingerprint: strings.Repeat("a", 64), Actor: username, Target: username,
				RequestID: audit.RequestID, Action: action, Payload: payload, State: database.AdminOperationPending, Audit: audit})
			if err != nil {
				t.Fatal(err)
			}
			adminOperations, characterSaveCommitter = repo, rejectedAdminCommit{}
			if _, err := completeAdminOperationLocked(*op); err == nil {
				t.Fatal("failed character write acknowledged")
			}
			stored, err := repo.GetCharacter(username, username)
			if err != nil || stored.Gold != 100 || len(stored.AdminOperationReceipts) != 0 {
				t.Fatal("failed commit changed stored character", err)
			}
			history, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: username})
			if err != nil || len(history.Entries) != 0 {
				t.Fatal("failed save published success audit", err)
			}
			repo.Close(context.Background())
			// Reopen both durable stores and discard process-only state. No live
			// entity or fabricated dungeon timestamp is needed for grant recovery.
			reopened, err := database.New(uri)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.Close(context.Background())
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			failedCharacterSaves.users = make(map[string]bool)
			adminOperations, characterSaveCommitter = reopened, reopened
			completed, err := completeAdminOperationLocked(*op)
			if err != nil || completed.State != database.AdminOperationComplete {
				t.Fatal("recovery failed", err)
			}
			stored, err = reopened.GetCharacter(username, username)
			if err != nil {
				t.Fatal(err)
			}
			if stored.AdminOperationReceipts[op.ID] != op.Fingerprint || stored.XP != baseline.XP || stored.EP != baseline.EP ||
				stored.InstanceID != baseline.InstanceID || !stored.LastLogout.Equal(baseline.LastLogout) ||
				!reflect.DeepEqual(stored.Equipment, baseline.Equipment) || !reflect.DeepEqual(stored.Resources, baseline.Resources) || !reflect.DeepEqual(stored.WellRested, baseline.WellRested) {
				t.Fatal("full-save recovery lost state or extended the dungeon logout deadline")
			}
			if action == MsgAdminGrantGold && stored.Gold != 110 {
				t.Fatal("Gold grant not applied exactly once")
			}
			if action == MsgAdminGrantItem && (stored.Gold != 100 || stored.Inventory[0].ID != grant.Items[0].ID || stored.Inventory[1].ID != grant.Items[1].ID) {
				t.Fatal("item rolls changed or grant duplicated")
			}
			lastSave := stored.LastSaveID
			if _, err := completeAdminOperationLocked(*op); err != nil {
				t.Fatal(err)
			}
			stored, err = reopened.GetCharacter(username, username)
			if err != nil || stored.LastSaveID != lastSave {
				t.Fatal("completed replay issued another save", err)
			}
			history, err = reopened.ReadAdminActivity(database.AdminActivityQuery{Actor: username})
			if err != nil || len(history.Entries) != 1 || history.Entries[0].ID != audit.ID || history.Entries[0].Reason != audit.Reason {
				t.Fatal("audit not recorded once with its reason", err)
			}
			if pending, err := characterSaveJournal.Read(username); err != nil || pending != nil {
				t.Fatal("full-save journal was not acknowledged", err)
			}
		})
	}
}
