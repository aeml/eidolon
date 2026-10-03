package database

import (
	"context"
	"encoding/hex"
	"errors"
	"math"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

const GroundItemPending = "pending"
const GroundItemComplete = "complete"

var ErrGroundItemConflict = errors.New("ground item intent conflicts with retained custody")
var ErrGroundItemBusy = errors.New("a ground item operation is awaiting recovery")

// Append-only operation generations are also the ground-loot ledger. Completed
// identity/generation rows are retained, never TTL-deleted. A pickup inherits
// its original availability/expiry rather than renewing the ground lifetime.
type GroundItemRecord struct {
	GroundItemOperation `bson:",inline"`
	State               string    `bson:"state"`
	AvailableAt         time.Time `bson:"available_at,omitempty"`
	ExpiresAt           time.Time `bson:"expires_at,omitempty"`
}

func validGroundItemOperationID(id string) bool {
	value := strings.TrimPrefix(id, groundItemPrefix)
	_, err := hex.DecodeString(value)
	return strings.HasPrefix(id, groundItemPrefix) && len(value) == 64 && err == nil
}

func (record GroundItemRecord) Validate() error {
	if err := record.GroundItemOperation.Validate(); err != nil {
		return err
	}
	if record.State != GroundItemPending && record.State != GroundItemComplete {
		return ErrGroundItemConflict
	}
	if record.Kind == GroundItemDrop && record.State == GroundItemPending {
		if !record.AvailableAt.IsZero() || !record.ExpiresAt.IsZero() {
			return ErrGroundItemConflict
		}
		return nil
	}
	if record.AvailableAt.IsZero() || !record.ExpiresAt.Equal(record.AvailableAt.Add(time.Minute)) ||
		!record.AvailableAt.Equal(record.AvailableAt.UTC().Truncate(time.Millisecond)) {
		return ErrGroundItemConflict
	}
	_, offset := record.AvailableAt.Zone()
	if offset != 0 {
		return ErrGroundItemConflict
	}
	if record.Kind == GroundItemDrop {
		if record.AvailableAt.Before(record.CreatedAt) {
			return ErrGroundItemConflict
		}
	} else if record.CreatedAt.Before(record.AvailableAt) || !record.CreatedAt.Before(record.ExpiresAt) || !record.LootTime.Equal(record.AvailableAt) {
		return ErrGroundItemConflict
	}
	return nil
}

func (record GroundItemRecord) GroundPayload() string {
	if record.State != GroundItemComplete {
		return "" // Pending custody is not free ground loot.
	}
	if record.Kind == GroundItemDrop {
		return record.MovedPayload
	}
	return record.RemainingPayload
}

func (db *DB) groundItemCollection() (*mongo.Collection, error) {
	if db == nil || db.groundItemOperations == nil {
		return nil, errors.New("ground item storage unavailable")
	}
	return db.groundItemOperations.Clone(options.Collection().
		SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()).
		SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
}

func applyGroundItemOperationIndexes(ctx context.Context, db *DB) error {
	collection, err := db.groundItemCollection()
	if err != nil {
		return err
	}
	_, err = collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetName("one_pending_ground_item_per_account").SetUnique(true).
			SetPartialFilterExpression(bson.M{"state": GroundItemPending})},
		{Keys: bson.D{{Key: "loot_id", Value: 1}}, Options: options.Index().SetName("one_pending_ground_item_per_loot").SetUnique(true).
			SetPartialFilterExpression(bson.M{"state": GroundItemPending})},
		{Keys: bson.D{{Key: "loot_id", Value: 1}, {Key: "generation", Value: -1}}, Options: options.Index().SetName("ground_item_generations").SetUnique(true)},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("ground_item_recovery")},
		{Keys: bson.D{{Key: "expires_at", Value: 1}, {Key: "loot_id", Value: 1}}, Options: options.Index().SetName("ground_item_active_projection")},
	})
	return err
}

func (db *DB) GetGroundItemOperation(id string) (*GroundItemRecord, error) {
	if !validGroundItemOperationID(id) {
		return nil, ErrGroundItemConflict
	}
	return db.readGroundItem(bson.M{"_id": id}, nil)
}

func (db *DB) LatestGroundItemOperation(lootID string) (*GroundItemRecord, error) {
	if !boundedActivityText(lootID, 512, true) {
		return nil, ErrGroundItemConflict
	}
	return db.readGroundItem(bson.M{"loot_id": lootID}, options.FindOne().SetSort(bson.D{{Key: "generation", Value: -1}}))
}

func (db *DB) readGroundItem(filter bson.M, find *options.FindOneOptions) (*GroundItemRecord, error) {
	collection, err := db.groundItemCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record GroundItemRecord
	var findOptions []*options.FindOneOptions
	if find != nil {
		findOptions = append(findOptions, find)
	}
	err = collection.FindOne(ctx, filter, findOptions...).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := record.Validate(); err != nil {
		return nil, err
	}
	return &record, nil
}

