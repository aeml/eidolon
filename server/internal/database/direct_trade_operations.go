package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

var ErrDirectTradeBusy = errors.New("a previous direct trade is still being recovered")

func (db *DB) directTradeCollection() (*mongo.Collection, error) {
	if db == nil || db.directTradeOperations == nil {
		return nil, errors.New("direct trade decision storage unavailable")
	}
	// Do not inherit a secondary read preference or an unacknowledged URI write
	// concern. A shared decision must be journaled before any participant effect.
	return db.directTradeOperations.Clone(options.Collection().
		SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()).
		SetWriteConcern(writeconcern.New(writeconcern.WMajority(), writeconcern.J(true))))
}

func applyDirectTradeOperationIndexes(ctx context.Context, db *DB) error {
	collection, err := db.directTradeCollection()
	if err != nil {
		return err
	}
	_, err = collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		// One multikey index reserves BOTH accounts in the same atomic insert.
		// Distinct participants are also required by operation validation.
		{Keys: bson.D{{Key: "participants.username", Value: 1}}, Options: options.Index().
			SetName("one_pending_direct_trade_per_account").SetUnique(true).
			SetPartialFilterExpression(bson.M{"state": DirectTradePending})},
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}},
			Options: options.Index().SetName("direct_trade_recovery")},
	})
	return err
}

func (db *DB) GetDirectTradeOperation(id string) (*DirectTradeOperation, error) {
	if !directTradeOperationIDPattern.MatchString(id) {
		return nil, errors.New("invalid direct trade decision lookup")
	}
	collection, err := db.directTradeCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var op DirectTradeOperation
	err = collection.FindOne(ctx, bson.M{"_id": id}).Decode(&op)
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

// No economic effect may precede a confirmed immutable decision. An unknown
// insert result must be reconciled using this SAME ID; do not compensate with
// cancellation or construct another trade ID. Terminal IDs are never deleted.
func (db *DB) PrepareDirectTradeOperation(op DirectTradeOperation) (*DirectTradeOperation, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if op.State != DirectTradePending {
		return nil, ErrDirectTradeConflict
	}
	collection, err := db.directTradeCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = collection.InsertOne(ctx, op)
	if err == nil {
		return &op, nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return nil, err // Unknown outcome stays unknown until a same-ID read.
	}
	stored, err := db.GetDirectTradeOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if stored == nil {
		return nil, ErrDirectTradeBusy
	}
	if stored.Fingerprint != op.Fingerprint {
		return nil, ErrDirectTradeConflict
	}
	return stored, nil // Keep the first decision, timestamp and terminal outcome.
}

func directTradeParticipantReceipt(character *Character, participant DirectTradeParticipant, op DirectTradeOperation) error {
	if character == nil || character.Name != participant.CharacterName {
		return ErrDirectTradeConflict
	}
	state, err := DecodeDirectTradeState(character.DirectTradeState)
	if err != nil {
		return err
	}
	if state.Escrow != nil || state.LastOperationID != op.ID || state.LastOperationFingerprint != op.Fingerprint ||
		state.LastOperationRevision != participant.ExpectedRevision+1 || state.Revision < state.LastOperationRevision {
		return ErrDirectTradeConflict
	}
	want := participant.OfferPayload
	if op.Decision == DirectTradeSettle {
		for _, peer := range op.Participants {
			if peer.Username != participant.Username {
				want = peer.OfferPayload
			}
		}
	}
	if state.Delivery != nil {
		if state.Delivery.OfferPayload != want {
			return ErrDirectTradeConflict
		}
	} else {
		offer, err := parseDirectTradeOffer(want)
		if err != nil || ((offer.Gold != 0 || len(offer.Items) != 0) && state.Revision == state.LastOperationRevision) {
			return ErrDirectTradeConflict // Nonempty custody vanished without a claim revision.
		}
	}
	return nil
}

func DirectTradeCharacterReceiptMatches(username string, character *Character, op DirectTradeOperation) bool {
	if op.Validate() != nil {
		return false
	}
	for _, participant := range op.Participants {
		if participant.Username == username {
			return directTradeParticipantReceipt(character, participant, op) == nil
		}
	}
	return false
}

// Recovery must read the primary's durable character, not a possibly stale URI
// secondary preference. No character is a legitimate result for a new account;
// malformed lookup/storage remains an error rather than guessed empty custody.
func (db *DB) GetDirectTradeCharacter(username, characterName string) (*Character, error) {
	if db == nil || db.users == nil || !boundedActivityText(username, 256, true) || !boundedActivityText(characterName, 256, true) {
		return nil, errors.New("direct trade participant storage unavailable")
	}
	users, err := db.users.Clone(options.Collection().SetReadPreference(readpref.Primary()).SetReadConcern(readconcern.Majority()))
	if err != nil {
		return nil, err
	}
	character, err := newMongoCharacterRepository(users).LoadCharacter(username, characterName)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return character, err
}

// Caller owns BOTH sorted account work locks through completion and fences any
// newer operation/save. Read the actual durable characters, never caller-owned
// snapshots or boolean "saved" flags. Delivery can already be claimed: its
// retained receipt is sufficient; unclaimed delivery still belongs to its owner.
func (db *DB) CompleteDirectTradeOperation(id, fingerprint string) (*DirectTradeOperation, error) {
	op, err := db.GetDirectTradeOperation(id)
	if err != nil {
		return nil, err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return nil, ErrDirectTradeConflict
	}
	if op.State == DirectTradeComplete {
		return op, nil
	}
	for _, participant := range op.Participants {
		character, err := db.GetDirectTradeCharacter(participant.Username, participant.CharacterName)
		if err != nil {
			return nil, err
		}
		if err := directTradeParticipantReceipt(character, participant, *op); err != nil {
			return nil, err
		}
	}
	collection, err := db.directTradeCollection()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = collection.UpdateOne(ctx,
		bson.M{"_id": id, "fingerprint": fingerprint, "state": DirectTradePending},
		bson.M{"$set": bson.M{"state": DirectTradeComplete}})
	if err != nil {
		return nil, err // Lost completion ACK is resolved by re-reading this ID.
	}
	stored, err := db.GetDirectTradeOperation(id)
	if err != nil {
		return nil, err
	}
	if stored == nil || stored.Fingerprint != fingerprint || stored.State != DirectTradeComplete {
		return nil, ErrDirectTradeConflict
	}
	return stored, nil
}

func (db *DB) PendingDirectTradeOperations(username string, limit int) ([]DirectTradeOperation, error) {
	if limit < 1 || limit > 50 || !boundedActivityText(username, 256, false) {
		return nil, errors.New("invalid direct trade recovery query")
	}
	collection, err := db.directTradeCollection()
	if err != nil {
		return nil, err
	}
	filter := bson.M{"state": DirectTradePending}
	if username != "" {
		filter["participants.username"] = username
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := collection.Find(ctx, filter, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	result := []DirectTradeOperation{}
	if err := cursor.All(ctx, &result); err != nil {
		return nil, err
	}
	for _, op := range result {
		if err := op.Validate(); err != nil {
			return nil, err
		}
		if op.State != DirectTradePending || (username != "" && op.Participants[0].Username != username && op.Participants[1].Username != username) {
			return nil, ErrDirectTradeConflict
		}
	}
	return result, nil
}
