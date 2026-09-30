package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	GuildBankPending      = "pending"
	GuildBankComplete     = "complete"
	GuildBankRejected     = "rejected"
	GuildBankDepositGold  = "bank_gold_deposit"
	GuildBankWithdrawGold = "bank_gold_withdraw"
	GuildBankDepositItem  = "bank_item_deposit"
	GuildBankWithdrawItem = "bank_item_withdraw"
)

var (
	ErrGuildBankOperationConflict = errors.New("guild bank request ID was already used for another transfer")
	ErrGuildBankOperationBusy     = errors.New("a previous guild bank transfer is still being recovered")
	ErrGuildBankOperationStale    = errors.New("guild bank transfer no longer matches the saved guild version")
	ErrGuildBankOperationRejected = errors.New("guild bank transfer was rejected")
	guildBankOperationIDPattern   = regexp.MustCompile(`^guildbank:[0-9a-f]{64}$`)
	guildBankRequestIDPattern     = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)
)

// Server-built immutable intent, not a client item or an account-history reply.
// Keep terminal IDs permanently: expiring them would allow old requests to pay
// again. Guild and character effects must each have durable replay receipts;
// this record alone is NOT proof that either side of the transfer was applied.
type GuildBankOperation struct {
	Version               int       `bson:"version"`
	ID                    string    `bson:"_id"`
	RequestID             string    `bson:"request_id"`
	Fingerprint           string    `bson:"fingerprint"`
	Username              string    `bson:"username"`
	PlayerID              string    `bson:"player_id"`
	CharacterName         string    `bson:"character_name"`
	GuildID               string    `bson:"guild_id"`
	GuildVersion          int       `bson:"guild_version"`
	CharacterBankRevision int64     `bson:"character_bank_revision"`
	Action                string    `bson:"action"`
	Gold                  int       `bson:"gold"`
	ItemPayload           string    `bson:"item_payload"`
	CreatedAt             time.Time `bson:"created_at"`
	State                 string    `bson:"state"`
}

func GuildBankOperationID(username, requestID string) string {
	value, _ := json.Marshal([2]string{username, requestID})
	digest := sha256.Sum256(value)
	return "guildbank:" + hex.EncodeToString(digest[:])
}

func GuildBankOperationFingerprint(op GuildBankOperation) string {
	// Do not include mutable settlement state or the caller's retry timestamp.
	value, _ := json.Marshal(struct {
		Username, PlayerID, CharacterName, GuildID, Action string
		Gold, GuildVersion                                 int
		CharacterBankRevision                              int64
		ItemPayload                                        string
	}{op.Username, op.PlayerID, op.CharacterName, op.GuildID, op.Action, op.Gold, op.GuildVersion, op.CharacterBankRevision, op.ItemPayload})
	digest := sha256.Sum256(value)
	return hex.EncodeToString(digest[:])
}

func (op GuildBankOperation) Validate() error {
	if op.Version != 1 || !guildBankRequestIDPattern.MatchString(op.RequestID) || !guildBankOperationIDPattern.MatchString(op.ID) ||
		!boundedActivityText(op.Username, 256, true) || !boundedActivityText(op.CharacterName, 256, true) ||
		!boundedActivityText(op.GuildID, 128, true) || op.PlayerID != "player-"+op.Username ||
		op.ID != GuildBankOperationID(op.Username, op.RequestID) || op.Fingerprint != GuildBankOperationFingerprint(op) || op.CreatedAt.IsZero() ||
		op.GuildVersion < 0 || op.GuildVersion == math.MaxInt || op.CharacterBankRevision < 0 || op.CharacterBankRevision == math.MaxInt64 {
		return errors.New("invalid guild bank operation identity")
	}
	if op.State != GuildBankPending && op.State != GuildBankComplete && op.State != GuildBankRejected {
		return errors.New("invalid guild bank operation state")
	}
	switch op.Action {
	case GuildBankDepositGold, GuildBankWithdrawGold:
		if op.Gold <= 0 || op.ItemPayload != "" {
			return errors.New("invalid guild bank Gold intent")
		}
	case GuildBankDepositItem, GuildBankWithdrawItem:
		if op.Gold != 0 || len(op.ItemPayload) > 65536 || !json.Valid([]byte(op.ItemPayload)) {
			return errors.New("invalid guild bank item intent")
		}
		var item struct {
			ID    string
			Stack int
		}
		if err := json.Unmarshal([]byte(op.ItemPayload), &item); err != nil || item.ID == "" || item.Stack <= 0 || strings.HasPrefix(item.ID, "chronicle-item-") {
			return errors.New("invalid or personal guild bank item")
		}
	default:
		return errors.New("invalid guild bank transfer action")
	}
	return nil
}

