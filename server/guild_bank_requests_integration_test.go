package main

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type bankHandlerFaultStore struct{ *bankSettlementFaultStore }

// Ordinary full saves omit empty inventory slots and advance LastLogout.
// Compare complete gameplay state and exact nonempty items here; the separate
// offline coordinator matrix keeps its stricter slot/timestamp assertions.
func assertBankHandlerSettlement(t *testing.T, repo *database.DB, op database.GuildBankOperation, baseline *database.Character, beforeGuild *database.Guild) {
	t.Helper()
	actual, err := repo.GetCharacter(op.Username, op.CharacterName)
	if err != nil || !guildBankCharacterReceiptMatches(actual, op) {
		t.Fatal("handler's durable character receipt missing", err)
	}
	compact := func(items []database.Item) []database.Item {
		result := make([]database.Item, 0)
		for _, item := range items {
			if item.ID != "" {
				result = append(result, item)
			}
		}
		return result
	}
	expected := cloneBankRecoveryCharacter(baseline)
	bankGold := beforeGuild.Bank.Gold
	expected.Inventory = compact(expected.Inventory)
	actual.Inventory = compact(actual.Inventory)
	switch op.Action {
	case database.GuildBankDepositGold:
		expected.Gold -= op.Gold
		bankGold += op.Gold
	case database.GuildBankWithdrawGold:
		expected.Gold += op.Gold
		bankGold -= op.Gold
	case database.GuildBankDepositItem:
		if len(expected.Inventory) != 1 {
			t.Fatal("deposit fixture must contain exactly the intended item")
		}
		expected.Inventory = make([]database.Item, 0)
	case database.GuildBankWithdrawItem:
		expected.Inventory = append(expected.Inventory, beforeGuild.Bank.Items[0])
	}
	if actual.LastLogout.Before(baseline.LastLogout) {
		t.Fatal("new full save moved the save timestamp backwards")
	}
	expected.LastLogout, expected.LastSaveID = actual.LastLogout, actual.LastSaveID
	expected.GuildBankRevision, expected.GuildBankOpID, expected.GuildBankOpFingerprint = op.CharacterBankRevision+1, op.ID, op.Fingerprint
	if !reflect.DeepEqual(expected, actual) {
		t.Fatal("normal handler changed unrelated gameplay state or exact item metadata")
	}
	guild, err := repo.GetGuildByID(op.GuildID)
	if err != nil || guild.Bank.Gold != bankGold || guild.Version != op.GuildVersion+2 || guild.PendingBankOperationID != "" ||
		guild.LastBankOperationID != op.ID || guild.LastBankOperationFingerprint != op.Fingerprint {
		t.Fatal("normal handler did not settle/release exactly one bank effect", err)
	}
	if op.Action == database.GuildBankDepositItem {
		var item database.Item
		if json.Unmarshal([]byte(op.ItemPayload), &item) != nil || len(guild.Bank.Items) != 1 || !reflect.DeepEqual(guild.Bank.Items[0], item) {
			t.Fatal("deposited complete item changed or duplicated")
		}
	}
	if op.Action == database.GuildBankWithdrawItem && len(guild.Bank.Items) != 0 {
		t.Fatal("withdrawn item remains in shared bank")
	}
	count := 0
	for _, entry := range guild.Audit {
		if entry.OperationID == op.ID {
			count++
		}
	}
	intent, err := repo.GetGuildBankOperation(op.ID)
	if err != nil || intent.State != database.GuildBankComplete || count != 1 {
		t.Fatal("normal handler lacks one permanent completion/audit", err, count)
	}
}

func (store *bankHandlerFaultStore) PrepareGuildBankOperation(op database.GuildBankOperation) (*database.GuildBankOperation, error) {
	value, err := store.DB.PrepareGuildBankOperation(op)
	if err == nil {
		err = store.fail("prepare-after")
	}
	return value, err
}

func (store *bankHandlerFaultStore) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	if character.GuildBankOpID == "" {
		return store.DB.CommitCharacterSave(username, character, saveID) // New intent's prerequisite baseline.
	}
	return store.bankSettlementFaultStore.CommitCharacterSave(username, character, saveID)
}

