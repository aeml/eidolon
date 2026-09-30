package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type bankCharacterMongoCommitter struct {
	store      *database.DB
	failBefore bool
	failAfter  bool
}

func (committer *bankCharacterMongoCommitter) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	if committer.failBefore {
		return errors.New("injected database failure before commit")
	}
	if err := committer.store.CommitCharacterSave(username, character, saveID); err != nil {
		return err
	}
	if committer.failAfter {
		return errors.New("injected acknowledgement loss after commit")
	}
	return nil
}

// Character-side durability only: a saved intent must stay pending until the
// future coordinator also confirms the guild effect. Never use a live database.
func TestGuildBankCharacterMongoRecoveryKeepsExactSnapshotAndReceipt(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if os.Getenv("EIDOLON_GUILD_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/eidolon(?:\?.*)?$`).MatchString(uri) {
		t.Skip("requires explicitly disposable loopback MongoDB")
	}
	for _, action := range []string{database.GuildBankDepositGold, database.GuildBankWithdrawItem} {
		for _, failure := range []string{"before-commit", "after-commit"} {
			t.Run(action+"/"+failure, func(t *testing.T) {
				dir, fixture, op := bankCharacterRecoveryFixture(t)
				store, err := database.New(uri)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { _ = store.Close(context.Background()) })
				username := fmt.Sprintf("bank-recovery-%s-%s-%d", action, failure, time.Now().UnixNano())
				character := cloneBankRecoveryCharacter(fixture.character)
				character.Name = username
				op.Username, op.CharacterName, op.PlayerID, op.GuildID = username, username, "player-"+username, "guild-"+username
				item := database.Item{ID: "mongo-earned-blade", Name: "Rare Guild Blade", Stack: 1, MaxStack: 1,
					Rarity: "Rare", Potency: 4, Stats: map[string]int{"damage": 38}, StatScaleVersion: 1,
					Gems: []database.SocketedGem{{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 4}}}}
				if action == database.GuildBankWithdrawItem {
					payload, err := json.Marshal(item)
					if err != nil {
						t.Fatal(err)
					}
					op.Action, op.Gold, op.ItemPayload = action, 0, string(payload)
				}
				op.ID = database.GuildBankOperationID(username, op.RequestID)
				op.Fingerprint = database.GuildBankOperationFingerprint(op)
				cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() {
					// This deliberately character-only fixture has no guild side.
					// Keep its pending assertion below, then remove ONLY its exact
					// disposable records so full startup tests see recoverable data.
					_, _ = cleanup.Database("eidolon").Collection("guild_bank_operations").DeleteOne(context.Background(), bson.M{"_id": op.ID, "username": username})
					_, _ = cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": username})
					_ = cleanup.Disconnect(context.Background())
				})
				if err := store.CreateUser(username, "", "disposable-fixture-password"); err != nil {
					t.Fatal(err)
				}
				if err := store.CreateCharacter(username, character); err != nil {
					t.Fatal(err)
				}
				before, err := store.GetCharacter(username, username)
				if err != nil {
					t.Fatal(err)
				}
				stored, err := store.PrepareGuildBankOperation(op)
				if err != nil {
					t.Fatal(err)
				}
				op = *stored
				characterSaveCommitter = &bankCharacterMongoCommitter{store: store,
					failBefore: failure == "before-commit", failAfter: failure == "after-commit"}
				unlock := lockCharacterWork(username)
				err = applyAndSaveGuildBankCharacterLocked(op, store)
				unlock()
				if err == nil {
					t.Fatal("unknown database acknowledgement was incorrectly accepted")
				}
				pending, err := characterSaveJournal.Read(username)
				if err != nil || pending == nil {
					t.Fatal("uncertain database result lost the durable complete snapshot", err)
				}
				if err := store.Close(context.Background()); err != nil {
					t.Fatal(err)
				}
				reopened, err := database.New(uri)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { _ = reopened.Close(context.Background()) })
				characterSaveCommitter = reopened
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				failedCharacterSaves.users = make(map[string]bool) // Process-memory loss.
				unlock = lockCharacterWork(username)
				err = applyAndSaveGuildBankCharacterLocked(op, reopened)
				unlock()
				if err != nil {
					t.Fatal(err)
				}
				saved, err := reopened.GetCharacter(username, username)
				if err != nil || !guildBankCharacterReceiptMatches(saved, op) || saved.LastSaveID != pending.SaveID {
					t.Fatal("recovery did not confirm the exact original durable receipt", err)
				}
				unchanged := cloneBankRecoveryCharacter(saved)
				if action == database.GuildBankDepositGold {
					if saved.Gold != before.Gold-op.Gold {
						t.Fatal("Gold debit was missing or duplicated")
					}
					unchanged.Gold = before.Gold
				} else {
					if len(saved.Inventory) != 25 || !reflect.DeepEqual(saved.Inventory[0], before.Inventory[0]) || !reflect.DeepEqual(saved.Inventory[1], item) {
						t.Fatal("item delivery lost its exact payload or changed legacy inventory")
					}
					for _, extra := range saved.Inventory[2:] {
						if !reflect.DeepEqual(extra, database.Item{}) {
							t.Fatal("item delivery changed an unrelated slot")
						}
					}
					unchanged.Inventory = before.Inventory
				}
				unchanged.GuildBankRevision, unchanged.GuildBankOpID, unchanged.GuildBankOpFingerprint, unchanged.LastSaveID =
					before.GuildBankRevision, before.GuildBankOpID, before.GuildBankOpFingerprint, before.LastSaveID
				if !reflect.DeepEqual(before, unchanged) {
					t.Fatal("MongoDB recovery changed unrelated complete character state")
				}
				unlock = lockCharacterWork(username)
				err = applyAndSaveGuildBankCharacterLocked(op, reopened)
				unlock()
				replayed, readErr := reopened.GetCharacter(username, username)
				if err != nil || readErr != nil || !reflect.DeepEqual(saved, replayed) {
					t.Fatal("saved replay changed the character or journal receipt", err, readErr)
				}
				if users, err := characterSaveJournal.PendingUsers(); err != nil || len(users) != 0 {
					t.Fatal("confirmed character journal was not acknowledged", err)
				}
				intent, err := reopened.GetGuildBankOperation(op.ID)
				if err != nil || intent.State != database.GuildBankPending {
					t.Fatal("character-only durability incorrectly completed guild settlement", err)
				}
			})
		}
	}
}