func applyGuildBankOperationIndexes(ctx context.Context, db *DB) error {
	_, err := db.guildBankOperations.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetName("one_pending_bank_transfer_per_account").SetUnique(true).SetPartialFilterExpression(bson.M{"state": GuildBankPending})},
		{Keys: bson.D{{Key: "guild_id", Value: 1}}, Options: options.Index().SetName("one_pending_bank_transfer_per_guild").SetUnique(true).SetPartialFilterExpression(bson.M{"state": GuildBankPending})},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("guild_bank_recovery")},
		{Keys: bson.D{{Key: "guild_id", Value: 1}, {Key: "state", Value: 1}}, Options: options.Index().SetName("guild_bank_pending_guild")},
	})
	return err
}

func (db *DB) GetGuildBankOperation(id string) (*GuildBankOperation, error) {
	if db == nil || db.guildBankOperations == nil || !guildBankOperationIDPattern.MatchString(id) {
		return nil, errors.New("invalid guild bank operation lookup")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var op GuildBankOperation
	err := db.guildBankOperations.FindOne(ctx, bson.M{"_id": id}).Decode(&op)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := op.Validate(); err != nil {
		return nil, err
	}
	return &op, nil
}

// No effects may precede this insert. An unknown insertion result must be
// reconciled using this SAME ID, never compensated or retried with a new ID.
func (db *DB) PrepareGuildBankOperation(op GuildBankOperation) (*GuildBankOperation, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if db == nil || db.guildBankOperations == nil || op.State != GuildBankPending {
		return nil, errors.New("guild bank intent cannot be prepared")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.guildBankOperations.InsertOne(ctx, op)
	if err == nil {
		return &op, nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return nil, err
	}
	stored, err := db.GetGuildBankOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if stored == nil {
		return nil, ErrGuildBankOperationBusy
	}
	if stored.Fingerprint != op.Fingerprint {
		return nil, ErrGuildBankOperationConflict
	}
	return stored, nil // The first durable plan/timestamp/outcome always wins.
}

// Only call complete after BOTH bank and character receipts are durable, or
// rejected after proving neither side changed. This freezes a terminal outcome;
// the executor, not this storage API, is responsible for those proofs.
func (db *DB) FinishGuildBankOperation(id, fingerprint, state string) (*GuildBankOperation, error) {
	if state != GuildBankComplete && state != GuildBankRejected {
		return nil, errors.New("invalid guild bank terminal outcome")
	}
	op, err := db.GetGuildBankOperation(id)
	if err != nil {
		return nil, err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return nil, ErrGuildBankOperationConflict
	}
	if op.State != GuildBankPending {
		if op.State != state {
			return nil, ErrGuildBankOperationConflict
		}
		return op, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.guildBankOperations.UpdateOne(ctx, bson.M{"_id": id, "fingerprint": fingerprint, "state": GuildBankPending}, bson.M{"$set": bson.M{"state": state}})
	if err != nil {
		return nil, err
	}
	stored, err := db.GetGuildBankOperation(id)
	if err != nil {
		return nil, err
	}
	if stored == nil || stored.State != state {
		return nil, ErrGuildBankOperationConflict
	}
	return stored, nil
}

func (db *DB) PendingGuildBankOperations(username string, limit int) ([]GuildBankOperation, error) {
	if db == nil || db.guildBankOperations == nil || limit < 1 || limit > 50 || !boundedActivityText(username, 256, false) {
		return nil, errors.New("invalid guild bank recovery query")
	}
	filter := bson.M{"state": GuildBankPending}
	if username != "" {
		filter["username"] = username
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.guildBankOperations.Find(ctx, filter, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	result := []GuildBankOperation{}
	if err := cursor.All(ctx, &result); err != nil {
		return nil, err
	}
	for _, op := range result {
		if err := op.Validate(); err != nil {
			return nil, err
		}
	}
	return result, nil
}
