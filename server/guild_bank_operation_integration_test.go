package main

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
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

type bankSettlementFaultStore struct {
	*database.DB
	stage     string
	triggered bool
}

func (store *bankSettlementFaultStore) fail(stage string) error {
	if store.stage == stage && !store.triggered {
		store.triggered = true
		return fmt.Errorf("injected guild bank storage failure at %s", stage)
	}
	return nil
}

func (store *bankSettlementFaultStore) ReserveGuildBankOperation(id, fingerprint string) (*database.Guild, error) {
	if err := store.fail("reserve-before"); err != nil {
		return nil, err
	}
	value, err := store.DB.ReserveGuildBankOperation(id, fingerprint)
	if err == nil {
		err = store.fail("reserve-after")
	}
	return value, err
}

func (store *bankSettlementFaultStore) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	if err := store.fail("character-before"); err != nil {
		return err
	}
	if err := store.DB.CommitCharacterSave(username, character, saveID); err != nil {
		return err
	}
	return store.fail("character-after")
}

func (store *bankSettlementFaultStore) ApplyGuildBankOperation(id, fingerprint string) (*database.Guild, error) {
	if err := store.fail("guild-before"); err != nil {
		return nil, err
	}
	value, err := store.DB.ApplyGuildBankOperation(id, fingerprint)
	if err == nil {
		err = store.fail("guild-after")
	}
	return value, err
}

func (store *bankSettlementFaultStore) FinishGuildBankOperation(id, fingerprint, state string) (*database.GuildBankOperation, error) {
	if err := store.fail("finish-before"); err != nil {
		return nil, err
	}
	value, err := store.DB.FinishGuildBankOperation(id, fingerprint, state)
	if err == nil {
		err = store.fail("finish-after")
	}
	return value, err
}

func (store *bankSettlementFaultStore) ReleaseGuildBankOperation(id, fingerprint string) error {
	if err := store.fail("release-before"); err != nil {
		return err
	}
	if err := store.DB.ReleaseGuildBankOperation(id, fingerprint); err != nil {
		return err
	}
	return store.fail("release-after")
}

