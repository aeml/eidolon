package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CharacterEntryAccount is private hydration input, not an owner export or
// network response. Keep first-character selection and nil-vs-empty legacy
// initialization unchanged without fetching credentials or unrelated saves.
type CharacterEntryAccount struct {
	ID         primitive.ObjectID `bson:"_id" json:"-"`
	PublicName string             `bson:"public_name" json:"-"`
	Characters []*Character       `bson:"characters" json:"-"`
}

func (db *DB) GetCharacterEntryAccount(username string) (*CharacterEntryAccount, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var account CharacterEntryAccount
	err := db.users.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(bson.M{
		"_id": 1, "public_name": 1, "characters": bson.M{"$slice": 1},
	})).Decode(&account)
	if err != nil {
		return nil, err
	}
	if len(account.Characters) > 1 || len(account.Characters) == 1 && account.Characters[0] == nil {
		return nil, errors.New("invalid first character account state")
	}
	for _, character := range account.Characters {
		character.AccountID = account.ID
	}
	return &account, nil
}
