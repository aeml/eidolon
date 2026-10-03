package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func bossLootDeliveryFixture(t *testing.T) (*tradeRecoveryStore, *game.Entity, string) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	oldStore, oldPending, oldAfter := bossLootCharacters, bossLootPending.accounts, bossLootRecovery.after
	t.Cleanup(func() {
		bossLootCharacters, bossLootPending.accounts, bossLootRecovery.after = oldStore, oldPending, oldAfter
	})
	bossLootPending.accounts, bossLootRecovery.after = map[string]bossLootFeedback{}, ""
	store := &tradeRecoveryStore{characters: map[string]*database.Character{}, writes: map[string]int{}}
	bossLootCharacters, characterSaveCommitter = store, store
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-boss-delivery", Name: "boss-delivery", Type: game.TypePlayer, SubType: "Rogue", Level: 100,
		Gold: 77, EP: 43, Health: 30, Mana: 20, Inventory: make([]game.Item, game.MaxInventorySize),
		Equipment: map[string]game.Item{}, Quests: []game.Quest{{ID: "earned", Count: 1, MaxCount: 1, Accepted: true}}}
	for index := range player.Inventory {
		player.Inventory[index] = game.Item{ID: fmt.Sprintf("occupied-%d", index), Name: "Owned", Stack: 1, MaxStack: 1}
	}
	_, err := player.AwardBossItemLocked(game.Item{ID: "original-blade", Name: "Original", Type: game.ItemWeapon,
		Stack: 1, MaxStack: 1, Level: 100, Potency: 7, Stats: map[string]int{"damage": 73}})
	if err != nil {
		t.Fatal(err)
	}
	world.AddEntity(player)
	store.characters[player.Name] = characterSnapshotForSave(player.Name, player)
	return store, player, dir
}

func TestBossLootDeliveryFullBagAndActiveTradeDoNotWriteOrConsume(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil || store.writes[player.Name] != 0 || len(player.PendingBossLoot) != 1 {
		t.Fatal("full bag consumed loot or repeatedly wrote an unchanged image", err)
	}
	player.Inventory[0] = game.Item{}
	world.TradeByPlayer[player.ID] = "consented-trade"
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil || store.writes[player.Name] != 0 || player.Inventory[0].ID != "" {
		t.Fatal("collection changed the offered bag", err)
	}
	delete(world.TradeByPlayer, player.ID)
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil || store.writes[player.Name] != 1 || store.characters[player.Name].Inventory[0].ID != "original-blade" {
		t.Fatal("ordinary bag-space retry did not save original loot", err)
	}
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil || store.writes[player.Name] != 1 {
		t.Fatal("empty collection replay saved or awarded again", err)
	}
}

func TestBossLootDeliveryRejectedAndLostSaveRepliesRecoverLatestImage(t *testing.T) {
	for _, after := range []bool{false, true} {
		t.Run(fmt.Sprint(after), func(t *testing.T) {
			store, player, dir := bossLootDeliveryFixture(t)
			player.Inventory[0] = game.Item{}
			store.failSaveAccount, store.failSaveAfter = player.Name, after
			if err := recoverLiveBossLootLocked(player.Name, true); err == nil || len(player.PendingBossLoot) != 0 || player.Inventory[0].ID != "original-blade" {
				t.Fatal("unconfirmed collection failed to retain complete live post-image", err)
			}
			if _, found := pendingBossLootFeedback(player.Name); !found {
				t.Fatal("empty queue lost the failed-save admission fence")
			}
			var err error
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			pending, err := characterSaveJournal.Read(player.Name)
			if err != nil || pending == nil {
				t.Fatal("collection has no reopened filesystem journal", err)
			}
			image, err := pending.Character()
			if err != nil || len(image.PendingBossLoot) != 0 || image.Inventory[0].ID != "original-blade" {
				t.Fatal("journal separated bag credit from queue removal", err)
			}
			player.Gold += 9 // A later independent credit must survive retry.
			if err := recoverAccountBossLootLocked(player.Name); err != nil {
				t.Fatal(err)
			}
			saved := store.characters[player.Name]
			if saved.Gold != 86 || saved.EP != 43 || saved.Quests[0].Count != 1 || len(saved.PendingBossLoot) != 0 || saved.Inventory[0].Potency != 7 || saved.Inventory[0].Stats["damage"] != 73 {
				t.Fatal("retry lost latest unrelated value or original rolled metadata")
			}
			writes := store.writes[player.Name]
			if err := recoverAccountBossLootLocked(player.Name); err != nil || store.writes[player.Name] != writes {
				t.Fatal("successful admission recovery repeated a collection save")
			}
		})
	}
}

