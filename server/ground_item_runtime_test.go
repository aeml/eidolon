package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func groundRuntimeClient(player *game.Entity) *Client {
	client := newLevelCommandClient()
	client.username, client.playerID = player.Name, player.ID
	return client
}

type groundAckCommitter struct {
	store  *groundRecoveryStore
	client *Client
}

func (committer *groundAckCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if len(committer.client.send) != 0 {
		return errors.New("ordinary item reply preceded complete save")
	}
	return committer.store.CommitCharacterSave(username, character, id)
}

func TestGroundItemOrdinaryHandlersSaveBeforeBagReplyAndRejectReplay(t *testing.T) {
	store, _, _, source, recipient := groundCoordinatorFixture(t)
	sender, receiver := groundRuntimeClient(source), groundRuntimeClient(recipient)
	check := &groundAckCommitter{store: store, client: sender}
	characterSaveCommitter = check
	quantity := 1
	dropPayload, _ := json.Marshal(InventoryDropPayload{Index: 0, ItemID: "earned-blade", ExpectedStack: &quantity})
	dropRequest := Message{Type: MsgInventoryDrop, Payload: dropPayload}
	sender.handleMessage(dropRequest)
	replies := drainSentMessages(sender.send)
	if len(replies) != 1 || replies[0].Type != MsgInventory || len(store.characters[source.Name].Inventory) != 0 {
		t.Fatal("drop did not acknowledge its confirmed debit", replies)
	}
	var drop database.GroundItemRecord
	for _, record := range store.groundRecords {
		drop = record
	}
	if drop.State != database.GroundItemComplete || world.GetEntityCopy(drop.LootID) == nil || !database.GroundItemCharacterReceiptMatches(store.characters[source.Name], drop.GroundItemOperation) {
		t.Fatal("drop was public without durable source receipt")
	}
	check.client = receiver
	pickupPayload, _ := json.Marshal(PickupPayload{LootID: drop.LootID})
	pickupRequest := Message{Type: MsgPickup, Payload: pickupPayload}
	receiver.handleMessage(pickupRequest)
	replies = drainSentMessages(receiver.send)
	if len(replies) != 1 || replies[0].Type != MsgInventory || len(store.characters[recipient.Name].Inventory) != 1 || world.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("pickup did not acknowledge saved recipient custody", replies)
	}
	before := store.writes[source.Name] + store.writes[recipient.Name]
	for _, action := range []struct {
		client  *Client
		message Message
	}{{sender, dropRequest}, {receiver, pickupRequest}} {
		action.client.handleMessage(action.message)
		replies = drainSentMessages(action.client.send)
		if len(replies) != 1 || replies[0].Type != MsgError {
			t.Fatal("replayed ordinary item command was accepted", replies)
		}
	}
	if store.writes[source.Name]+store.writes[recipient.Name] != before || recipient.Quests[0].Count != 1 {
		t.Fatal("replayed command resaved another effect or duplicated collection credit")
	}
}

func TestGroundItemOrdinaryFailedSaveDoesNotPublishOrAcknowledge(t *testing.T) {
	store, _, _, source, _ := groundCoordinatorFixture(t)
	client := groundRuntimeClient(source)
	store.failSaveAccount = source.Name
	quantity := 1
	payload, _ := json.Marshal(InventoryDropPayload{Index: 0, ItemID: "earned-blade", ExpectedStack: &quantity})
	client.handleMessage(Message{Type: MsgInventoryDrop, Payload: payload})
	replies := drainSentMessages(client.send)
	if len(replies) != 1 || replies[0].Type != MsgError {
		t.Fatal("failed save published an ordinary bag acknowledgement", replies)
	}
	entry, found := pendingGroundItemForAccount(source.Name)
	if !found || world.GetEntityCopy(entry.op.LootID) != nil {
		t.Fatal("failed drop lost its pending intent or published loot")
	}
	pending, err := characterSaveJournal.Read(source.Name)
	if err != nil || pending == nil {
		t.Fatal("failed ordinary drop lacks complete local recovery image", err)
	}
	if err := recoverPendingGroundItems(); err != nil || world.GetEntityCopy(entry.op.LootID) == nil {
		t.Fatal("background recovery did not publish only after save confirmation", err)
	}
}

