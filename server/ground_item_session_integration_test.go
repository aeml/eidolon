package main

import (
	"bytes"
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/protobuf/proto"
)

// Ordinary authentication/join, then inspect the actual first protobuf scene.
// No game-side test command, fabricated transfer intent or live account writes.
func groundSocketFirstScene(t *testing.T, address, username, password, lootID string, wantLoot bool) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	resourceSend(t, conn, MsgLogin, map[string]string{"username": username, "password": password})
	resourceReadMessage(t, conn, "login_success", nil)
	resourceSend(t, conn, MsgJoin, JoinPayload{Type: "Wizard"})
	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	joined, full := false, false
	for !joined || !full {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal("first scene unavailable", err)
		}
		if kind == websocket.TextMessage {
			var message Message
			if json.Unmarshal(data, &message) != nil {
				t.Fatal("invalid ordinary message")
			}
			if message.Type == MsgError {
				t.Fatal("ordinary ground session rejected", string(message.Payload))
			}
			joined = joined || message.Type == MsgQuestUpdate
			continue
		}
		if kind != websocket.BinaryMessage || len(data) < 5 {
			continue
		}
		if !bytes.Equal(data[:4], stateProtoMagic) || data[4] != stateProtoWireVersion {
			t.Fatal("invalid ordinary scene frame")
		}
		var envelope statepb.StateEnvelope
		if err := proto.Unmarshal(data[5:], &envelope); err != nil {
			t.Fatal(err)
		}
		if scene := envelope.GetFull(); scene != nil {
			self, found := false, false
			for _, entity := range scene.Entities {
				self = self || entity.GetId() == "player-"+username
				found = found || entity.GetId() == lootID
			}
			if !self || found != wantLoot {
				t.Fatal("first actual scene lost/restored incorrect loot custody", self, found, wantLoot)
			}
			full = true
		}
	}
	return conn
}