func TestBossLootDeliveryColdRecoveryPreservesLogoutRunAgeAndExactEquipment(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	world = nil
	character := store.characters[player.Name]
	character.Inventory[0] = database.Item{}
	character.LastLogout = time.Now().Add(-16 * time.Minute)
	character.Equipment["mainHand"] = database.Item{ID: "legacy-equipped", Stats: map[string]int{"damage": 123}, Level: 1}
	character.DungeonProgress = &database.CharacterDungeonResume{InstanceID: "old-run"}
	before := cloneTradeRecoveryCharacter(character)
	if err := recoverColdAccountBossLootLocked(player.Name); err != nil {
		t.Fatal(err)
	}
	saved := cloneTradeRecoveryCharacter(store.characters[player.Name])
	if saved.Inventory[0].ID != "original-blade" || len(saved.PendingBossLoot) != 0 {
		t.Fatal("cold recovery did not atomically collect original roll")
	}
	saved.Inventory, saved.PendingBossLoot, saved.LastSaveID = before.Inventory, before.PendingBossLoot, before.LastSaveID
	if !reflect.DeepEqual(saved, before) {
		t.Fatal("offline delivery rewrote unrelated character data or run/logout age")
	}
	writes := store.writes[player.Name]
	if err := recoverColdAccountBossLootLocked(player.Name); err != nil || store.writes[player.Name] != writes {
		t.Fatal("cold replay repeated delivery", err)
	}
}

func TestBossLootDeliveryUnknownPayloadIsPreservedWithoutBlockingPlay(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	unknown := `{"id":"future","stack":1,"maxStack":1,"futureArt":{"keep":"exact"}}`
	player.PendingBossLoot = []string{unknown}
	player.Inventory[0] = game.Item{}
	store.characters[player.Name] = characterSnapshotForSave(player.Name, player)
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil || player.PendingBossLoot[0] != unknown || store.writes[player.Name] != 0 {
		t.Fatal("unsupported live item was erased or excluded its owner", err)
	}
	world = nil
	if err := recoverColdAccountBossLootLocked(player.Name); err != nil || store.characters[player.Name].PendingBossLoot[0] != unknown || store.writes[player.Name] != 0 {
		t.Fatal("unsupported saved item was erased or excluded its owner", err)
	}
}

func TestBossLootDeliverySummaryAndWeeklyFeedbackFollowConfirmedSave(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	feedback := 0
	world.OnEvent = func(kind string, value interface{}) {
		if kind != "reward_summary" && kind != "weekly_raid_complete" {
			t.Fatalf("unexpected event %s", kind)
		}
		if saved := store.characters[player.Name]; saved.Gold != player.Gold || len(saved.PendingBossLoot) != 1 {
			t.Fatal("feedback preceded whole owned image confirmation")
		}
		feedback++
	}
	player.Gold += 10
	store.failSaveAccount = player.Name
	summary := game.RewardSummaryEvent{PlayerID: player.ID, Gold: 10, HeartCount: 1, PendingItemCount: 1}
	weekly := &game.WeeklyRaidCompletionEvent{PlayerID: player.ID, InstanceID: "weekly-run", CompletedAt: time.Now()}
	if err := persistBossRewardFeedback(summary, weekly); err == nil || feedback != 0 {
		t.Fatal("rejected save published boss success", err)
	}
	if err := recoverAccountBossLootLocked(player.Name); err != nil || feedback != 2 {
		t.Fatal("confirmed retry lost original owner summary/weekly event", err)
	}
	if err := recoverAccountBossLootLocked(player.Name); err != nil || feedback != 2 {
		t.Fatal("feedback replay duplicated victory", err)
	}
}

