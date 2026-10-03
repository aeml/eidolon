package database

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

const BossVictoryPending = "pending"
const BossVictoryComplete = "complete"

var ErrBossVictoryConflict = errors.New("boss victory conflicts with its retained first outcome")
var ErrBossVictoryUnconfirmed = errors.New("boss victory recipient save is not confirmed")

type BossVictoryRecord struct {
	BossVictoryOperation `bson:",inline"`
	State                string `bson:"state"`
}

func validBossVictoryID(id string) bool {
	value := strings.TrimPrefix(id, bossVictoryPrefix)
	_, err := hex.DecodeString(value)
	return strings.HasPrefix(id, bossVictoryPrefix) && len(value) == 64 && err == nil
}

func (record BossVictoryRecord) Validate() error {
	if err := record.BossVictoryOperation.Validate(); err != nil {
		return err
	}
	if record.State != BossVictoryPending && record.State != BossVictoryComplete {
		return ErrBossVictoryConflict
	}
	return nil
}

func (db *DB) durableBossVictories() (*mongo.Collection, error) {
	if db == nil || db.bossVictories == nil {
		return nil, errors.New("boss victory storage unavailable")
	}
	return db.bossVictories.Clone(options.Collection().
		SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()).
		SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
}

func applyBossVictoryIndexes(ctx context.Context, db *DB) error {
	collection, err := db.durableBossVictories()
	if err != nil {
		return err
	}
	_, err = collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "instance_id", Value: 1}, {Key: "boss_id", Value: 1}}, Options: options.Index().SetName("unique_boss_victory").SetUnique(true)},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("pending_boss_victory_recovery")},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "participants.username", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("pending_boss_victory_account")},
		{Keys: bson.D{{Key: "drops.expires_at", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("active_boss_victory_drops")},
	})
	return err
}

func bossVictoryByID(ctx context.Context, collection *mongo.Collection, id string) (*BossVictoryRecord, error) {
	var record BossVictoryRecord
	if err := collection.FindOne(ctx, bson.M{"_id": id}).Decode(&record); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	if err := record.Validate(); err != nil {
		return nil, err
	}
	return &record, nil
}

func (db *DB) GetBossVictory(id string) (*BossVictoryRecord, error) {
	if !validBossVictoryID(id) {
		return nil, ErrBossVictoryConflict
	}
	collection, err := db.durableBossVictories()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return bossVictoryByID(ctx, collection, id)
}

func (db *DB) PrepareBossVictory(op BossVictoryOperation) (*BossVictoryRecord, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	collection, err := db.durableBossVictories()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	previous, err := bossVictoryByID(ctx, collection, op.ID)
	if err != nil {
		return nil, err
	}
	if previous != nil {
		if previous.Fingerprint != op.Fingerprint {
			return nil, ErrBossVictoryConflict
		}
		return previous, nil
	}
	record := BossVictoryRecord{BossVictoryOperation: op, State: BossVictoryPending}
	if _, err := collection.InsertOne(ctx, record); err != nil {
		if !mongo.IsDuplicateKeyError(err) {
			return nil, err
		}
		previous, err := bossVictoryByID(ctx, collection, op.ID)
		if err != nil {
			return nil, err
		}
		if previous == nil || previous.Fingerprint != op.Fingerprint {
			return nil, ErrBossVictoryConflict
		}
		return previous, nil
	}
	return &record, nil
}

// Never complete from a caller's RAM marker: every original recipient must
// have actually saved this exact fingerprint in the strongly read character.
func (db *DB) CompleteBossVictory(id, fingerprint string) (*BossVictoryRecord, error) {
	if !validBossVictoryID(id) {
		return nil, ErrBossVictoryConflict
	}
	collection, err := db.durableBossVictories()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	record, err := bossVictoryByID(ctx, collection, id)
	if err != nil {
		return nil, err
	}
	if record == nil || record.Fingerprint != fingerprint {
		return nil, ErrBossVictoryConflict
	}
	if record.State == BossVictoryComplete {
		return record, nil
	}
	for _, participant := range record.Participants {
		character, err := db.GetDirectTradeCharacter(participant.Username, participant.Username)
		if err != nil {
			return nil, err
		}
		if !BossVictoryCharacterReceiptMatches(character, record.BossVictoryOperation) {
			return nil, ErrBossVictoryUnconfirmed
		}
	}
	result, err := collection.UpdateOne(ctx, bson.M{"_id": id, "fingerprint": fingerprint, "state": BossVictoryPending}, bson.M{"$set": bson.M{"state": BossVictoryComplete}})
	if err != nil {
		return nil, err
	}
	if result.MatchedCount != 1 {
		current, err := bossVictoryByID(ctx, collection, id)
		if err != nil {
			return nil, err
		}
		if current == nil || current.Fingerprint != fingerprint || current.State != BossVictoryComplete {
			return nil, ErrBossVictoryConflict
		}
		return current, nil
	}
	record.State = BossVictoryComplete
	return record, nil
}

func (db *DB) PendingBossVictories(username, afterID string, limit int) ([]BossVictoryRecord, error) {
	if (username != "" && !boundedActivityText(username, 256, true)) || (afterID != "" && !validBossVictoryID(afterID)) || limit < 1 || limit > 50 {
		return nil, ErrBossVictoryConflict
	}
	collection, err := db.durableBossVictories()
	if err != nil {
		return nil, err
	}
	filter := bson.M{"state": BossVictoryPending}
	if username != "" {
		filter["participants.username"] = username
	}
	if afterID != "" {
		filter["_id"] = bson.M{"$gt": afterID}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []BossVictoryRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	for _, record := range records {
		_, eligible := BossVictoryRecipientFor(record.BossVictoryOperation, username)
		if record.Validate() != nil || record.State != BossVictoryPending || record.ID <= afterID || (username != "" && !eligible) {
			return nil, ErrBossVictoryConflict
		}
	}
	return records, nil
}

// Original unclaimed drops remain recoverable after private rewards complete.
// Never scan only pending victories or renew loot availability at restart.
func (db *DB) ActiveBossVictoryDropPage(afterID string, now time.Time, limit int) ([]BossVictoryRecord, error) {
	if (afterID != "" && !validBossVictoryID(afterID)) || now.IsZero() || limit < 1 || limit > 50 {
		return nil, ErrBossVictoryConflict
	}
	collection, err := db.durableBossVictories()
	if err != nil {
		return nil, err
	}
	filter := bson.M{"drops.expires_at": bson.M{"$gt": now.UTC().Truncate(time.Millisecond)}}
	if afterID != "" {
		filter["_id"] = bson.M{"$gt": afterID}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []BossVictoryRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	for _, record := range records {
		active := false
		for _, drop := range record.Drops {
			active = active || drop.ExpiresAt.After(now.UTC().Truncate(time.Millisecond))
		}
		if record.Validate() != nil || record.ID <= afterID || !active {
			return nil, ErrBossVictoryConflict
		}
	}
	return records, nil
}
