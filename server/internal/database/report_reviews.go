package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const MaximumReportReviews = 256

var ErrReportReviewConflict = errors.New("report changed, review limit reached or request identity reused")

type ReportReviewRequest struct {
	ID               string `json:"id"`
	ReportID         string `json:"reportId"`
	ExpectedRevision int64  `json:"expectedRevision"`
	ExpectedStatus   string `json:"expectedStatus"`
	Status           string `json:"status"`
	Reason           string `json:"reason"`
	Confirmed        bool   `json:"confirmed"`
}

// The case document atomically couples its status, revision and private audit
// receipt. A lost response may replay the same request, never a second effect.
// Receipts are not included in browse responses; lastReview supplies context.
type ReportReviewReceipt struct {
	RequestID      string    `bson:"request_id" json:"requestId"`
	Fingerprint    string    `bson:"fingerprint" json:"-"`
	Actor          string    `bson:"actor" json:"actor"`
	At             time.Time `bson:"at" json:"at"`
	Revision       int64     `bson:"revision" json:"revision"`
	PreviousStatus string    `bson:"previous_status" json:"previousStatus"`
	Status         string    `bson:"status" json:"status"`
	Reason         string    `bson:"reason" json:"reason"`
}

func (r ReportReviewRequest) Validate() error {
	id, err := primitive.ObjectIDFromHex(r.ReportID)
	validStatus := func(status string) bool { return status == ReportStatusOpen || status == ReportStatusResolved }
	if err != nil || id.IsZero() || id.Hex() != r.ReportID || !adminOperationRequestID.MatchString(r.ID) ||
		!r.Confirmed || r.ExpectedRevision < 0 || r.ExpectedRevision >= MaximumReportReviews ||
		!validStatus(r.ExpectedStatus) || !validStatus(r.Status) || r.ExpectedStatus == r.Status ||
		!utf8.ValidString(r.Reason) || len([]rune(r.Reason)) > 400 || strings.TrimSpace(r.Reason) == "" ||
		!boundedActivityText(r.Reason, 1600, true) {
		return errors.New("invalid report review")
	}
	return nil
}

func (r ReportReviewRequest) identities(actor string) (string, string) {
	identity := sha256.Sum256([]byte(AdminOperationID(actor, r.ID)))
	fields, _ := json.Marshal([]interface{}{actor, r.ReportID, r.ExpectedRevision, r.ExpectedStatus, r.Status, r.Reason})
	fingerprint := sha256.Sum256(fields)
	return hex.EncodeToString(identity[:]), hex.EncodeToString(fingerprint[:])
}

func (r ReportReviewReceipt) matches(actor string, request ReportReviewRequest) bool {
	_, fingerprint := request.identities(actor)
	return r.RequestID == request.ID && r.Fingerprint == fingerprint &&
		r.Actor == AdminActivityAccountKey(actor) && !r.At.IsZero() &&
		r.Revision == request.ExpectedRevision+1 && r.PreviousStatus == request.ExpectedStatus &&
		r.Status == request.Status && r.Reason == request.Reason
}

func PrepareReportReview(report Report, actor string, request ReportReviewRequest, now time.Time) (ReportReviewReceipt, bool, error) {
	if err := request.Validate(); err != nil || actor == "" || now.IsZero() || report.ID.Hex() != request.ReportID {
		return ReportReviewReceipt{}, false, errors.New("invalid report review")
	}
	id, fingerprint := request.identities(actor)
	if receipt, found := report.ReviewReceipts[id]; found {
		if !receipt.matches(actor, request) {
			return ReportReviewReceipt{}, false, ErrReportReviewConflict
		}
		return receipt, true, nil
	}
	if report.ReviewRevision != request.ExpectedRevision || report.Status != request.ExpectedStatus ||
		len(report.ReviewReceipts) >= MaximumReportReviews {
		return ReportReviewReceipt{}, false, ErrReportReviewConflict
	}
	return ReportReviewReceipt{RequestID: request.ID, Fingerprint: fingerprint,
		Actor: AdminActivityAccountKey(actor), At: now.UTC().Truncate(time.Millisecond),
		Revision: request.ExpectedRevision + 1, PreviousStatus: request.ExpectedStatus,
		Status: request.Status, Reason: request.Reason}, false, nil
}

func reportReviewFilter(request ReportReviewRequest, identity string) bson.M {
	id, _ := primitive.ObjectIDFromHex(request.ReportID)
	filter := bson.M{"_id": id, "status": request.ExpectedStatus, "review_receipts." + identity: bson.M{"$exists": false}}
	if request.ExpectedRevision == 0 {
		filter["$or"] = bson.A{bson.M{"review_revision": 0}, bson.M{"review_revision": bson.M{"$exists": false}}}
	} else {
		filter["review_revision"] = request.ExpectedRevision
	}
	return filter
}

func (db *DB) ReviewReport(actor string, request ReportReviewRequest) (ReportReviewReceipt, error) {
	if err := request.Validate(); err != nil {
		return ReportReviewReceipt{}, err
	}
	if db == nil || db.reports == nil || actor == "" {
		return ReportReviewReceipt{}, errors.New("report store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	id, _ := primitive.ObjectIDFromHex(request.ReportID)
	var report Report
	if err := db.reports.FindOne(ctx, bson.M{"_id": id}).Decode(&report); err != nil {
		return ReportReviewReceipt{}, err
	}
	receipt, replay, err := PrepareReportReview(report, actor, request, time.Now())
	if err != nil || replay {
		return receipt, err
	}
	identity, _ := request.identities(actor)
	set := bson.M{"status": receipt.Status, "last_review": receipt, "review_receipts." + identity: receipt}
	update := bson.M{"$set": set, "$inc": bson.M{"review_revision": 1}}
	if receipt.Status == ReportStatusResolved {
		set["resolved_at"] = receipt.At
	} else {
		update["$unset"] = bson.M{"resolved_at": ""}
	}
	err = db.reports.FindOneAndUpdate(ctx, reportReviewFilter(request, identity), update,
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&report)
	if err == nil {
		if saved, found := report.ReviewReceipts[identity]; found && saved.matches(actor, request) {
			return saved, nil
		}
		return ReportReviewReceipt{}, errors.New("report review receipt unavailable")
	}
	if errors.Is(err, mongo.ErrNoDocuments) {
		// A concurrent identical retry can win the same CAS. Only its exact
		// durable receipt qualifies; another actor/revision remains a conflict.
		if readErr := db.reports.FindOne(ctx, bson.M{"_id": id}).Decode(&report); readErr == nil {
			if saved, found := report.ReviewReceipts[identity]; found && saved.matches(actor, request) {
				return saved, nil
			}
		}
		return ReportReviewReceipt{}, ErrReportReviewConflict
	}
	return ReportReviewReceipt{}, err
}
