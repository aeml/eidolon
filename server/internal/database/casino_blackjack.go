package database

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

var ErrBlackjackTableConflict = errors.New("blackjack table changed; refresh before acting")

// One durable document per physical blackjack table. The game-owned JSON is
// private server state. Pending transfers fence ALL subsequent table changes
// until the same account's durable Gold receipt has been confirmed.
type BlackjackTableRecord struct {
	TableID        string             `bson:"_id"`
	Version        int64              `bson:"version"`
	State          []byte             `bson:"state"`
	Pending        *BlackjackTransfer `bson:"pending,omitempty"`
	LastTransferID string             `bson:"last_transfer_id,omitempty"`
	LastAccepted   bool               `bson:"last_accepted"`
}

type BlackjackTransfer struct {
	ID        string `bson:"id"`
	PlayerID  string `bson:"player_id"`
	Currency  string `bson:"currency"`
	Amount    int    `bson:"amount"` // Negative debit, positive inclusive payout/refund.
	NextState []byte `bson:"next_state"`
}

func validBlackjackState(state []byte) bool {
	return len(state) > 0 && len(state) <= 256<<10 && json.Valid(state)
}

func (op BlackjackTransfer) Validate() error {
	if !strings.HasPrefix(op.ID, "casino:") || len(op.ID) > 240 || len(op.ID) < 12 ||
		!strings.HasPrefix(op.PlayerID, "player-") || len(op.PlayerID) <= 7 || len(op.PlayerID) > 128 ||
		op.Currency != "gold" || op.Amount == 0 || op.Amount < -500 || op.Amount > 8000 || !validBlackjackState(op.NextState) {
		return errors.New("invalid public blackjack Gold transfer")
	}
	return nil
}

func (db *DB) blackjackCollection() (*mongo.Collection, error) {
	if db == nil || db.blackjackTables == nil {
		return nil, errors.New("blackjack storage unavailable")
	}
	// The table intent must reach the database journal before a character debit.
	return db.blackjackTables.Clone(options.Collection().SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
}

func (db *DB) CreateBlackjackTable(tableID string, state []byte) (*BlackjackTableRecord, error) {
	if tableID == "" || len(tableID) > 96 || !validBlackjackState(state) {
		return nil, errors.New("invalid blackjack table")
	}
	collection, err := db.blackjackCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	record := BlackjackTableRecord{TableID: tableID, Version: 1, State: state}
	_, err = collection.InsertOne(ctx, record)
	if mongo.IsDuplicateKeyError(err) {
		return db.GetBlackjackTable(tableID)
	}
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (db *DB) GetBlackjackTable(tableID string) (*BlackjackTableRecord, error) {
	collection, err := db.blackjackCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record BlackjackTableRecord
	if err := collection.FindOne(ctx, bson.M{"_id": tableID}).Decode(&record); err != nil {
		return nil, err
	}
	if record.Version <= 0 || !validBlackjackState(record.State) {
		return nil, errors.New("corrupt blackjack table state")
	}
	if record.Pending != nil {
		if err := record.Pending.Validate(); err != nil {
			return nil, err
		}
	}
	return &record, nil
}

// A normal deal/turn update cannot cross an unresolved money operation.
func (db *DB) AdvanceBlackjackTable(tableID string, version int64, state []byte) (*BlackjackTableRecord, error) {
	if version <= 0 || !validBlackjackState(state) {
		return nil, errors.New("invalid blackjack advance")
	}
	return db.updateBlackjackTable(bson.M{"_id": tableID, "version": version, "pending": nil},
		bson.M{"$set": bson.M{"state": state}, "$inc": bson.M{"version": 1}})
}

func (db *DB) BeginBlackjackTransfer(tableID string, version int64, op BlackjackTransfer) (*BlackjackTableRecord, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if version <= 0 {
		return nil, ErrBlackjackTableConflict
	}
	record, err := db.updateBlackjackTable(bson.M{"_id": tableID, "version": version, "pending": nil},
		bson.M{"$set": bson.M{"pending": op}, "$inc": bson.M{"version": 1}})
	if err == nil {
		return record, nil
	}
	// An interrupted acknowledgement may be retried, but never with a different
	// amount, recipient or candidate under the same operation identity.
	current, readErr := db.GetBlackjackTable(tableID)
	if readErr == nil && current.Version == version+1 && current.Pending != nil {
		p := current.Pending
		if p.ID == op.ID && p.PlayerID == op.PlayerID && p.Currency == op.Currency && p.Amount == op.Amount && bytes.Equal(p.NextState, op.NextState) {
			return current, nil
		}
	}
	return nil, err
}

// accepted=false is ONLY valid after a confirmed insufficient-funds result
// with no debit receipt. Save/IO errors retain the intent for recovery.
func (db *DB) ResolveBlackjackTransfer(record BlackjackTableRecord, accepted bool) (*BlackjackTableRecord, error) {
	if record.Pending == nil {
		return nil, errors.New("no blackjack transfer to resolve")
	}
	if err := record.Pending.Validate(); err != nil {
		return nil, err
	}
	if !accepted && record.Pending.Amount > 0 {
		return nil, errors.New("earned blackjack payout cannot be discarded")
	}
	set := bson.M{"last_transfer_id": record.Pending.ID, "last_accepted": accepted}
	if accepted {
		set["state"] = record.Pending.NextState
	}
	next, err := db.updateBlackjackTable(bson.M{"_id": record.TableID, "version": record.Version, "pending.id": record.Pending.ID},
		bson.M{"$set": set, "$unset": bson.M{"pending": ""}, "$inc": bson.M{"version": 1}})
	if err == nil {
		return next, nil
	}
	current, readErr := db.GetBlackjackTable(record.TableID)
	if readErr == nil && current.Version == record.Version+1 && current.Pending == nil && current.LastTransferID == record.Pending.ID && current.LastAccepted == accepted {
		return current, nil
	}
	return nil, err
}

func (db *DB) updateBlackjackTable(filter, update bson.M) (*BlackjackTableRecord, error) {
	collection, err := db.blackjackCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var next BlackjackTableRecord
	err = collection.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&next)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrBlackjackTableConflict
	}
	if err != nil {
		return nil, err
	}
	return &next, nil
}

// The legacy-named collection is the existing private casino intent ledger.
// Slot records are owner/theme scoped. Scan on startup (not on player movement)
// so the debit-resolved / payout-not-yet-started gap is recoverable as well.
func (db *DB) CasinoSlotRecords() ([]BlackjackTableRecord, error) {
	collection, err := db.blackjackCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cursor, err := collection.Find(ctx, bson.M{"_id": bson.M{"$regex": "^slots:"}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var records []BlackjackTableRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, err
	}
	return records, nil
}
