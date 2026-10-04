package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// The public boundary applies the stronger new-password policy and bounds
// hash/query concurrency. Legacy current passwords are compared without any
// normalization or migration. Only the observed hash may be replaced, so a
// concurrent password writer cannot be silently overwritten.
func (db *DB) ChangePassword(username, current, next string) (bool, error) {
	if len(current) == 0 || len(current) > 72 || len(next) == 0 || len(next) > 72 || current == next {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var observed struct {
		Hash string `bson:"password_hash"`
	}
	err := db.users.FindOne(ctx, bson.M{"username": username},
		options.FindOne().SetProjection(bson.M{"password_hash": 1})).Decode(&observed)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if bcrypt.CompareHashAndPassword([]byte(observed.Hash), []byte(current)) != nil {
		return false, nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return false, err
	}
	result, err := db.users.UpdateOne(ctx,
		bson.M{"username": username, "password_hash": observed.Hash},
		bson.M{"$set": bson.M{"password_hash": string(hash)},
			"$unset": bson.M{"password_recovery": "", "recovery_email_pending": ""}})
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}