// Same-ID reconciliation precedes generation/capacity checks. The first frozen
// intent survives an unknown insert result, account/loot contention and later
// generations. A write failure never implies permission to release RAM custody.
func (db *DB) PrepareGroundItemOperation(op GroundItemOperation) (*GroundItemRecord, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	stored, err := db.GetGroundItemOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if stored != nil {
		if stored.Fingerprint != op.Fingerprint {
			return nil, ErrGroundItemConflict
		}
		return stored, nil
	}
	previous, err := db.LatestGroundItemOperation(op.LootID)
	if err != nil {
		return nil, err
	}
	record := GroundItemRecord{GroundItemOperation: op, State: GroundItemPending}
	if op.Kind == GroundItemDrop {
		if previous != nil {
			return nil, ErrGroundItemConflict
		}
	} else if previous == nil {
		// Ordinary enemy loot becomes durable on its first reserved pickup.
		// The caller must validate/reserve its exact live projection first.
		if op.Generation != 1 || op.LootTime.IsZero() {
			return nil, ErrGroundItemConflict
		}
		record.AvailableAt, record.ExpiresAt = op.LootTime, op.LootTime.Add(time.Minute)
	} else {
		birth := previous.LootCreatedAt
		if previous.Kind == GroundItemDrop {
			birth = previous.AvailableAt
		}
		if previous.State == GroundItemPending {
			return nil, ErrGroundItemBusy
		}
		if previous.Generation == math.MaxInt64 || op.Generation != previous.Generation+1 || previous.GroundPayload() == "" ||
			op.BeforePayload != previous.GroundPayload() || op.InstanceID != previous.InstanceID || op.X != previous.X || op.Z != previous.Z ||
			op.LootOwnerID != previous.LootOwnerID || op.LootPartyID != previous.LootPartyID || !op.LootCreatedAt.Equal(birth) {
			return nil, ErrGroundItemConflict
		}
		record.AvailableAt, record.ExpiresAt = previous.AvailableAt, previous.ExpiresAt
	}
	if err := record.Validate(); err != nil {
		return nil, err
	}
	collection, err := db.groundItemCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = collection.InsertOne(ctx, record)
	if err == nil {
		return &record, nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return nil, err // Unknown: keep the SAME ID/frozen plan for reconciliation.
	}
	stored, err = db.GetGroundItemOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if stored == nil {
		return nil, ErrGroundItemBusy
	}
	if stored.Fingerprint != op.Fingerprint {
		return nil, ErrGroundItemConflict
	}
	return stored, nil
}

// Caller owns the actor's work lock. Read its actual primary majority character;
// RAM copies and journal presence alone are not confirmed database receipts.
// Drop publication time is frozen by the first successful compare-and-set.
func (db *DB) CompleteGroundItemOperation(id, fingerprint string) (*GroundItemRecord, error) {
	record, err := db.GetGroundItemOperation(id)
	if err != nil {
		return nil, err
	}
	if record == nil || record.Fingerprint != fingerprint {
		return nil, ErrGroundItemConflict
	}
	if record.State == GroundItemComplete {
		return record, nil
	}
	character, err := db.GetDirectTradeCharacter(record.Username, record.Username)
	if err != nil {
		return nil, err
	}
	if !GroundItemCharacterReceiptMatches(character, record.GroundItemOperation) {
		return nil, ErrGroundItemConflict
	}
	available, expires := record.AvailableAt, record.ExpiresAt
	if record.Kind == GroundItemDrop {
		available = time.Now().UTC().Truncate(time.Millisecond)
		if available.Before(record.CreatedAt) {
			return nil, ErrGroundItemConflict
		}
		expires = available.Add(time.Minute)
	}
	collection, err := db.groundItemCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = collection.UpdateOne(ctx, bson.M{"_id": id, "fingerprint": fingerprint, "state": GroundItemPending},
		bson.M{"$set": bson.M{"state": GroundItemComplete, "available_at": available, "expires_at": expires}})
	if err != nil {
		return nil, err // Never invent a second availability window after lost ACK.
	}
	stored, err := db.GetGroundItemOperation(id)
	if err != nil {
		return nil, err
	}
	if stored == nil || stored.Fingerprint != fingerprint || stored.State != GroundItemComplete {
		return nil, ErrGroundItemConflict
	}
	return stored, nil
}

// Cursor-based paging can progress past a failed first batch. Account-scoped
// queries contain at most one record under the partial unique index.
func (db *DB) PendingGroundItemOperations(username, afterID string, limit int) ([]GroundItemRecord, error) {
	if !boundedActivityText(username, 256, false) || (afterID != "" && !validGroundItemOperationID(afterID)) || limit < 1 || limit > 50 {
		return nil, ErrGroundItemConflict
	}
	filter := bson.M{"state": GroundItemPending}
	if username != "" {
		filter["username"] = username
	}
	if afterID != "" {
		filter["_id"] = bson.M{"$gt": afterID}
	}
	collection, err := db.groundItemCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := collection.Find(ctx, filter, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []GroundItemRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	for _, record := range records {
		if err := record.Validate(); err != nil || record.State != GroundItemPending {
			return nil, ErrGroundItemConflict
		}
	}
	return records, nil
}

// The expiry index bounds the scan to the original active ground lifetime.
// Group AFTER including pending generations: an older completed record must
// never be restored as free loot while a newer pickup owns its reservation.
// Return pending rows too; callers must keep those reserved, not publish them.
func (db *DB) GroundItemProjectionPage(afterLootID string, now time.Time, limit int) ([]GroundItemRecord, error) {
	if !boundedActivityText(afterLootID, 512, false) || now.IsZero() || limit < 1 || limit > 50 {
		return nil, ErrGroundItemConflict
	}
	collection, err := db.groundItemCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"expires_at": bson.M{"$gt": now}, "loot_id": bson.M{"$gt": afterLootID}}}},
		{{Key: "$sort", Value: bson.D{{Key: "loot_id", Value: 1}, {Key: "generation", Value: -1}}}},
		{{Key: "$group", Value: bson.M{"_id": "$loot_id", "latest": bson.M{"$first": "$$ROOT"}}}},
		{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$latest"}}},
		{{Key: "$sort", Value: bson.D{{Key: "loot_id", Value: 1}}}},
		{{Key: "$limit", Value: int64(limit)}},
	}
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []GroundItemRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	for _, record := range records {
		if err := record.Validate(); err != nil {
			return nil, err
		}
	}
	return records, nil
}