func TestGroundItemActualSocketsRejectedSaveCrashAndRecovery(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	source, sourcePassword := resourceJournalFixture(t, repo)
	recipient, recipientPassword := resourceJournalFixture(t, repo)
	itemID := "ground-item-" + source.Name
	source.Inventory = []database.Item{{ID: itemID, Name: "Earned ground blade", Type: "WEAPON", Level: 30, Stack: 1, MaxStack: 1,
		Rarity: string(game.RarityRare), Potency: 4, StatScaleVersion: game.ItemStatScaleVersion,
		Stats: map[string]int{"damage": 23}, Gems: []database.SocketedGem{{Stats: map[string]int{"wisdom": 7}}}}}
	recipient.Inventory = nil
	for _, character := range []*database.Character{source, recipient} {
		if err := repo.SaveCharacter(character.Name, character); err != nil {
			t.Fatal(err)
		}
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
	address, crash := compatStartServerWithCrash(t, binary, uri, 733, true, "-save-journal-dir", dir)
	sender := resourceOpenCharacter(t, address, source.Name, sourcePassword)
	// This isolated validator permits the saved source before-image but rejects
	// the ordinary drop's complete debit. Other fixture accounts are unaffected.
	setValidator(bson.M{"$or": bson.A{bson.M{"username": bson.M{"$ne": source.Name}}, bson.M{"characters.inventory.id": itemID}}})
	quantity := 1
	dropRequest := InventoryDropPayload{Index: 0, ItemID: itemID, ExpectedStack: &quantity}
	resourceSend(t, sender, MsgInventoryDrop, dropRequest)
	resourceReadMessage(t, sender, MsgError, nil)
	pending, err := repo.PendingGroundItemOperations(source.Name, "", 2)
	if err != nil || len(pending) != 1 || pending[0].Kind != database.GroundItemDrop {
		t.Fatal("ordinary failed drop lost its real shared intent", pending, err)
	}
	drop := pending[0]
	before, err := repo.GetDirectTradeCharacter(source.Name, source.Name)
	if err != nil || before == nil || len(before.Inventory) != 1 || database.GroundItemCharacterReceiptMatches(before, drop.GroundItemOperation) {
		t.Fatal("rejected save changed actual stored source custody", err)
	}
	local, err := journal.Read(source.Name)
	if err != nil || local == nil {
		t.Fatal("rejected ordinary save lacks real journal recovery image", err)
	}
	image, err := local.Character()
	if err != nil || image == nil || len(image.Inventory) != 0 || !database.GroundItemCharacterReceiptMatches(image, drop.GroundItemOperation) {
		t.Fatal("journal did not retain complete debit and receipt", err)
	}
	observer := groundSocketFirstScene(t, address, recipient.Name, recipientPassword, drop.LootID, false)
	crash() // Intentional SIGKILL of this exact owned child, not graceful saving.
	_ = sender.Close()
	_ = observer.Close()
	setValidator(bson.M{})

	address, crash = compatStartServerWithCrash(t, binary, uri, 734, true, "-save-journal-dir", dir)
	receiver := groundSocketFirstScene(t, address, recipient.Name, recipientPassword, drop.LootID, true)
	completedDrop, err := repo.GetGroundItemOperation(drop.ID)
	if err != nil || completedDrop == nil || completedDrop.State != database.GroundItemComplete || completedDrop.Fingerprint != drop.Fingerprint {
		t.Fatal("fresh process did not complete the retained first drop", err)
	}
	resourceSend(t, receiver, MsgPickup, PickupPayload{LootID: drop.LootID})
	var inventory []game.Item
	resourceReadMessage(t, receiver, MsgInventory, &inventory)
	var received *game.Item
	for index := range inventory {
		if inventory[index].ID == itemID {
			received = &inventory[index]
		}
	}
	var moved game.Item
	if json.Unmarshal([]byte(drop.MovedPayload), &moved) != nil || received == nil || !reflect.DeepEqual(*received, moved) {
		t.Fatal("ordinary saved pickup changed frozen earned metadata", received)
	}
	pickup, err := repo.LatestGroundItemOperation(drop.LootID)
	if err != nil || pickup == nil || pickup.Kind != database.GroundItemPickup || pickup.State != database.GroundItemComplete || pickup.GroundPayload() != "" ||
		!pickup.AvailableAt.Equal(completedDrop.AvailableAt) || !pickup.ExpiresAt.Equal(completedDrop.ExpiresAt) {
		t.Fatal("actual pickup renewed expiry or retained duplicate ground quantity", pickup, err)
	}
	for _, character := range []*database.Character{source, recipient} {
		saved, err := repo.GetDirectTradeCharacter(character.Name, character.Name)
		if err != nil || saved == nil || saved.Gold != character.Gold || saved.EP != character.EP {
			t.Fatal("ground transfer changed unrelated currencies", err)
		}
		if character.Name == source.Name && len(saved.Inventory) != 0 || character.Name == recipient.Name && (len(saved.Inventory) != 1 || !database.GroundItemCharacterReceiptMatches(saved, pickup.GroundItemOperation)) {
			t.Fatal("ordinary inventory acknowledgement preceded actual saved custody")
		}
	}
	crash() // Restart while the original ground lifetime is still active.
	_ = receiver.Close()
	address, stop := compatStartServer(t, binary, uri, 735, "-save-journal-dir", dir)
	sender = groundSocketFirstScene(t, address, source.Name, sourcePassword, drop.LootID, false)
	receiver = groundSocketFirstScene(t, address, recipient.Name, recipientPassword, drop.LootID, false)
	resourceSend(t, sender, MsgInventoryDrop, dropRequest)
	resourceReadMessage(t, sender, MsgError, nil)
	resourceSend(t, receiver, MsgPickup, PickupPayload{LootID: drop.LootID})
	resourceReadMessage(t, receiver, MsgError, nil)
	latest, err := repo.LatestGroundItemOperation(drop.LootID)
	if err != nil || latest == nil || latest.ID != pickup.ID || latest.Fingerprint != pickup.Fingerprint || !latest.ExpiresAt.Equal(pickup.ExpiresAt) {
		t.Fatal("replayed native commands created a new transfer or lifetime", err)
	}
	_ = sender.Close()
	_ = receiver.Close()
	stop()
}
