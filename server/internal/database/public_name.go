package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const ModerationCorrectName = "correct_name"

var publicNamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9 _'-]{2,23}$`)
var ErrPublicNameUnavailable = errors.New("public name unavailable or unchanged")

// The authenticated owner supplies neither an account ID nor staff authority.
// Only a quoted required-name-change notice can authorize this correction.
type PublicNameCorrectionRequest struct {
	ID         string `json:"id"`
	NoticeID   string `json:"noticeId"`
	PublicName string `json:"publicName"`
	Confirmed  bool   `json:"confirmed"`
}

func (r PublicNameCorrectionRequest) Validate() error {
	if !adminOperationRequestID.MatchString(r.ID) || !validChatNoticeID(r.NoticeID) ||
		!r.Confirmed || !publicNamePattern.MatchString(r.PublicName) || strings.TrimSpace(r.PublicName) != r.PublicName {
		return errors.New("invalid confirmed public name correction")
	}
	return nil
}

func (r PublicNameCorrectionRequest) identities(owner string, accountID primitive.ObjectID) (string, string) {
	identity, _ := json.Marshal([]string{"public-name-correction", owner, accountID.Hex(), r.ID})
	hash := sha256.Sum256(identity)
	fields, _ := json.Marshal([]string{owner, accountID.Hex(), r.ID, r.NoticeID, r.PublicName})
	fingerprint := sha256.Sum256(fields)
	return hex.EncodeToString(hash[:]), hex.EncodeToString(fingerprint[:])
}

func (r PublicNameCorrectionRequest) matches(receipt ChatModerationReceipt, owner string, accountID primitive.ObjectID) bool {
	_, fingerprint := r.identities(owner, accountID)
	return receipt.RequestID == r.ID && receipt.Fingerprint == fingerprint && receipt.Actor == AdminActivityAccountKey(owner) &&
		receipt.Action == ModerationCorrectName && receipt.PublicName == r.PublicName && receipt.Notice.ID == r.NoticeID &&
		receipt.Notice.StartedAt.IsZero() && receipt.Notice.ExpiresAt.IsZero() && receipt.Notice.Reason == "" &&
		!receipt.At.IsZero() && receipt.At.Equal(receipt.At.UTC().Truncate(time.Millisecond)) && receipt.Revision > 0 &&
		receipt.Revision <= MaximumChatModerationReceipts && receipt.ReportID == "" && receipt.PrivateReason == ""
}

// Use the same bounded account receipt ledger. Correction consumes the slot
// already reserved for withdrawing this notice and cannot erase other notices.
func PreparePublicNameCorrection(state AccountChatModeration, owner string, accountID primitive.ObjectID,
	request PublicNameCorrectionRequest, now time.Time) (AccountChatModeration, ChatModerationReceipt, bool, error) {
	if request.Validate() != nil || owner == "" || accountID.IsZero() || now.IsZero() {
		return state, ChatModerationReceipt{}, false, errors.New("invalid public name correction")
	}
	if err := state.validate(); err != nil {
		return state, ChatModerationReceipt{}, false, err
	}
	identity, fingerprint := request.identities(owner, accountID)
	if receipt, found := state.Receipts[identity]; found {
		if !request.matches(receipt, owner, accountID) {
			return state, ChatModerationReceipt{}, false, ErrChatModerationConflict
		}
		return state, receipt, true, nil
	}
	if state.NameChange == nil || state.NameChange.ID != request.NoticeID || !state.NameChange.Active(now) ||
		state.Revision >= MaximumChatModerationReceipts {
		return state, ChatModerationReceipt{}, false, ErrChatModerationConflict
	}
	receipt := ChatModerationReceipt{RequestID: request.ID, Fingerprint: fingerprint, Actor: AdminActivityAccountKey(owner),
		At: now.UTC().Truncate(time.Millisecond), Revision: state.Revision + 1, Action: ModerationCorrectName,
		Notice: ChatMuteNotice{ID: request.NoticeID}, PublicName: request.PublicName}
	next := state
	next.NameChange = nil
	next.Revision = receipt.Revision
	next.Receipts = make(map[string]ChatModerationReceipt, len(state.Receipts)+1)
	for key, value := range state.Receipts {
		next.Receipts[key] = value
	}
	next.Receipts[identity] = receipt
	if err := next.validate(); err != nil {
		return state, ChatModerationReceipt{}, false, err
	}
	return next, receipt, false, nil
}

