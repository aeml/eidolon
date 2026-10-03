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

const DungeonRoomRewardPending = "pending"
const DungeonRoomRewardComplete = "complete"

var ErrDungeonRoomRewardConflict = errors.New("dungeon room reward conflicts with its retained first outcome")
var ErrDungeonRoomRewardUnconfirmed = errors.New("dungeon room reward recipient save is not confirmed")

type DungeonRoomRewardRecord struct {
	DungeonRoomRewardOperation `bson:",inline"`
	State                      string `bson:"state"`
}

func validDungeonRoomRewardID(id string) bool {
	value := strings.TrimPrefix(id, dungeonRoomRewardPrefix)
	_, err := hex.DecodeString(value)
	return strings.HasPrefix(id, dungeonRoomRewardPrefix) && len(value) == 64 && err == nil
}

func (record DungeonRoomRewardRecord) Validate() error {
	if err := record.DungeonRoomRewardOperation.Validate(); err != nil {
		return err
	}
	if record.State != DungeonRoomRewardPending && record.State != DungeonRoomRewardComplete {
		return ErrDungeonRoomRewardConflict
	}
	return nil
}

func (db *DB) durableDungeonRoomRewards() (*mongo.Collection, error) {
	if db == nil || db.dungeonRoomRewards == nil {
		return nil, errors.New("dungeon room reward storage unavailable")
	}
	return db.dungeonRoomRewards.Clone(options.Collection().
		SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()).
		SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
}

func applyDungeonRoomRewardIndexes(ctx context.Context, db *DB) error {
	collection, err := db.durableDungeonRoomRewards()
	if err != nil {
		return err
	}
	_, err = collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "instance_id", Value: 1}, {Key: "room_index", Value: 1}}, Options: options.Index().SetName("unique_room_reward").SetUnique(true)},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("pending_room_reward_recovery")},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "participants.username", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("pending_room_reward_account")},
	})
	return err
}

func roomRewardByID(ctx context.Context, collection *mongo.Collection, id string) (*DungeonRoomRewardRecord, error) {
	var record DungeonRoomRewardRecord
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

func (db *DB) GetDungeonRoomReward(id string) (*DungeonRoomRewardRecord, error) {
	if !validDungeonRoomRewardID(id) {
		return nil, ErrDungeonRoomRewardConflict
	}
	collection, err := db.durableDungeonRoomRewards()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return roomRewardByID(ctx, collection, id)
}

// Retain the complete first cohort/roll BEFORE any character effect. Unknown
// writes are resolved by the same ID, never a new roll, undo or compensation.
func (db *DB) PrepareDungeonRoomReward(op DungeonRoomRewardOperation) (*DungeonRoomRewardRecord, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	collection, err := db.durableDungeonRoomRewards()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	previous, err := roomRewardByID(ctx, collection, op.ID)
	if err != nil {
		return nil, err
	}
	if previous != nil {
		if previous.Fingerprint != op.Fingerprint {
			return nil, ErrDungeonRoomRewardConflict
		}
		return previous, nil
	}
	record := DungeonRoomRewardRecord{DungeonRoomRewardOperation: op, State: DungeonRoomRewardPending}
	if _, err := collection.InsertOne(ctx, record); err != nil {
		if !mongo.IsDuplicateKeyError(err) {
			return nil, err
		}
		previous, err := roomRewardByID(ctx, collection, op.ID)
		if err != nil {
			return nil, err
		}
		if previous == nil || previous.Fingerprint != op.Fingerprint {
			return nil, ErrDungeonRoomRewardConflict
		}
		return previous, nil
	}
	return &record, nil
}

// Completion proves ALL actual strongly saved recipient receipts. A full bag
// or failed save keeps the entire cohort discoverable even if another member's
// individual character/resume already contains cleared room progress.
func (db *DB) CompleteDungeonRoomReward(id, fingerprint string) (*DungeonRoomRewardRecord, error) {
	if !validDungeonRoomRewardID(id) {
		return nil, ErrDungeonRoomRewardConflict
	}
	collection, err := db.durableDungeonRoomRewards()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	record, err := roomRewardByID(ctx, collection, id)
	if err != nil {
		return nil, err
	}
	if record == nil || record.Fingerprint != fingerprint {
		return nil, ErrDungeonRoomRewardConflict
	}
	if record.State == DungeonRoomRewardComplete {
		return record, nil
	}
	for _, participant := range record.Participants {
		character, err := db.GetDirectTradeCharacter(participant.Username, participant.Username)
		if err != nil {
			return nil, err
		}
		if !DungeonRoomRewardCharacterReceiptMatches(character, record.DungeonRoomRewardOperation) {
			return nil, ErrDungeonRoomRewardUnconfirmed
		}
	}
	result, err := collection.UpdateOne(ctx, bson.M{"_id": id, "fingerprint": fingerprint, "state": DungeonRoomRewardPending},
		bson.M{"$set": bson.M{"state": DungeonRoomRewardComplete}})
	if err != nil {
		return nil, err
	}
	if result.MatchedCount != 1 {
		current, err := roomRewardByID(ctx, collection, id)
		if err != nil {
			return nil, err
		}
		if current == nil || current.State != DungeonRoomRewardComplete || current.Fingerprint != fingerprint {
			return nil, ErrDungeonRoomRewardConflict
		}
		return current, nil
	}
	record.State = DungeonRoomRewardComplete
	return record, nil
}

// A stable cursor discovers every pending cohort without an unhealthy first
// account or a full bag permanently occupying the first recovery page.
func (db *DB) PendingDungeonRoomRewards(username, afterID string, limit int) ([]DungeonRoomRewardRecord, error) {
	if (username != "" && !boundedActivityText(username, 256, true)) || (afterID != "" && !validDungeonRoomRewardID(afterID)) || limit < 1 || limit > 50 {
		return nil, ErrDungeonRoomRewardConflict
	}
	collection, err := db.durableDungeonRoomRewards()
	if err != nil {
		return nil, err
	}
	filter := bson.M{"state": DungeonRoomRewardPending}
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
	var records []DungeonRoomRewardRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	for _, record := range records {
		_, eligible := DungeonRoomRewardRecipientFor(record.DungeonRoomRewardOperation, username)
		if record.Validate() != nil || record.State != DungeonRoomRewardPending || record.ID <= afterID || (username != "" && !eligible) {
			return nil, ErrDungeonRoomRewardConflict
		}
	}
	return records, nil
}