type bossLootCheckingCommitter struct {
	store  *tradeRecoveryStore
	before func(*database.Character)
}

func (store bossLootCheckingCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	store.before(character)
	return store.store.CommitCharacterSave(username, character, id)
}

func TestBossLootDeliveryInventoryReplyUsesOnlyTheConfirmedCapturedImage(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	client := &Client{username: player.Name, playerID: player.ID, send: make(chan []byte, 8)}
	sessionsMu.Lock()
	oldSessions := activeSessions
	activeSessions = map[string]*Client{player.Name: client}
	sessionsMu.Unlock()
	t.Cleanup(func() {
		sessionsMu.Lock()
		activeSessions = oldSessions
		sessionsMu.Unlock()
	})
	player.Inventory[0] = game.Item{}
	characterSaveCommitter = bossLootCheckingCommitter{store, func(image *database.Character) {
		if len(client.send) != 0 || image.Inventory[0].ID != "original-blade" || len(image.PendingBossLoot) != 0 {
			t.Fatal("private inventory success preceded complete collection save")
		}
		// An autonomous later combat award while IO is in flight must not leak
		// into the earlier save's inventory acknowledgement.
		player.Mu.Lock()
		player.Inventory[1] = game.Item{ID: "later-unsaved-roll", Stack: 1, MaxStack: 1}
		player.Mu.Unlock()
	}}
	if err := recoverLiveBossLootLocked(player.Name, true); err != nil {
		t.Fatal(err)
	}
	messages := drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory {
		t.Fatal("missing saved private inventory acknowledgement", messages)
	}
	var inventory []game.Item
	if err := json.Unmarshal(messages[0].Payload, &inventory); err != nil {
		t.Fatal(err)
	}
	if inventory[0].ID != "original-blade" || inventory[1].ID == "later-unsaved-roll" || store.characters[player.Name].Inventory[1].ID == "later-unsaved-roll" || player.Inventory[1].ID != "later-unsaved-roll" {
		t.Fatal("save acknowledgement re-read a newer unsaved RAM inventory")
	}
}

func TestBossLootDeliveryUnavailablePersistenceDoesNotClaimAndIdleAdmissionDoesNoIO(t *testing.T) {
	store, player, _ := bossLootDeliveryFixture(t)
	player.Inventory[0] = game.Item{}
	characterSaveJournal = nil
	if err := recoverLiveBossLootLocked(player.Name, true); err == nil || len(player.PendingBossLoot) != 1 || player.Inventory[0].ID != "" {
		t.Fatal("unavailable journal permitted unprotected collection", err)
	}
	if err := recoverAccountBossLootLocked(player.Name); err != nil || store.reads != 0 || store.writes[player.Name] != 0 {
		t.Fatal("idle movement admission polled persistence or blocked a full bag", err)
	}
}

func TestBossLootDeliveryPeriodicRotationReachesLaterAccounts(t *testing.T) {
	store, first, _ := bossLootDeliveryFixture(t)
	world = game.NewWorld(nil)
	for index := range 23 {
		name := fmt.Sprintf("retry-%02d", index)
		player := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, PendingBossLoot: append([]string(nil), first.PendingBossLoot...), Inventory: make([]game.Item, game.MaxInventorySize)}
		if index < 10 {
			for slot := range player.Inventory {
				player.Inventory[slot] = game.Item{ID: fmt.Sprintf("full-%d", slot), Stack: 1, MaxStack: 1}
			}
		}
		world.AddEntity(player)
		store.characters[name] = characterSnapshotForSave(name, player)
	}
	for range 3 {
		if err := recoverPendingBossLoot(); err != nil {
			t.Fatal(err)
		}
	}
	for index := range 23 {
		name := fmt.Sprintf("retry-%02d", index)
		expected := 1
		if index < 10 {
			expected = 0
		}
		if store.writes[name] != expected {
			t.Fatalf("full-bag prefix starved %s or repeated a save: %d", name, store.writes[name])
		}
	}
}
