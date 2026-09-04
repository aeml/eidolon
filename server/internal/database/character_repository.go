package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// CharacterRepository is the persistence boundary used by character
// hydration and saves. Keeping it narrow makes failure paths testable without
// coupling gameplay code to Mongo query details.
type CharacterRepository interface {
	LoadCharacter(username, characterName string) (*Character, error)
	SaveCharacter(username string, character *Character) error
}

type mongoCharacterRepository struct {
	users   *mongo.Collection
	timeout time.Duration
}

func newMongoCharacterRepository(users *mongo.Collection) *mongoCharacterRepository {
	return &mongoCharacterRepository{users: users, timeout: 5 * time.Second}
}

func (repository *mongoCharacterRepository) LoadCharacter(username, characterName string) (*Character, error) {
	ctx, cancel := context.WithTimeout(context.Background(), repository.timeout)
	defer cancel()

	var user User
	err := repository.users.FindOne(ctx, bson.M{
		"username":        username,
		"characters.name": characterName,
	}).Decode(&user)
	if err != nil {
		return nil, err
	}
	for _, character := range user.Characters {
		if character != nil && character.Name == characterName {
			return character, nil
		}
	}
	return nil, errors.New("character not found")
}

func (repository *mongoCharacterRepository) SaveCharacter(username string, character *Character) error {
	if character == nil || character.Name == "" {
		return errors.New("character name is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), repository.timeout)
	defer cancel()

	result, err := repository.users.UpdateOne(
		ctx,
		bson.M{"username": username, "characters.name": character.Name},
		bson.M{"$set": bson.M{"characters.$": character}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("character not found")
	}
	return nil
}