func TestGuildBankNormalHandlersMongoPlanSettleRecoverAndReplay(t *testing.T) {
	uri := guildBankDisposableURI(t)
	cases := []struct{ action, kind, stage string }{
		{database.GuildBankDepositGold, MsgGuildBankDeposit, "prepare-after"},
		{database.GuildBankDepositGold, MsgGuildBankDeposit, "character-after"},
		{database.GuildBankWithdrawGold, MsgGuildBankWithdraw, "guild-after"},
		{database.GuildBankDepositItem, MsgGuildBankDeposit, "finish-after"},
		{database.GuildBankWithdrawItem, MsgGuildBankWithdraw, "release-after"},
	}
	for _, scenario := range cases {
		t.Run(scenario.action+"/"+scenario.stage, func(t *testing.T) {
			repo, previous, dir, original, beforeGuild := bankSettlementFixture(t, scenario.action)
			// Retire the fixture-only intent without effects so the normal handler
			// must plan and insert a genuinely new request from its live actor.
			if _, err := repo.FinishGuildBankOperation(previous.ID, previous.Fingerprint, database.GuildBankRejected); err != nil {
				t.Fatal(err)
			}
			oldSessions, oldCache := activeSessions, guildBankPending.accounts
			t.Cleanup(func() { activeSessions, guildBankPending.accounts = oldSessions, oldCache })
			guildBankPending.accounts = make(map[string]map[string]pendingGuildBankOperation)
			world = game.NewWorld(nil)
			player := &game.Entity{ID: previous.PlayerID, Name: previous.Username, Type: game.TypePlayer,
				SubType: "Wizard", Level: 75, Experience: 1234, Gold: original.Gold, EP: 17, Health: 17, Mana: 9,
				WellRestedSeconds: 600, State: "IDLE", GuildID: previous.GuildID,
				Equipment:            map[string]game.Item{"chest": gameItemFromDatabaseExact(original.Equipment["chest"])},
				ItemDeliveryReceipts: map[string]string{"earlier-item": "earlier-fingerprint"}}
			for _, item := range original.Inventory {
				player.Inventory = append(player.Inventory, gameItemFromDatabaseExact(item))
			}
			world.AddEntity(player)
			client := &Client{username: previous.Username, playerID: previous.PlayerID, send: make(chan []byte, 100)}
			activeSessions = map[string]*Client{client.username: client}
			characterSaveCommitter = repo
			if err := persistCharacterSnapshot(client.username, characterSnapshotForSave(client.username, world.GetEntityCopy(player.ID))); err != nil {
				t.Fatal(err)
			}
			baseline, err := repo.GetCharacter(client.username, client.username)
			if err != nil {
				t.Fatal(err)
			}
			fault := &bankHandlerFaultStore{bankSettlementFaultStore: &bankSettlementFaultStore{DB: repo, stage: scenario.stage}}
			guildBankOperations, characterSaveCommitter = fault, fault
			request := GuildBankPayload{RequestID: "normal-handler-request-123456", Gold: previous.Gold}
			if previous.ItemPayload != "" {
				request.Gold, request.ItemID = 0, "exact-earned-blade"
			}
			result := bankHandlerResult(t, client, scenario.kind, request)
			if result.Status != "pending" || result.RequestID != request.RequestID || !fault.triggered {
				t.Fatal("handler acknowledged an unknown storage outcome", result)
			}
			id := database.GuildBankOperationID(client.username, request.RequestID)
			op, err := repo.GetGuildBankOperation(id)
			if err != nil || op == nil || op.Action != scenario.action {
				t.Fatal("handler did not persist its first immutable plan", err)
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
			world = nil // Recovery cannot rely on the old actor, session or cache.
			activeSessions = make(map[string]*Client)
			failedCharacterSaves.users = make(map[string]bool)
			guildBankPending.accounts = make(map[string]map[string]pendingGuildBankOperation)
			if err := recoverGuildBankOperationsOnStartup(); err != nil {
				t.Fatal("normal-handler intent failed restart recovery", err)
			}
			assertBankHandlerSettlement(t, reopened, *op, baseline, beforeGuild)
			world = game.NewWorld(nil)
			world.AddEntity(player) // Terminal replay must not plan against this old bag/wallet.
			activeSessions[client.username] = client
			if result := bankHandlerResult(t, client, scenario.kind, request); result.Status != database.GuildBankComplete {
				t.Fatal("same handler request was not acknowledged after recovery", result)
			}
			assertBankHandlerSettlement(t, reopened, *op, baseline, beforeGuild)
		})
	}
}