func TestGroundItemFullBagAdmissionAvoidsPerPacketStorageAndRetriesAfterBagChange(t *testing.T) {
	store, drop, _, _, recipient := groundCoordinatorFixture(t)
	if _, err := runGroundCoordinator(drop); err != nil {
		t.Fatal(err)
	}
	pickup, err := world.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	for index := range recipient.Inventory {
		recipient.Inventory[index] = game.Item{ID: fmt.Sprintf("full-%d", index), Stack: 1}
	}
	if _, err := runGroundCoordinator(pickup); !errors.Is(err, game.ErrGroundItemFull) {
		t.Fatal(err)
	}
	client := groundRuntimeClient(recipient)
	reads := store.groundReads
	payload, _ := json.Marshal(AttackPayload{TargetID: "no-such-target"})
	for range 20 {
		client.handleMessage(Message{Type: MsgAttack, Payload: payload})
	}
	if store.groundReads != reads || world.GetEntityCopy(drop.LootID).GroundItemReservation != pickup.ID {
		t.Fatal("ordinary combat packets polled storage or freed accepted custody")
	}
	recipient.Inventory[0] = game.Item{}
	retryGroundItemAfterBagChangeLocked(client, MsgEquip)
	if _, found := pendingGroundItemForAccount(recipient.Name); found || recipient.Inventory[0].ID != "earned-blade" || recipient.Quests[0].Count != 1 {
		t.Fatal("bag change did not finish the retained pickup once")
	}
}

func TestGroundItemFreedBagFailedSaveDoesNotKeepFullBagAdmissionExemption(t *testing.T) {
	store, drop, _, _, recipient := groundCoordinatorFixture(t)
	if _, err := runGroundCoordinator(drop); err != nil {
		t.Fatal(err)
	}
	pickup, err := world.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil {
		t.Fatal(err)
	}
	for index := range recipient.Inventory {
		recipient.Inventory[index] = game.Item{ID: fmt.Sprintf("full-%d", index), Stack: 1}
	}
	if _, err := runGroundCoordinator(pickup); !errors.Is(err, game.ErrGroundItemFull) {
		t.Fatal(err)
	}
	recipient.Inventory[0] = game.Item{}
	store.failSaveAccount = recipient.Name
	client := groundRuntimeClient(recipient)
	retryGroundItemAfterBagChangeLocked(client, MsgEquip)
	entry, found := pendingGroundItemForAccount(recipient.Name)
	if !found || entry.full {
		t.Fatal("failed save retained the obsolete full-bag admission exemption")
	}
	if replies := drainSentMessages(client.send); len(replies) != 1 || replies[0].Type != MsgError {
		t.Fatal("failed reserved pickup save sent a success reply", replies)
	}
	if err := recoverAccountGroundItemLocked(recipient.Name); err != nil {
		t.Fatal(err)
	}
	if _, found := pendingGroundItemForAccount(recipient.Name); found || recipient.Quests[0].Count != 1 || world.GetEntityCopy(drop.LootID) != nil {
		t.Fatal("ordinary admission failed to reconcile the saved pickup exactly once")
	}
}

func TestGroundItemStartupDrainsAllPagesAndAllowsFullBagColdAdmission(t *testing.T) {
	store, template, _, _, _ := groundCoordinatorFixture(t)
	world = nil
	var firstID string
	for index := range 61 {
		op := template
		op.ID = database.GroundItemOperationID(fmt.Sprintf("startup-%d", index))
		op.Username = fmt.Sprintf("startup-owner-%d", index)
		op.PlayerID, op.LootID = "player-"+op.Username, fmt.Sprintf("startup-loot-%d", index)
		op.Fingerprint, _ = database.GroundItemFingerprint(op)
		store.groundRecords[op.ID] = database.GroundItemRecord{GroundItemOperation: op, State: database.GroundItemPending}
		store.characters[op.Username] = &database.Character{Name: op.Username, Gold: 777,
			Inventory: []database.Item{{ID: "earned-blade", Name: "Earned blade", Stack: 1, Potency: 5, Stats: map[string]int{"damage": 23}}}}
		if firstID == "" || op.ID < firstID {
			firstID = op.ID
		}
	}
	full := store.groundRecords[firstID]
	full.Kind, full.Generation = database.GroundItemPickup, 1
	full.LootTime = time.Now().UTC().Truncate(time.Millisecond).Add(-time.Second)
	full.LootCreatedAt, full.AvailableAt, full.ExpiresAt = full.LootTime, full.LootTime, full.LootTime.Add(time.Minute)
	full.Fingerprint, _ = database.GroundItemFingerprint(full.GroundItemOperation)
	store.groundRecords[firstID] = full
	store.characters[full.Username].Inventory = nil
	for index := range game.MaxInventorySize {
		store.characters[full.Username].Inventory = append(store.characters[full.Username].Inventory, database.Item{ID: fmt.Sprintf("full-%d", index), Stack: 1})
	}
	if err := recoverGroundItemsOnStartup(); err != nil {
		t.Fatal("full earliest row prevented startup progress", err)
	}
	completed := 0
	for _, record := range store.groundRecords {
		if record.State == database.GroundItemComplete {
			completed++
		}
	}
	if completed != 60 || store.groundRecords[firstID].State != database.GroundItemPending {
		t.Fatal("startup skipped later pages or discarded the full bag claim", completed)
	}
	unlock := lockCharacterWork(full.Username)
	err := recoverColdAccountGroundItemLocked(full.Username)
	unlock()
	if err != nil {
		t.Fatal("full bag prevented authenticated admission to free space", err)
	}
}
