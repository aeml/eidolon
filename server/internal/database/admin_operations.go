package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	AdminOperationPending  = "pending"
	AdminOperationAuditing = "auditing"
	AdminOperationComplete = "complete"
	AdminGoldGrantLimit    = 100_000_000
	AdminGoldBalanceLimit  = 9_007_199_254_740_991
)

func AdminOperationID(actor, requestID string) string {
	value, _ := json.Marshal([2]string{actor, requestID})
	digest := sha256.Sum256(value)
	return "admin:" + hex.EncodeToString(digest[:])
}

func AdminOperationApplied(receipts map[string]string, id, fingerprint string) (bool, error) {
	if !adminOperationIdentity.MatchString(id) || !adminOperationFingerprint.MatchString(fingerprint) {
		return false, errors.New("invalid administration effect identity")
	}
	previous, found := receipts[id]
	if found && previous != fingerprint {
		return false, ErrAdminOperationConflict
	}
	return found, nil
}

func ValidateAdminGoldGrant(balance, amount int) error {
	if balance < 0 || amount < 1 || amount > AdminGoldGrantLimit || balance > AdminGoldBalanceLimit-amount {
		return errors.New("Gold grant would exceed the permitted amount or balance")
	}
	return nil
}

var (
	ErrAdminOperationConflict = errors.New("administration request ID was already used for a different operation")
	adminOperationIdentity    = regexp.MustCompile(`^admin:[0-9a-f]{64}$`)
	adminOperationFingerprint = regexp.MustCompile(`^[0-9a-f]{64}$`)
	adminOperationRequestID   = regexp.MustCompile(`^[A-Za-z0-9_-]{16,64}$`)
)

// Private durable intent and permanent replay receipt, NOT a history response.
// Payload is a server-built execution plan, including exact generated items.
// Never expire completed identities with the audit TTL: doing so would permit
// an old grant to pay again. Pending plans are recovered under target work locks.
// Character effects and their receipt use the existing full-snapshot journal;
// only after that commit may FinishAdminOperation publish the success audit.
type AdminOperation struct {
	Version     int           `bson:"version" json:"-"`
	ID          string        `bson:"_id" json:"-"`
	Fingerprint string        `bson:"fingerprint" json:"-"`
	Actor       string        `bson:"actor" json:"-"`
	Target      string        `bson:"target" json:"-"`
	RequestID   string        `bson:"request_id" json:"-"`
	Action      string        `bson:"action" json:"-"`
	Payload     []byte        `bson:"payload" json:"-"`
	State       string        `bson:"state" json:"-"`
	Audit       AdminActivity `bson:"audit" json:"-"`
}

func (op AdminOperation) Validate() error {
	if op.Version != 1 || !adminOperationIdentity.MatchString(op.ID) || !adminOperationFingerprint.MatchString(op.Fingerprint) ||
		!boundedActivityText(op.Actor, 256, true) || !boundedActivityText(op.Target, 256, false) || !adminOperationRequestID.MatchString(op.RequestID) || op.ID != AdminOperationID(op.Actor, op.RequestID) {
		return errors.New("invalid administration operation identity")
	}
	switch op.Action {
	case "admin_grant_gold", "admin_grant_item", "admin_teleport":
	default:
		return errors.New("invalid administration operation action")
	}
	if err := ValidateAdminActivity(op.Audit); err != nil {
		return err
	}
	if op.Audit.Actor != AdminActivityAccountKey(op.Actor) || op.Audit.Target != AdminActivityAccountKey(op.Target) || op.Audit.Action != op.Action || op.Audit.RequestID != op.RequestID {
		return errors.New("administration operation audit identity mismatch")
	}
	switch op.State {
	case AdminOperationPending:
		if op.Target == "" || op.Audit.Result != "success" || len(op.Payload) == 0 {
			return errors.New("pending administration operation lacks a validated plan")
		}
	case AdminOperationAuditing, AdminOperationComplete:
	default:
		return errors.New("invalid administration operation state")
	}
	if len(op.Payload) > 64<<10 || len(op.Payload) != 0 && !json.Valid(op.Payload) {
		return errors.New("invalid administration execution plan")
	}
	return nil
}

