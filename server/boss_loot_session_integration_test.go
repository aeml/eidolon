package main

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Ordinary sockets and real isolated Mongo. The already-earned retained rolls
// are fixture input: this proves delivery/recovery, not initial boss entitlement
// or a full dungeon/boss balance test. No test command is added to the server.
func TestBossLootActualBagSpaceRejectedSaveCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.EP = 43
	fixture.Inventory = make([]database.Item, game.MaxInventorySize)
	for index := range fixture.Inventory {
		fixture.Inventory[index] = database.Item{ID: fmt.Sprintf("boss-owned-%d", index), Name: "Owned material", Type: "MATERIAL", Stack: 1, MaxStack: 1}
	}
	rolls := []game.Item{
		{ID: "boss-original-blade", Name: "Original rare blade", Type: game.ItemWeapon, Rarity: game.RarityRare,
			Level: 30, Potency: 7, Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion,
			Stats: map[string]int{"damage": 73, "strength": 11}, UniqueEffect: "echoing_strike"},
		{ID: "boss-original-gem", Name: "Original ruby", Type: game.ItemGem, Rarity: game.RarityRare,
			Level: 30, Stack: 1, MaxStack: 1, StatScaleVersion: game.ItemStatScaleVersion,
			GemType: game.GemRuby, GemQuality: game.GemChipped, Stats: map[string]int{"strength": 13}},
	}
	for _, roll := range rolls {
		payload, err := json.Marshal(roll)
		if err != nil {
			t.Fatal(err)
		}
		fixture.PendingBossLoot = append(fixture.PendingBossLoot, string(payload))
	}
	if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := mongo.Connect(t.Context(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Disconnect(context.Background()) })
	setValidator := func(value bson.M) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := admin.Database("eidolon").RunCommand(ctx, bson.D{
			{Key: "collMod", Value: "users"}, {Key: "validator", Value: value},
			{Key: "validationLevel", Value: "strict"}, {Key: "validationAction", Value: "error"},
		}).Err(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { setValidator(bson.M{}) })
	assertOwnedRolls := func(character *database.Character, count int) {
		t.Helper()
		if character == nil || character.Gold != fixture.Gold || character.EP != fixture.EP || !reflect.DeepEqual(character.Equipment, fixture.Equipment) || len(character.PendingBossLoot) != len(rolls)-count {
			t.Fatal("delivery changed currencies/class gear or lost retained queue")
		}
		for index, roll := range rolls {
			owned := 0
			for _, item := range character.Inventory {
				if item.ID == roll.ID {
					owned++
					if !reflect.DeepEqual(gameItemFromDatabaseExact(item), roll) {
						t.Fatal("delivery rerolled original metadata", item)
					}
				}
			}
			if index < count && owned != 1 || index >= count && owned != 0 {
				t.Fatal("original roll duplicated, lost or credited before save", roll.ID, owned)
			}
		}
	}
	address, crash := compatStartServerWithCrash(t, binary, uri, 741, true, "-save-journal-dir", dir)
	connection := groundSocketFirstScene(t, address, fixture.Name, password, "boss-proof-no-ground-loot", false)
	stored, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(stored, 0) // Full-bag login preserves the complete queue.
	quantity := 1
	resourceSend(t, connection, MsgInventoryDrop, InventoryDropPayload{Index: 0, ItemID: fixture.Inventory[0].ID, ExpectedStack: &quantity})
	var dropBag, collectedBag []game.Item
	resourceReadMessage(t, connection, MsgInventory, &dropBag)
	resourceReadMessage(t, connection, MsgInventory, &collectedBag)
	if len(dropBag) != game.MaxInventorySize || dropBag[0].ID != "" || len(collectedBag) != game.MaxInventorySize || !reflect.DeepEqual(collectedBag[0], rolls[0]) {
		t.Fatal("ordinary drop did not expose saved debit followed by saved boss collection")
	}
	stored, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(stored, 1)
	if stored.PendingBossLoot[0] != fixture.PendingBossLoot[1] {
		t.Fatal("first bag-space claim reconstructed the later original roll")
	}
	// Permit the ordinary second drop's debit, but reject any image that puts
	// the second retained roll into this account's bag. Other users unaffected.
	setValidator(bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": fixture.Name}}, bson.M{"characters.inventory.id": bson.M{"$ne": rolls[1].ID}}}})
	request := InventoryDropPayload{Index: 1, ItemID: fixture.Inventory[1].ID, ExpectedStack: &quantity}
	resourceSend(t, connection, MsgInventoryDrop, request)
	resourceReadMessage(t, connection, MsgInventory, &dropBag)
	if len(dropBag) != game.MaxInventorySize || dropBag[1].ID != "" {
		t.Fatal("failed collection contaminated the earlier confirmed drop reply")
	}
	resourceReadMessage(t, connection, MsgError, nil)
	stored, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(stored, 1)
	local, err := journal.Read(fixture.Name)
	if err != nil || local == nil {
		t.Fatal("rejected ordinary collection lost its real filesystem journal", err)
	}
	image, err := local.Character()
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(image, 2) // Bag credit + queue removal are the SAME image.
	crash()                    // Intentional SIGKILL of this exact child, without graceful saves.
	_ = connection.Close()
	setValidator(bson.M{})
	address, stop := compatStartServer(t, binary, uri, 742, "-save-journal-dir", dir)
	stored, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(stored, 2) // Startup journal recovery before admission.
	connection = groundSocketFirstScene(t, address, fixture.Name, password, "boss-proof-no-ground-loot", false)
	resourceSend(t, connection, MsgInventoryDrop, request)
	resourceReadMessage(t, connection, MsgError, nil) // Old item identity is gone.
	_ = connection.Close()
	stop()
	address, stop = compatStartServer(t, binary, uri, 743, "-save-journal-dir", dir)
	connection = groundSocketFirstScene(t, address, fixture.Name, password, "boss-proof-no-ground-loot", false)
	stored, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil {
		t.Fatal(err)
	}
	assertOwnedRolls(stored, 2)
	if pending, err := journal.Read(fixture.Name); err != nil || pending != nil {
		t.Fatal("confirmed restart left an unacknowledged collection image", err)
	}
	_ = connection.Close()
	stop()
}
