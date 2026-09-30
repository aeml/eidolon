package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type bankCharacterRecoveryRepository struct {
	character        *database.Character
	failBeforeCommit bool
	failAfterCommit  bool
	writes           int
}

func cloneBankRecoveryCharacter(character *database.Character) *database.Character {
	if character == nil {
		return nil
	}
	value, _ := json.Marshal(character)
	var copy database.Character
	_ = json.Unmarshal(value, &copy)
	return &copy
}

func (store *bankCharacterRecoveryRepository) GetCharacter(username, name string) (*database.Character, error) {
	if username != "bank-owner" || store.character == nil || store.character.Name != name {
		return nil, errors.New("character not found")
	}
	return cloneBankRecoveryCharacter(store.character), nil
}

func (store *bankCharacterRecoveryRepository) CommitCharacterSave(username string, character *database.Character, saveID string) error {
	if store.character.LastSaveID == saveID {
		return nil
	}
	if store.failBeforeCommit {
		return errors.New("database unavailable before commit")
	}
	store.character = cloneBankRecoveryCharacter(character)
	store.character.LastSaveID = saveID
	store.writes++
	if store.failAfterCommit {
		return errors.New("database acknowledgement lost")
	}
	return nil
}

func bankCharacterRecoveryFixture(t *testing.T) (string, *bankCharacterRecoveryRepository, database.GuildBankOperation) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	store := &bankCharacterRecoveryRepository{character: &database.Character{
		Name: "bank-owner", Class: "Wizard", Level: 75, XP: 1234, Gold: 1000,
		EP: 17, Resources: &database.CharacterResources{Version: 1, Health: 17, Mana: 9},
		WellRested:           &database.CharacterWellRested{Version: 1, RemainingSeconds: 600},
		Equipment:            map[string]database.Item{"chest": {ID: "legacy-chest", Stats: map[string]int{"vitality": 625}}},
		Inventory:            []database.Item{{ID: "legacy-blade", Stack: 1, Stats: map[string]int{"damage": 250}}},
		Quests:               []database.Quest{{ID: "story-fixture", Count: 7, RewardXPQuoted: true, RewardGoldQuoted: true}},
		ItemDeliveryReceipts: map[string]string{"earlier-item": "earlier-fingerprint"},
	}}
	characterSaveCommitter = store
	op := database.GuildBankOperation{Version: 1, Username: "bank-owner", CharacterName: "bank-owner", PlayerID: "player-bank-owner",
		GuildID: "guild-fixture", RequestID: "request_1234567890", Action: database.GuildBankDepositGold,
		Gold: 250, State: database.GuildBankPending, CreatedAt: time.Now().UTC()}
	op.ID = database.GuildBankOperationID(op.Username, op.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	return dir, store, op
}

func TestGuildBankCharacterRecoveryReopensJournalBeforeApplyingSavedIntentAgain(t *testing.T) {
	for _, failure := range []string{"before-commit", "after-commit"} {
		t.Run(failure, func(t *testing.T) {
			dir, store, op := bankCharacterRecoveryFixture(t)
			before := cloneBankRecoveryCharacter(store.character)
			store.failBeforeCommit, store.failAfterCommit = failure == "before-commit", failure == "after-commit"
			if err := applyAndSaveGuildBankCharacterLocked(op, store); err == nil {
				t.Fatal("unknown save result was incorrectly acknowledged")
			}
			pending, err := characterSaveJournal.Read(op.Username)
			if err != nil || pending == nil {
				t.Fatal("failed database save lost the durable complete snapshot", err)
			}
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			failedCharacterSaves.users = make(map[string]bool) // Simulated process-memory loss.
			store.failBeforeCommit, store.failAfterCommit = false, false
			if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil {
				t.Fatal(err)
			}
			if store.character.Gold != 750 || store.character.GuildBankRevision != 1 || !guildBankCharacterReceiptMatches(store.character, op) || store.writes != 1 {
				t.Fatal("journal replay and transfer execution debited more than once")
			}
			unchanged := cloneBankRecoveryCharacter(store.character)
			unchanged.Gold = before.Gold
			unchanged.GuildBankRevision, unchanged.GuildBankOpID, unchanged.GuildBankOpFingerprint, unchanged.LastSaveID = 0, "", "", ""
			if !reflect.DeepEqual(before, unchanged) {
				t.Fatal("offline recovery changed unrelated saved gameplay state")
			}
			if users, err := characterSaveJournal.PendingUsers(); err != nil || len(users) != 0 {
				t.Fatal("confirmed durable save remains pending", err)
			}
			if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil || store.writes != 1 {
				t.Fatal("a saved receipt triggered another full-character write", err)
			}
		})
	}
}

func TestGuildBankCharacterRecoveryPersistsVolatileReceiptBeforeAcknowledging(t *testing.T) {
	_, store, op := bankCharacterRecoveryFixture(t)
	world = game.NewWorld(nil)
	player := &game.Entity{ID: op.PlayerID, Type: game.TypePlayer, SubType: "Wizard", Gold: 1000,
		GuildBankRevision: 1, GuildBankOpID: op.ID, GuildBankOpFingerprint: op.Fingerprint}
	// Simulate a stop between live mutation and the first journal write.
	player.Gold = 750
	world.AddEntity(player)
	if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil {
		t.Fatal(err)
	}
	if store.writes != 1 || store.character.Gold != 750 || !guildBankCharacterReceiptMatches(store.character, op) {
		t.Fatal("a volatile receipt was acknowledged without durable storage")
	}
	// The next retry must not overwrite subsequent gameplay progress merely to
	// re-acknowledge an already confirmed financial receipt.
	player.Mu.Lock()
	player.Gold = 900
	player.Mu.Unlock()
	if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil || store.writes != 1 || world.GetEntityCopy(op.PlayerID).Gold != 900 {
		t.Fatal("saved replay overwrote newer live wallet state", err)
	}
}

func TestGuildBankCharacterRecoveryItemDeliveryPreservesLegacyStatsAndStory(t *testing.T) {
	_, store, op := bankCharacterRecoveryFixture(t)
	item := database.Item{ID: "new-blade", Name: "Rare Guild Blade", Stack: 1, MaxStack: 1, Rarity: "Rare",
		Potency: 4, Stats: map[string]int{"damage": 38}, StatScaleVersion: 1,
		Gems: []database.SocketedGem{{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 4}}}}
	payload, _ := json.Marshal(item)
	op.Action, op.Gold, op.ItemPayload = database.GuildBankWithdrawItem, 0, string(payload)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	before := cloneBankRecoveryCharacter(store.character)
	if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil {
		t.Fatal(err)
	}
	saved := store.character
	if !reflect.DeepEqual(saved.Inventory[0], before.Inventory[0]) || !reflect.DeepEqual(saved.Inventory[1], item) ||
		!reflect.DeepEqual(saved.Resources, before.Resources) || !reflect.DeepEqual(saved.WellRested, before.WellRested) ||
		!reflect.DeepEqual(saved.Quests, before.Quests) || !reflect.DeepEqual(saved.Equipment, before.Equipment) || saved.EP != before.EP {
		t.Fatal("guild withdrawal lost the exact item or changed unrelated legacy/story/resource data")
	}
	if err := applyAndSaveGuildBankCharacterLocked(op, store); err != nil || store.writes != 1 {
		t.Fatal("item recovery duplicated delivery or a full save", err)
	}
}