func (db *DB) GetAdminOperation(id string) (*AdminOperation, error) {
	if db == nil || db.adminOperations == nil || !adminOperationIdentity.MatchString(id) {
		return nil, errors.New("administration operation store unavailable or invalid identity")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var op AdminOperation
	if err := db.adminOperations.FindOne(ctx, bson.M{"_id": id}).Decode(&op); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &op, op.Validate()
}

// The first durable plan wins, including randomly generated item rolls. A lost
// insertion response is resolved by Get/retry; no effects precede this insert.
func (db *DB) PrepareAdminOperation(op AdminOperation) (*AdminOperation, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if db == nil || db.adminOperations == nil || op.State == AdminOperationComplete {
		return nil, errors.New("administration operation cannot be prepared")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.adminOperations.InsertOne(ctx, op)
	if err == nil {
		return &op, nil
	}
	if !mongo.IsDuplicateKeyError(err) {
		return nil, err
	}
	existing, err := db.GetAdminOperation(op.ID)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.Fingerprint != op.Fingerprint || existing.Actor != op.Actor || existing.Target != op.Target || existing.Action != op.Action || existing.RequestID != op.RequestID {
		return nil, ErrAdminOperationConflict
	}
	return existing, nil
}

func sameAdminAudit(a, b AdminActivity) bool {
	return a.ID == b.ID && a.At.Equal(b.At) && a.ExpiresAt.Equal(b.ExpiresAt) && a.Actor == b.Actor && a.Target == b.Target &&
		a.Action == b.Action && a.RequestID == b.RequestID && a.Result == b.Result && a.Summary == b.Summary && a.Reason == b.Reason
}

// Caller has either committed the complete character with its operation receipt,
// or established a rejection without any character mutation. First freeze the
// outcome, then append the exact audit, then acknowledge completion. Failures at
// either boundary leave an auditable recoverable row, never a silent success.
func (db *DB) FinishAdminOperation(id, fingerprint string, audit AdminActivity) (*AdminOperation, error) {
	op, err := db.GetAdminOperation(id)
	if err != nil {
		return nil, err
	}
	if op == nil || op.Fingerprint != fingerprint {
		return nil, ErrAdminOperationConflict
	}
	if err := ValidateAdminActivity(audit); err != nil {
		return nil, err
	}
	expected := op.Audit
	expected.Result, expected.Summary = audit.Result, audit.Summary
	if !sameAdminAudit(expected, audit) {
		return nil, errors.New("administration outcome changed its audit identity")
	}
	if op.State == AdminOperationPending {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, err = db.adminOperations.UpdateOne(ctx,
			bson.M{"_id": id, "fingerprint": fingerprint, "state": AdminOperationPending},
			bson.M{"$set": bson.M{"state": AdminOperationAuditing, "audit": audit}})
		cancel()
		if err != nil {
			return nil, err
		}
		op, err = db.GetAdminOperation(id)
		if err != nil {
			return nil, err
		}
	}
	if op == nil || !sameAdminAudit(op.Audit, audit) {
		return nil, errors.New("administration outcome conflicts with the recorded decision")
	}
	if op.State == AdminOperationComplete {
		return op, nil // No save or second audit insertion on a completed replay.
	}
	if err := db.AppendAdminActivity(op.Audit); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.adminOperations.UpdateOne(ctx,
		bson.M{"_id": id, "fingerprint": fingerprint, "state": AdminOperationAuditing},
		bson.M{"$set": bson.M{"state": AdminOperationComplete}, "$unset": bson.M{"payload": ""}})
	if err != nil {
		return nil, err
	}
	return db.GetAdminOperation(id)
}

func (db *DB) PendingAdminOperations(target string, limit int) ([]AdminOperation, error) {
	if db == nil || db.adminOperations == nil || limit < 1 || limit > 50 || !boundedActivityText(target, 256, false) {
		return nil, errors.New("invalid administration recovery query")
	}
	filter := bson.M{"state": bson.M{"$in": bson.A{AdminOperationPending, AdminOperationAuditing}}}
	if target != "" {
		filter["target"] = target
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := db.adminOperations.Find(ctx, filter, options.Find().SetLimit(int64(limit)).SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	result := []AdminOperation{}
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

func applyAdminOperationIndexes(ctx context.Context, db *DB) error {
	_, err := db.adminOperations.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("admin_operation_recovery")},
		{Keys: bson.D{{Key: "target", Value: 1}, {Key: "state", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("admin_operation_target_recovery")},
	})
	return err
}
