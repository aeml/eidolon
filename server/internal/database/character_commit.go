package database

import (
	"context"
	"encoding/hex"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

// CommitCharacterSave atomically stores the full character and an idempotency
// receipt. Retrying a committed journal entry must not replace newer gold-only
// credits if the process died before removing its local journal file. Callers
// serialize saves/replay per account and always replay that account's newest
// durable journal entry, never a captured old entry after a newer save.
func (db *DB) CommitCharacterSave(username string, character *Character, saveID string) error {
	if username == "" || character == nil || character.Name == "" || len(saveID) != 32 {
		return errors.New("invalid journaled character commit")
	}
	if _, err := hex.DecodeString(saveID); err != nil {
		return errors.New("invalid character save identity")
	}
	if db == nil || db.users == nil {
		return errors.New("character commit storage unavailable")
	}
	// The local journal is acknowledged only after this durable save. Never
	// inherit an unsafe/unacknowledged URI concern, and prove replay receipts
	// from the primary's majority-committed state, not a stale secondary.
	users, err := db.users.Clone(options.Collection().
		SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()).
		SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
	if err != nil {
		return err
	}
	saved := *character
	saved.LastSaveID = saveID
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := users.UpdateOne(ctx,
		bson.M{"username": username, "characters": bson.M{"$elemMatch": bson.M{"name": character.Name, "last_save_id": bson.M{"$ne": saveID}}}},
		bson.M{"$set": bson.M{"characters.$": &saved}})
	if err != nil {
		return err
	}
	if result.MatchedCount == 1 {
		return nil
	}
	existing, err := newMongoCharacterRepository(users).LoadCharacter(username, character.Name)
	if err != nil {
		return err
	}
	if existing.LastSaveID == saveID {
		return nil
	}
	return errors.New("character not found for journaled commit")
}