func applyPublicNameIndex(ctx context.Context, db *DB) error {
	_, err := db.users.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "public_name_key", Value: 1}},
		Options: options.Index().SetName("public_name_key_unique").SetUnique(true).
			SetPartialFilterExpression(bson.M{"public_name_key": bson.M{"$type": "string"}})})
	return err
}

// Public label only. Legacy accounts retain their existing label; neither this
// read nor the migration rewrites authentication, character or ownership keys.
func (db *DB) OwnPublicName(owner string) (string, error) {
	if db == nil || db.users == nil || owner == "" {
		return "", errors.New("public name unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record struct {
		Username   string `bson:"username"`
		PublicName string `bson:"public_name"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": owner}, options.FindOne().SetProjection(bson.M{"username": 1, "public_name": 1})).Decode(&record); err != nil {
		return "", err
	}
	if record.PublicName != "" {
		return record.PublicName, nil
	}
	return record.Username, nil
}

// One CAS changes the label and resolves its quoted restriction, with the
// private receipt. Ambiguous writes are not success; identical manual retries
// recover the durable receipt without reinstating, renaming or clearing anew.
func (db *DB) CorrectPublicName(owner string, request PublicNameCorrectionRequest) (ChatModerationReceipt, error) {
	if db == nil || db.users == nil || owner == "" || request.Validate() != nil {
		return ChatModerationReceipt{}, errors.New("public name correction unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record struct {
		ID         primitive.ObjectID    `bson:"_id"`
		PublicName string                `bson:"public_name"`
		State      AccountChatModeration `bson:"chat_moderation"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": owner}, options.FindOne().SetProjection(bson.M{"public_name": 1, "chat_moderation": 1})).Decode(&record); err != nil {
		return ChatModerationReceipt{}, err
	}
	next, receipt, replay, err := PreparePublicNameCorrection(record.State, owner, record.ID, request, time.Now())
	if err != nil || replay {
		return receipt, err
	}
	previous := record.PublicName
	if previous == "" {
		previous = owner
	}
	if strings.EqualFold(previous, request.PublicName) {
		return ChatModerationReceipt{}, ErrPublicNameUnavailable
	}
	// Older accounts have no alias reservation. Their login names remain
	// reserved forever; new schema17 registrations also reserve aliases through
	// the unique index, closing registration/correction races without a backfill.
	count, err := db.users.CountDocuments(ctx, bson.M{"_id": bson.M{"$ne": record.ID},
		"username": primitive.Regex{Pattern: "^" + regexp.QuoteMeta(request.PublicName) + "$", Options: "i"}}, options.Count().SetLimit(1))
	if err != nil {
		return ChatModerationReceipt{}, err
	}
	if count != 0 {
		return ChatModerationReceipt{}, ErrPublicNameUnavailable
	}
	result, err := db.users.UpdateOne(ctx, chatModerationFilter(record.ID, record.State.Revision), bson.M{"$set": bson.M{
		"public_name": request.PublicName, "public_name_key": strings.ToLower(request.PublicName), "chat_moderation": next}})
	if mongo.IsDuplicateKeyError(err) {
		return ChatModerationReceipt{}, ErrPublicNameUnavailable
	}
	if err != nil {
		return ChatModerationReceipt{}, err
	}
	if result.MatchedCount == 1 {
		return receipt, nil
	}
	current, err := db.readAccountChatModeration(ctx, record.ID)
	if err != nil {
		return ChatModerationReceipt{}, err
	}
	identity, _ := request.identities(owner, record.ID)
	if saved, exists := current.Receipts[identity]; exists && request.matches(saved, owner, record.ID) {
		return saved, nil
	}
	return ChatModerationReceipt{}, ErrChatModerationConflict
}