func guildBankDisposableURI(t *testing.T) string {
	t.Helper()
	uri := os.Getenv("MONGO_URI")
	if os.Getenv("EIDOLON_GUILD_DISPOSABLE_DATABASE") != "1" ||
		!regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/eidolon(?:\?.*)?$`).MatchString(uri) {
		t.Skip("requires explicitly disposable loopback MongoDB")
	}
	return uri
}

func bankSettlementFixture(t *testing.T, action string) (*database.DB, database.GuildBankOperation, string, *database.Character, *database.Guild) {
	t.Helper()
	uri := guildBankDisposableURI(t)
	dir, fixture, op := bankCharacterRecoveryFixture(t)
	oldStore := guildBankOperations
	t.Cleanup(func() { guildBankOperations = oldStore })
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Close(context.Background()) })
	username := fmt.Sprintf("bank-settlement-%d", time.Now().UnixNano())
	character := cloneBankRecoveryCharacter(fixture.character)
	character.Name = username
	op.Username, op.CharacterName, op.PlayerID = username, username, "player-"+username
	op.Action = action
	item := database.Item{ID: "exact-earned-blade", Name: "Rare Guild Blade", Stack: 1, MaxStack: 1,
		Rarity: "Rare", Potency: 4, Stats: map[string]int{"strength": 17, "damage": 38}, Sockets: 1,
		Gems: []database.SocketedGem{{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 4}}}}
	if action == database.GuildBankDepositItem || action == database.GuildBankWithdrawItem {
		payload, err := json.Marshal(item)
		if err != nil {
			t.Fatal(err)
		}
		op.Gold, op.ItemPayload = 0, string(payload)
		if action == database.GuildBankDepositItem {
			character.Inventory = []database.Item{item}
		}
	}
	if err := repo.CreateUser(username, "", "disposable-fixture-password"); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateCharacter(username, character); err != nil {
		t.Fatal(err)
	}
	// Tags have only 65536 fixture values. The shared disposable database
	// retains earlier fixtures, so a random collision must not fail recovery QA.
	var guild *database.Guild
	for attempt := 0; attempt < 16; attempt++ {
		bytes := make([]byte, 2)
		if _, err := crand.Read(bytes); err != nil {
			t.Fatal(err)
		}
		tag := "B" + hex.EncodeToString(bytes)
		guild, err = repo.CreateGuild("Bank "+tag, tag, op.PlayerID, username)
		if err == nil || !strings.Contains(err.Error(), "guild name, tag, or membership is already in use") {
			break
		}
	}
	if err != nil {
		t.Fatal(err)
	}
	if action == database.GuildBankWithdrawGold {
		guild, err = repo.DepositGuildGold(guild.ID, op.PlayerID, 5000)
	}
	if action == database.GuildBankWithdrawItem {
		guild, err = repo.DepositGuildItem(guild.ID, op.PlayerID, item)
	}
	if err != nil {
		t.Fatal(err)
	}
	op.GuildID, op.GuildVersion = guild.ID, guild.Version
	op.ID = database.GuildBankOperationID(username, op.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	if _, err := repo.PrepareGuildBankOperation(op); err != nil {
		t.Fatal(err)
	}
	beforeCharacter, err := repo.GetCharacter(username, username)
	if err != nil {
		t.Fatal(err)
	}
	beforeGuild, err := repo.GetGuildByID(guild.ID)
	if err != nil {
		t.Fatal(err)
	}
	guildBankOperations, characterSaveCommitter = repo, repo
	return repo, op, dir, beforeCharacter, beforeGuild
}

func assertBankSettlement(t *testing.T, repo *database.DB, op database.GuildBankOperation, beforeCharacter *database.Character, beforeGuild *database.Guild) {
	t.Helper()
	character, err := repo.GetCharacter(op.Username, op.CharacterName)
	if err != nil || !guildBankCharacterReceiptMatches(character, op) {
		t.Fatal("exact durable character receipt missing", err)
	}
	guild, err := repo.GetGuildByID(op.GuildID)
	if err != nil || guild.PendingBankOperationID != "" || guild.PendingBankFingerprint != "" ||
		guild.LastBankOperationID != op.ID || guild.LastBankOperationFingerprint != op.Fingerprint || guild.Version != op.GuildVersion+2 {
		t.Fatal("guild effect/terminal release receipt incorrect", err)
	}
	unchanged := cloneBankRecoveryCharacter(character)
	switch op.Action {
	case database.GuildBankDepositGold, database.GuildBankWithdrawGold:
		delta := op.Gold
		if op.Action == database.GuildBankDepositGold {
			delta = -delta
		}
		if character.Gold != beforeCharacter.Gold+delta || guild.Bank.Gold != beforeGuild.Bank.Gold-delta {
			t.Fatal("Gold was lost or duplicated between wallet and shared bank")
		}
		unchanged.Gold = beforeCharacter.Gold
	case database.GuildBankDepositItem:
		if len(character.Inventory) != 1 || !reflect.DeepEqual(character.Inventory[0], database.Item{}) ||
			len(guild.Bank.Items) != 1 || !reflect.DeepEqual(guild.Bank.Items[0], beforeCharacter.Inventory[0]) {
			t.Fatal("item deposit did not preserve the exact complete item")
		}
		unchanged.Inventory = beforeCharacter.Inventory
	case database.GuildBankWithdrawItem:
		if len(character.Inventory) != game.MaxInventorySize || len(guild.Bank.Items) != 0 ||
			!reflect.DeepEqual(character.Inventory[0], beforeCharacter.Inventory[0]) ||
			!reflect.DeepEqual(character.Inventory[1], beforeGuild.Bank.Items[0]) {
			t.Fatal("item withdrawal was lost, duplicated or changed legacy gear")
		}
		for _, extra := range character.Inventory[2:] {
			if !reflect.DeepEqual(extra, database.Item{}) {
				t.Fatal("item delivery changed an unrelated slot")
			}
		}
		unchanged.Inventory = beforeCharacter.Inventory
	}
	unchanged.GuildBankRevision, unchanged.GuildBankOpID, unchanged.GuildBankOpFingerprint, unchanged.LastSaveID =
		beforeCharacter.GuildBankRevision, beforeCharacter.GuildBankOpID, beforeCharacter.GuildBankOpFingerprint, beforeCharacter.LastSaveID
	if !reflect.DeepEqual(beforeCharacter, unchanged) {
		t.Fatal("settlement changed unrelated complete character state")
	}
	count := 0
	for _, entry := range guild.Audit {
		if entry.OperationID == op.ID {
			count++
		}
	}
	if count != 1 {
		t.Fatal("bank settlement audit must record the effect exactly once", count)
	}
	intent, err := repo.GetGuildBankOperation(op.ID)
	if err != nil || intent.State != database.GuildBankComplete {
		t.Fatal("both durable effects did not produce terminal completion", err)
	}
}

func TestGuildBankSchedulerMongoStartupRecoversPendingAndTerminalHolds(t *testing.T) {
	uri := guildBankDisposableURI(t)
	for _, stage := range []string{"character-after", "finish-after"} {
		t.Run(stage, func(t *testing.T) {
			repo, op, dir, beforeCharacter, beforeGuild := bankSettlementFixture(t, database.GuildBankDepositGold)
			oldCache := guildBankPending.accounts
			oldStopping := serverStopping.Load()
			t.Cleanup(func() {
				guildBankPending.accounts = oldCache
				serverStopping.Store(oldStopping)
			})
			fault := &bankSettlementFaultStore{DB: repo, stage: stage}
			guildBankOperations, characterSaveCommitter = fault, fault
			unlock := lockCharacterWork(op.Username)
			_, err := completeGuildBankOperationLocked(op)
			unlock()
			if err == nil || !fault.triggered {
				t.Fatal("expected interrupted settlement", err)
			}
			if err := repo.Close(context.Background()); err != nil {
				t.Fatal(err)
			}
			reopened, err := database.New(uri)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = reopened.Close(context.Background()) })
			guildBankOperations, characterSaveCommitter = reopened, reopened
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			failedCharacterSaves.users = make(map[string]bool)
			guildBankPending.accounts = make(map[string]map[string]pendingGuildBankOperation)
			serverStopping.Store(false)
			if err := recoverGuildBankOperationsOnStartup(); err != nil {
				t.Fatal("startup did not discover/recover durable transfer", err)
			}
			assertBankSettlement(t, reopened, op, beforeCharacter, beforeGuild)
			if len(guildBankPending.accounts) != 0 {
				t.Fatal("completed startup left account admission blocked")
			}
		})
	}
}

func TestGuildBankSettlementMongoRecoveryAcrossEveryDurabilityBoundary(t *testing.T) {
	uri := guildBankDisposableURI(t)
	for _, action := range []string{database.GuildBankDepositGold, database.GuildBankWithdrawGold, database.GuildBankDepositItem, database.GuildBankWithdrawItem} {
		stages := []string{"character-after", "guild-after"}
		if action == database.GuildBankDepositGold {
			stages = []string{"reserve-before", "reserve-after", "character-before", "character-after", "guild-before", "guild-after", "finish-before", "finish-after", "release-before", "release-after"}
		}
		for _, stage := range stages {
			t.Run(action+"/"+stage, func(t *testing.T) {
				repo, op, dir, beforeCharacter, beforeGuild := bankSettlementFixture(t, action)
				fault := &bankSettlementFaultStore{DB: repo, stage: stage}
				guildBankOperations, characterSaveCommitter = fault, fault
				unlock := lockCharacterWork(op.Username)
				_, err := completeGuildBankOperationLocked(op)
				unlock()
				if err == nil || !fault.triggered {
					t.Fatal("uncertain storage result was incorrectly acknowledged", err)
				}
				if err := repo.Close(context.Background()); err != nil {
					t.Fatal(err)
				}
				reopened, err := database.New(uri)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { _ = reopened.Close(context.Background()) })
				guildBankOperations, characterSaveCommitter = reopened, reopened
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				failedCharacterSaves.users = make(map[string]bool)
				// Captured payload cannot change the durable first plan.
				captured := op
				captured.Gold, captured.ItemPayload = 999999, `{"ID":"not-the-earned-item","Stack":1}`
				unlock = lockCharacterWork(op.Username)
				completed, err := completeGuildBankOperationLocked(captured)
				unlock()
				if err != nil || completed.State != database.GuildBankComplete {
					t.Fatal("reopened settlement did not complete", err)
				}
				assertBankSettlement(t, reopened, op, beforeCharacter, beforeGuild)
				saved, _ := reopened.GetCharacter(op.Username, op.CharacterName)
				guild, _ := reopened.GetGuildByID(op.GuildID)
				unlock = lockCharacterWork(op.Username)
				_, err = completeGuildBankOperationLocked(op)
				unlock()
				replayed, _ := reopened.GetCharacter(op.Username, op.CharacterName)
				replayedGuild, _ := reopened.GetGuildByID(op.GuildID)
				if err != nil || !reflect.DeepEqual(saved, replayed) || !reflect.DeepEqual(guild, replayedGuild) {
					t.Fatal("terminal replay changed an already-settled wallet/bank/save receipt", err)
				}
				if users, err := characterSaveJournal.PendingUsers(); err != nil || len(users) != 0 {
					t.Fatal("confirmed complete character snapshot remains pending", err)
				}
			})
		}
	}
}

func TestGuildBankSettlementRejectsOnlyUnappliedGoldAndItems(t *testing.T) {
	for _, scenario := range []string{"insufficient-gold", "full-bag"} {
		t.Run(scenario, func(t *testing.T) {
			action := database.GuildBankDepositGold
			if scenario == "full-bag" {
				action = database.GuildBankWithdrawItem
			}
			repo, op, _, beforeCharacter, beforeGuild := bankSettlementFixture(t, action)
			if scenario == "insufficient-gold" {
				// Fixture setup replaces an unapplied intent with a larger amount.
				if _, err := repo.FinishGuildBankOperation(op.ID, op.Fingerprint, database.GuildBankRejected); err != nil {
					t.Fatal(err)
				}
				op.RequestID, op.Gold = "request_1234567891", beforeCharacter.Gold+1
				op.ID = database.GuildBankOperationID(op.Username, op.RequestID)
				op.Fingerprint = database.GuildBankOperationFingerprint(op)
				if _, err := repo.PrepareGuildBankOperation(op); err != nil {
					t.Fatal(err)
				}
			} else {
				// Inventory can fill after an intent was planned, for example when
				// a party reward arrives. Failure must not remove the bank item.
				beforeCharacter.Inventory = nil
				for i := 0; i < game.MaxInventorySize; i++ {
					beforeCharacter.Inventory = append(beforeCharacter.Inventory, database.Item{
						ID: fmt.Sprintf("occupied-slot-%d", i), Stack: 1, MaxStack: 1,
					})
				}
				if err := repo.SaveCharacter(op.Username, beforeCharacter); err != nil {
					t.Fatal(err)
				}
			}
			unlock := lockCharacterWork(op.Username)
			rejected, err := completeGuildBankOperationLocked(op)
			unlock()
			if err != nil || rejected.State != database.GuildBankRejected {
				t.Fatal("unapplied invalid character effect did not receive a terminal rejection", err)
			}
			after, err := repo.GetCharacter(op.Username, op.CharacterName)
			if err != nil || !reflect.DeepEqual(beforeCharacter, after) {
				t.Fatal("rejected transfer changed the complete character or wallet", err)
			}
			guild, err := repo.GetGuildByID(op.GuildID)
			if err != nil || guild.PendingBankOperationID != "" || guild.Version != op.GuildVersion+1 ||
				!reflect.DeepEqual(guild.Bank, beforeGuild.Bank) || !reflect.DeepEqual(guild.Audit, beforeGuild.Audit) {
				t.Fatal("rejected transfer changed bank contents/audit or retained a reservation", err)
			}
			unlock = lockCharacterWork(op.Username)
			replayed, err := completeGuildBankOperationLocked(op)
			unlock()
			if err != nil || replayed.State != database.GuildBankRejected {
				t.Fatal("terminal rejection was not replayable", err)
			}
			latestGuild, _ := repo.GetGuildByID(op.GuildID)
			if !reflect.DeepEqual(guild, latestGuild) {
				t.Fatal("rejected replay released or mutated the guild twice")
			}
		})
	}
}

func TestGuildBankSettlementNeverRejectsOrRefundsAPartialDurableEffect(t *testing.T) {
	repo, op, _, beforeCharacter, beforeGuild := bankSettlementFixture(t, database.GuildBankDepositGold)
	fault := &bankSettlementFaultStore{DB: repo, stage: "guild-before"}
	guildBankOperations, characterSaveCommitter = fault, fault
	unlock := lockCharacterWork(op.Username)
	_, err := completeGuildBankOperationLocked(op)
	unlock()
	if err == nil || !fault.triggered {
		t.Fatal("partly settled transfer was reported complete", err)
	}
	guildBankOperations, characterSaveCommitter = repo, repo
	unlock = lockCharacterWork(op.Username)
	_, err = rejectUnappliedGuildBankOperationLocked(op)
	unlock()
	if err == nil {
		t.Fatal("a durable character debit was hidden by rejection/refund")
	}
	intent, _ := repo.GetGuildBankOperation(op.ID)
	guild, _ := repo.GetGuildByID(op.GuildID)
	character, _ := repo.GetCharacter(op.Username, op.CharacterName)
	if intent.State != database.GuildBankPending || guild.PendingBankOperationID != op.ID ||
		character.Gold != beforeCharacter.Gold-op.Gold || guild.Bank.Gold != beforeGuild.Bank.Gold {
		t.Fatal("partial settlement changed its financial effect or released recovery fences")
	}
	unlock = lockCharacterWork(op.Username)
	completed, err := completeGuildBankOperationLocked(op)
	unlock()
	if err != nil || completed.State != database.GuildBankComplete {
		t.Fatal(err)
	}
	assertBankSettlement(t, repo, op, beforeCharacter, beforeGuild)
}

func TestGuildBankSettlementOldRequestNeverReappliesAfterNewBoundedReceipts(t *testing.T) {
	repo, first, _, _, _ := bankSettlementFixture(t, database.GuildBankDepositGold)
	wrongIdentity := first
	wrongIdentity.Username = "another-account"
	unlock := lockCharacterWork(first.Username)
	_, err := completeGuildBankOperationLocked(wrongIdentity)
	unlock()
	if !errors.Is(err, database.ErrGuildBankOperationConflict) {
		t.Fatal("captured intent could execute under another account identity", err)
	}
	unlock = lockCharacterWork(first.Username)
	_, err = completeGuildBankOperationLocked(first)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	character, _ := repo.GetCharacter(first.Username, first.CharacterName)
	guild, _ := repo.GetGuildByID(first.GuildID)
	second := first
	second.RequestID, second.Gold, second.GuildVersion, second.CharacterBankRevision =
		"request_1234567891", 100, guild.Version, character.GuildBankRevision
	second.ID = database.GuildBankOperationID(second.Username, second.RequestID)
	second.Fingerprint = database.GuildBankOperationFingerprint(second)
	if _, err := repo.PrepareGuildBankOperation(second); err != nil {
		t.Fatal(err)
	}
	unlock = lockCharacterWork(second.Username)
	_, err = completeGuildBankOperationLocked(second)
	unlock()
	if err != nil {
		t.Fatal(err)
	}
	before, _ := repo.GetCharacter(first.Username, first.CharacterName)
	beforeGuild, _ := repo.GetGuildByID(first.GuildID)
	if before.Gold != 650 || before.GuildBankRevision != 2 || before.GuildBankOpID != second.ID ||
		beforeGuild.Bank.Gold != 350 || beforeGuild.LastBankOperationID != second.ID {
		t.Fatal("new legitimate transfer was not settled with fresh bounded receipts")
	}
	unlock = lockCharacterWork(first.Username)
	_, err = completeGuildBankOperationLocked(first)
	unlock()
	after, _ := repo.GetCharacter(first.Username, first.CharacterName)
	afterGuild, _ := repo.GetGuildByID(first.GuildID)
	if err != nil || !reflect.DeepEqual(before, after) || !reflect.DeepEqual(beforeGuild, afterGuild) {
		t.Fatal("old terminal request changed later wallet/bank/save receipts", err)
	}
}
