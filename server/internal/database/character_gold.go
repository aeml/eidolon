package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// Offline refunds must not read/replace an entire character, which can race a
// login or resource save. Only the gold field belongs to this operation.
func (db *DB) CreditCharacterGold(username, characterName string, amount int) error {
	if username == "" || characterName == "" || amount <= 0 {
		return errors.New("invalid gold credit")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.users.UpdateOne(ctx,
		bson.M{"username": username, "characters.name": characterName},
		bson.M{"$inc": bson.M{"characters.$.gold": amount}})
	if err != nil {
		return err
	}
	if result.MatchedCount != 1 {
		return errors.New("character not found for gold credit")
	}
	return nil
}
