package database

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

var errOwnerProfileSnapshot = errors.New("owner account profile could not be encoded within its budget")

// Prepared source projection, not a query, endpoint or authorization mechanism.
// The eventual reader must retrieve these fields together from one account,
// using the authenticated owner's identity. It must not combine an account
// document with a recovery address supplied by a client or another account.
type ownerProfileSource struct {
	Username      string        `bson:"username" json:"-"`
	PublicName    string        `bson:"public_name" json:"-"`
	Email         string        `bson:"email" json:"-"`
	CreatedAt     time.Time     `bson:"created_at" json:"-"`
	RecoveryEmail recoveryEmail `bson:"recovery_email" json:"-"`
}

type ownerProfileSnapshot struct {
	Format      string              `json:"format"`
	Version     int                 `json:"version"`
	GeneratedAt time.Time           `json:"generated_at"`
	Profile     ownerAccountProfile `json:"profile"`
}

// Explicit output types never embed User, recoveryAccount or staff records.
// The submitted registration address is deliberately separate from an address
// verified through recovery. Neither address is account-ownership proof here.
type ownerAccountProfile struct {
	Username              string                        `json:"username"`
	PublicName            string                        `json:"public_name"`
	SubmittedEmail        string                        `json:"submitted_email"`
	CreatedAt             *time.Time                    `json:"created_at,omitempty"`
	VerifiedRecoveryEmail *ownerVerifiedRecoveryAddress `json:"verified_recovery_email,omitempty"`
}

type ownerVerifiedRecoveryAddress struct {
	Address    string    `json:"address"`
	VerifiedAt time.Time `json:"verified_at"`
}

func encodeOwnerProfileSnapshot(source ownerProfileSource, provedOwner string, generatedAt time.Time, maxBytes int) ([]byte, error) {
	// This identity fence is additional defense, not proof of authentication.
	if provedOwner == "" || source.Username != provedOwner || generatedAt.IsZero() || maxBytes < 1 {
		return nil, errOwnerProfileSnapshot
	}
	profile := ownerAccountProfile{Username: source.Username, PublicName: source.PublicName, SubmittedEmail: source.Email}
	if !source.CreatedAt.IsZero() {
		created := source.CreatedAt.UTC()
		profile.CreatedAt = &created
	}
	if !source.RecoveryEmail.VerifiedAt.IsZero() && ValidRecoveryEmail(source.RecoveryEmail.Address) {
		profile.VerifiedRecoveryEmail = &ownerVerifiedRecoveryAddress{
			Address: source.RecoveryEmail.Address, VerifiedAt: source.RecoveryEmail.VerifiedAt.UTC(),
		}
	}
	encoded, err := json.Marshal(ownerProfileSnapshot{
		Format: "eidolon-owner-account-profile", Version: 1, GeneratedAt: generatedAt.UTC(), Profile: profile,
	})
	// Response-size bound, not an input/allocation bound. The eventual reader
	// needs its own admission and bounded projection before enabling delivery.
	if err != nil || len(encoded) > maxBytes {
		return nil, errOwnerProfileSnapshot
	}
	return encoded, nil
}

// Prepared internal reader; intentionally not exposed through any transport.
// The eventual caller must bind owner to its authenticated session and apply
// bounded admission before invoking password verification. Administrator role
// and knowledge of an email are not alternatives to the current password.
func (db *DB) readOwnerProfileSnapshot(ctx context.Context, owner, password string, generatedAt time.Time, maxBytes int) ([]byte, error) {
	if ctx == nil || db == nil || db.users == nil || owner == "" || len(password) < 1 || len(password) > 72 || generatedAt.IsZero() || maxBytes < 1 {
		return nil, errOwnerProfileSnapshot
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var credential struct {
		Hash string `bson:"password_hash" json:"-"`
	}
	err := db.users.FindOne(ctx, bson.M{"username": owner}, options.FindOne().
		SetProjection(bson.M{"_id": 0, "password_hash": 1}).SetMaxTime(3*time.Second)).Decode(&credential)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(credential.Hash), []byte(password)) != nil || ctx.Err() != nil {
		return nil, errOwnerProfileSnapshot
	}
	var source ownerProfileSource
	// Match the credential again: a concurrent reset must not leave old proof
	// authorizing a later profile read. Only the narrow profile leaves Mongo.
	err = db.users.FindOne(ctx, bson.M{"username": owner, "password_hash": credential.Hash}, options.FindOne().
		SetProjection(bson.M{"_id": 0, "username": 1, "public_name": 1, "email": 1, "created_at": 1,
			"recovery_email.address": 1, "recovery_email.verified_at": 1}).SetMaxTime(3*time.Second)).Decode(&source)
	if err != nil || ctx.Err() != nil {
		return nil, errOwnerProfileSnapshot
	}
	return encodeOwnerProfileSnapshot(source, owner, generatedAt, maxBytes)
}
