package database

import (
	"context"
	"crypto/sha256"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func TestCharacterBoundCommitMongoRejectsReusedAccountAndCopiedReceipt(t *testing.T) {
	uri := os.Getenv("EIDOLON_OWNER_EXPORT_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable character-identity Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("explicit disposable loopback Mongo required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Disconnect(context.Background()) })
	users := client.Database("eidolon").Collection(uniqueID("character-identity-"))
	t.Cleanup(func() { _ = users.Drop(context.Background()) })
	db := &DB{users: users}
	oldID, newID, foreignID := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	insert := func(id primitive.ObjectID, username string, gold, ep int, receipt string) {
		t.Helper()
		_, err := users.InsertOne(ctx, bson.M{"_id": id, "username": username, "private_account_field": "must-remain",
			"characters": []*Character{{Name: "hero", Gold: gold, EP: ep, LastSaveID: receipt}}})
		if err != nil {
			t.Fatal(err)
		}
	}
	read := func(id primitive.ObjectID) bson.Raw {
		t.Helper()
		row, err := users.FindOne(ctx, bson.M{"_id": id}).DecodeBytes()
		if err != nil {
			t.Fatal(err)
		}
		return row
	}
	insert(oldID, "owner", 10, 7, "")
	insert(foreignID, "other", 999, 99, "")
	foreignBefore := sha256.Sum256(read(foreignID))
	journal, err := OpenCharacterSaveJournal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	save, err := journal.WriteForAccount(oldID, "owner", &Character{Name: "hero", Gold: 123, EP: 8})
	if err != nil {
		t.Fatal(err)
	}
	character, err := save.Character()
	if err != nil {
		t.Fatal(err)
	}
	if err := db.CommitBoundCharacterSave(save.AccountID, save.Username, character, save.SaveID); err != nil {
		t.Fatal(err)
	}
	// A confirmed retry must not roll back a later independent credit.
	if _, err := users.UpdateOne(ctx, bson.M{"_id": oldID}, bson.M{"$inc": bson.M{"characters.0.gold": 8}}); err != nil {
		t.Fatal(err)
	}
	before := sha256.Sum256(read(oldID))
	if err := db.CommitBoundCharacterSave(oldID, "owner", character, save.SaveID); err != nil || sha256.Sum256(read(oldID)) != before {
		t.Fatal("confirmed retry overwrote later credits", err)
	}
	// Fixture-only removal/re-registration; there is no production erasure API.
	if _, err := users.DeleteOne(ctx, bson.M{"_id": oldID}); err != nil {
		t.Fatal(err)
	}
	if err := db.CommitBoundCharacterSave(oldID, "owner", character, save.SaveID); err == nil {
		t.Fatal("absent account acknowledged")
	}
	if count, err := users.CountDocuments(ctx, bson.M{"username": "owner"}); err != nil || count != 0 {
		t.Fatal("old save resurrected absent account", err)
	}
	// Copying the old receipt into the replacement cannot defeat the proof fence.
	insert(newID, "owner", 900, 40, save.SaveID)
	before = sha256.Sum256(read(newID))
	if err := db.CommitBoundCharacterSave(oldID, "owner", character, save.SaveID); err == nil || sha256.Sum256(read(newID)) != before {
		t.Fatal("reused account/copy receipt admitted", err)
	}
	if pending, err := journal.Read("owner"); err != nil || pending == nil || pending.AccountID != oldID || pending.SaveID != save.SaveID {
		t.Fatal("rejected old journal discarded or rebound", err)
	}
	if err := db.CommitBoundCharacterSave(newID, "other", character, strings.Repeat("a", 32)); err == nil || sha256.Sum256(read(newID)) != before {
		t.Fatal("identity/name mismatch accepted", err)
	}
	if err := db.CommitBoundCharacterSave(newID, "owner", &Character{Name: "hero", Gold: 990, EP: 41}, strings.Repeat("b", 32)); err != nil {
		t.Fatal("legitimate new identity could not save", err)
	}
	var newUser User
	if err := bson.Unmarshal(read(newID), &newUser); err != nil || newUser.Characters[0].Gold != 990 || newUser.Characters[0].EP != 41 {
		t.Fatal("new owner state lost", err)
	}
	if sha256.Sum256(read(foreignID)) != foreignBefore {
		t.Fatal("foreign account changed")
	}
}
