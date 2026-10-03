package main

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestQuestConversationActualRejectedSaveCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	fixture, password := resourceJournalFixture(t, repo)
	fixture.X, fixture.Z = 20, 215
	questID := "chronicle_02_seeds_first_grove"
	fixture.Quests = []database.Quest{
		{ID: "chronicle_01_bell_below", Category: game.QuestCategoryChronicle, Type: "KILL", Target: "Skeleton", Count: 3, MaxCount: 3, Accepted: true, Completed: true},
		{ID: questID, Category: game.QuestCategoryChronicle, Type: "COLLECT", Target: "Verdant Memory Seed", Count: 8, MaxCount: 8,
			Accepted: true, CollectionVersion: 2, RewardXP: 1234, RewardGold: 321},
	}
	fixture.Inventory = []database.Item{
		{ID: "quest-seeds-" + fixture.Name, Name: "Verdant Memory Seed", Type: "CONSUMABLE", Stack: 10, MaxStack: 10},
		{ID: "earned-blade-" + fixture.Name, Name: "Earned blade", Type: "WEAPON", Stack: 1, MaxStack: 1,
			Rarity: "RARE", Level: 30, Potency: 4, StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{"damage": 23}},
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
	address, crash := compatStartServerWithCrash(t, binary, uri, 736, true, "-save-journal-dir", dir)
	connection := resourceOpenCharacter(t, address, fixture.Name, password)
	// Reject only this fixture's rewarded post-image, not its older saved
	// character or other accounts. No live database or test game command.
	setValidator(bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": fixture.Name}}, bson.M{"characters.gold": fixture.Gold}}})
	request := CompleteQuestPayload{QuestID: questID}
	resourceSend(t, connection, MsgCompleteQuest, request)
	_ = connection.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		kind, data, err := connection.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if json.Unmarshal(data, &message) != nil {
			t.Fatal("invalid ordinary quest response")
		}
		if message.Type == MsgInventory || message.Type == MsgQuestUpdate || message.Type == "chronicle_advance" {
			t.Fatal("unconfirmed quest save announced completion", message.Type)
		}
		if message.Type == MsgError {
			break
		}
	}
	before, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil || before == nil || before.Gold != fixture.Gold || before.Inventory[0].Stack != 10 || before.Quests[1].Completed {
		t.Fatal("rejected reward changed actual database custody", err)
	}
	pending, err := journal.Read(fixture.Name)
	if err != nil || pending == nil {
		t.Fatal("failed ordinary turn-in lost its real recovery journal", err)
	}
	planned, err := pending.Character()
	if err != nil || planned == nil || planned.Gold != fixture.Gold+321 || planned.XP != fixture.XP+1234 || planned.Inventory[0].Stack != 2 || !planned.Quests[1].Completed || planned.Quests[1].GrantedGold != 321 || planned.Quests[1].GrantedXP != 1234 {
		t.Fatal("journal lost exact item consumption or quoted reward", err)
	}
	crash()
	_ = connection.Close()
	setValidator(bson.M{})
	address, stop := compatStartServer(t, binary, uri, 737, "-save-journal-dir", dir)
	saved, err := repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil || saved.LastSaveID != pending.SaveID || saved.Gold != planned.Gold || saved.XP != planned.XP || saved.EP != planned.EP || !reflect.DeepEqual(saved.Inventory, planned.Inventory) || !reflect.DeepEqual(saved.Equipment, planned.Equipment) || !reflect.DeepEqual(saved.Quests, planned.Quests) {
		t.Fatal("fresh process failed to restore the exact complete quest reward", err)
	}
	connection = resourceOpenCharacter(t, address, fixture.Name, password)
	resourceSend(t, connection, MsgCompleteQuest, request)
	resourceReadMessage(t, connection, MsgError, nil)
	_ = connection.Close()
	stop()
	saved, err = repo.GetDirectTradeCharacter(fixture.Name, fixture.Name)
	if err != nil || saved == nil || saved.Gold != planned.Gold || saved.XP != planned.XP || saved.EP != planned.EP || !reflect.DeepEqual(saved.Inventory, planned.Inventory) || saved.Quests[1].GrantedGold != 321 || saved.Quests[1].GrantedXP != 1234 {
		t.Fatal("ordinary replay/disconnect repeated or lost earned quest rewards", err)
	}
}
