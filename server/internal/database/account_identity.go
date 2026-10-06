package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"golang.org/x/crypto/bcrypt"
)

func (db *DB) identityAccounts() (*mongo.Collection, error) {
	if db == nil || db.users == nil {
		return nil, errors.New("account identity storage unavailable")
	}
	return db.users.Clone(options.Collection().SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()))
}

// AuthenticateAccount captures the actual credential-bearing account generation.
// Recheck both identity and hash after bcrypt; a reused username or changed
// password cannot finish an older verification and acquire the new account.
func (db *DB) AuthenticateAccount(username, password string) (primitive.ObjectID, bool, error) {
	accounts, err := db.identityAccounts()
	if err != nil {
		return primitive.NilObjectID, false, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var credential struct {
		ID   primitive.ObjectID `bson:"_id"`
		Hash string             `bson:"password_hash"`
	}
	err = accounts.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(bson.M{"_id": 1, "password_hash": 1})).Decode(&credential)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return primitive.NilObjectID, false, nil
	}
	if err != nil {
		return primitive.NilObjectID, false, err
	}
	if credential.ID.IsZero() || len(credential.Hash) > 1024 {
		return primitive.NilObjectID, false, nil
	}
	cost, err := bcrypt.Cost([]byte(credential.Hash))
	if err != nil || cost > 14 || bcrypt.CompareHashAndPassword([]byte(credential.Hash), []byte(password)) != nil {
		return primitive.NilObjectID, false, nil
	}
	var proof struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	err = accounts.FindOne(ctx, bson.M{"_id": credential.ID, "username": username, "password_hash": credential.Hash},
		options.FindOne().SetProjection(bson.M{"_id": 1})).Decode(&proof)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return primitive.NilObjectID, false, nil
	}
	if err != nil {
		return primitive.NilObjectID, false, err
	}
	if proof.ID != credential.ID {
		return primitive.NilObjectID, false, nil
	}
	return credential.ID, true, nil
}

// Read-only reconnect/admission check, never a whole account hydration or a
// per-frame lookup. Caller also serializes generation changes under account work.
func (db *DB) MatchAccountIdentity(username string, id primitive.ObjectID) (bool, error) {
	if username == "" || id.IsZero() {
		return false, nil
	}
	accounts, err := db.identityAccounts()
	if err != nil {
		return false, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	var found struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	err = accounts.FindOne(ctx, bson.M{"_id": id, "username": username}, options.FindOne().SetProjection(bson.M{"_id": 1})).Decode(&found)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	return err == nil && found.ID == id, err
}
