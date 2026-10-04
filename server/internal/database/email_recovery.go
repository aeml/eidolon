package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const RecoveryVerificationLifetime = 30 * time.Minute
const PasswordRecoveryLifetime = 15 * time.Minute
const RecoveryMailCooldown = time.Minute

// Registration email is deliberately NOT ownership proof. These optional,
// private account fields are established only by password proof + mail proof.
type recoveryEmail struct {
	Address    string    `bson:"address"`
	VerifiedAt time.Time `bson:"verified_at"`
}

type recoveryChallenge struct {
	Digest       string    `bson:"digest"`
	Address      string    `bson:"address"`
	PasswordHash string    `bson:"password_hash"`
	IssuedAt     time.Time `bson:"issued_at"`
	ExpiresAt    time.Time `bson:"expires_at"`
}

type recoveryAccount struct {
	Hash         string            `bson:"password_hash"`
	Email        recoveryEmail     `bson:"recovery_email"`
	Verification recoveryChallenge `bson:"recovery_email_pending"`
	Reset        recoveryChallenge `bson:"password_recovery"`
}

// Require exactly one bare mailbox, not a display name or recipient list.
// Preserve local-part spelling rather than guessing provider normalization.
func ValidRecoveryEmail(value string) bool {
	if value == "" || len(value) > 254 || strings.ContainsAny(value, "\r\n\x00") {
		return false
	}
	address, err := mail.ParseAddress(value)
	return err == nil && address.Name == "" && address.Address == value && strings.Contains(value, "@")
}

func recoveryDigest(token string) (string, bool) {
	if len(token) != 64 {
		return "", false
	}
	decoded, err := hex.DecodeString(token)
	if err != nil || len(decoded) != 32 || hex.EncodeToString(decoded) != token {
		return "", false
	}
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:]), true
}

func recoveryProjection() *options.FindOneOptions {
	return options.FindOne().SetProjection(bson.M{"_id": 0, "password_hash": 1,
		"recovery_email": 1, "recovery_email_pending": 1, "password_recovery": 1})
}

func recoveryCooldownFilter(field string, now time.Time) bson.A {
	return bson.A{bson.M{field + ".issued_at": bson.M{"$exists": false}},
		bson.M{field + ".issued_at": bson.M{"$lte": now.Add(-RecoveryMailCooldown)}}}
}

func newRecoveryChallenge(digest, address, hash string, now time.Time, lifetime time.Duration) recoveryChallenge {
	return recoveryChallenge{Digest: digest, Address: address, PasswordHash: hash, IssuedAt: now, ExpiresAt: now.Add(lifetime)}
}

func (db *DB) BeginRecoveryEmail(username, currentPassword, address, token string, now time.Time) (bool, error) {
	digest, valid := recoveryDigest(token)
	if !valid || !ValidRecoveryEmail(address) || len(currentPassword) == 0 || len(currentPassword) > 72 || username == "" {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var account recoveryAccount
	err := db.users.FindOne(ctx, bson.M{"username": username}, recoveryProjection()).Decode(&account)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if bcrypt.CompareHashAndPassword([]byte(account.Hash), []byte(currentPassword)) != nil {
		return false, nil
	}
	result, err := db.users.UpdateOne(ctx, bson.M{"username": username, "password_hash": account.Hash,
		"$or": recoveryCooldownFilter("recovery_email_pending", now)},
		bson.M{"$set": bson.M{"recovery_email_pending": newRecoveryChallenge(digest, address, account.Hash, now, RecoveryVerificationLifetime)}})
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}

func (db *DB) ConfirmRecoveryEmail(username, token string, now time.Time) (bool, error) {
	digest, valid := recoveryDigest(token)
	if !valid || username == "" {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var account recoveryAccount
	filter := bson.M{"username": username, "recovery_email_pending.digest": digest,
		"recovery_email_pending.expires_at": bson.M{"$gt": now},
		"$expr":                             bson.M{"$eq": bson.A{"$password_hash", "$recovery_email_pending.password_hash"}}}
	err := db.users.FindOne(ctx, filter, recoveryProjection()).Decode(&account)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if account.Hash == "" || !ValidRecoveryEmail(account.Verification.Address) {
		return false, nil
	}
	// CAS rechecks both proofs; replacing an address invalidates old reset links.
	filter["password_hash"] = account.Hash
	filter["recovery_email_pending.address"] = account.Verification.Address
	result, err := db.users.UpdateOne(ctx, filter, bson.M{
		"$set":   bson.M{"recovery_email": recoveryEmail{Address: account.Verification.Address, VerifiedAt: now}},
		"$unset": bson.M{"recovery_email_pending": "", "password_recovery": ""}})
	if err != nil {
		return false, err
	}
	return result.ModifiedCount == 1, nil
}

// Called by a bounded asynchronous mail worker. Empty recipient intentionally
// conflates unknown, unverified, cooldown and raced accounts; no public lookup.
func (db *DB) BeginPasswordRecovery(username, token string, now time.Time) (string, error) {
	digest, valid := recoveryDigest(token)
	if !valid || username == "" {
		return "", nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var account recoveryAccount
	err := db.users.FindOne(ctx, bson.M{"username": username}, recoveryProjection()).Decode(&account)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if account.Hash == "" || account.Email.VerifiedAt.IsZero() || !ValidRecoveryEmail(account.Email.Address) {
		return "", nil
	}
	result, err := db.users.UpdateOne(ctx, bson.M{"username": username, "password_hash": account.Hash,
		"recovery_email.address": account.Email.Address, "recovery_email.verified_at": account.Email.VerifiedAt,
		"$or": recoveryCooldownFilter("password_recovery", now)}, bson.M{"$set": bson.M{
		"password_recovery": newRecoveryChallenge(digest, account.Email.Address, account.Hash, now, PasswordRecoveryLifetime)}})
	if err != nil {
		return "", err
	}
	if result.ModifiedCount != 1 {
		return "", nil
	}
	return account.Email.Address, nil
}

// attempted distinguishes a potentially committed update from an error before
// token proof. Only a proved reset may invalidate the account's live sessions.
// The protocol boundary applies the normal strong new-password policy first.
func (db *DB) CompletePasswordRecovery(username, token, next string, now time.Time) (changed, attempted bool, err error) {
	digest, valid := recoveryDigest(token)
	if !valid || username == "" || len(next) == 0 || len(next) > 72 {
		return false, false, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{"username": username, "password_recovery.digest": digest,
		"password_recovery.expires_at": bson.M{"$gt": now},
		"$expr": bson.M{"$and": bson.A{
			bson.M{"$eq": bson.A{"$password_hash", "$password_recovery.password_hash"}},
			bson.M{"$eq": bson.A{"$recovery_email.address", "$password_recovery.address"}},
		}}}
	var account recoveryAccount
	err = db.users.FindOne(ctx, filter, recoveryProjection()).Decode(&account)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	if account.Email.VerifiedAt.IsZero() || !ValidRecoveryEmail(account.Email.Address) {
		return false, false, nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return false, false, err
	}
	filter["password_hash"] = account.Hash
	filter["recovery_email.verified_at"] = account.Email.VerifiedAt
	result, err := db.users.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"password_hash": string(hash)},
		"$unset": bson.M{"password_recovery": "", "recovery_email_pending": ""}})
	if err != nil {
		return false, true, err
	}
	return result.ModifiedCount == 1, true, nil
}
