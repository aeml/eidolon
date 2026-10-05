package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const MaximumPrivacyExportChanges = 256

var ErrPrivacyExportApprovalConflict = errors.New("export approval changed or request identity conflicts")

type PrivacyExportApprovalRequest struct {
	ID                     string `json:"id"`
	ReportID               string `json:"reportId"`
	ExpectedRevision       int64  `json:"expectedRevision"`
	ExpectedReviewRevision int64  `json:"expectedReviewRevision"`
	ExpectedStatus         string `json:"expectedStatus"`
	Enabled                bool   `json:"enabled"`
	Reason                 string `json:"reason"`
	Confirmed              bool   `json:"confirmed"`
}

// Case-local metadata, not an export artifact or removal authority. Revoke
// fences future admissions; it cannot recall data already delivered.
type PrivacyExportApprovalReceipt struct {
	RequestID      string    `bson:"request_id" json:"requestId"`
	Fingerprint    string    `bson:"fingerprint" json:"-"`
	Actor          string    `bson:"actor" json:"actor"`
	At             time.Time `bson:"at" json:"at"`
	Revision       int64     `bson:"revision" json:"revision"`
	ReviewRevision int64     `bson:"review_revision" json:"reviewRevision"`
	CaseStatus     string    `bson:"case_status" json:"caseStatus"`
	Enabled        bool      `bson:"enabled" json:"enabled"`
	Reason         string    `bson:"reason" json:"reason"`
}

func (r PrivacyExportApprovalRequest) Validate() error {
	id, err := primitive.ObjectIDFromHex(r.ReportID)
	if err != nil || id.IsZero() || id.Hex() != r.ReportID || !adminOperationRequestID.MatchString(r.ID) || !r.Confirmed ||
		r.ExpectedRevision < 0 || r.ExpectedRevision >= MaximumPrivacyExportChanges || r.ExpectedReviewRevision < 0 || r.ExpectedReviewRevision > MaximumReportReviews ||
		(r.ExpectedStatus != ReportStatusOpen && r.ExpectedStatus != ReportStatusResolved) || strings.TrimSpace(r.Reason) == "" ||
		len([]rune(r.Reason)) > 400 || !boundedActivityText(r.Reason, 1600, true) {
		return errors.New("invalid export approval request")
	}
	return nil
}

func (r PrivacyExportApprovalRequest) identities(actor string) (string, string) {
	id := sha256.Sum256([]byte(AdminOperationID(actor, r.ID)))
	fields, _ := json.Marshal([]interface{}{actor, r.ReportID, r.ExpectedRevision, r.ExpectedReviewRevision, r.ExpectedStatus, r.Enabled, r.Reason})
	fingerprint := sha256.Sum256(fields)
	return hex.EncodeToString(id[:]), hex.EncodeToString(fingerprint[:])
}

func (receipt PrivacyExportApprovalReceipt) matches(actor string, request PrivacyExportApprovalRequest) bool {
	_, fingerprint := request.identities(actor)
	return receipt.RequestID == request.ID && receipt.Fingerprint == fingerprint && receipt.Actor == AdminActivityAccountKey(actor) &&
		!receipt.At.IsZero() && receipt.Revision == request.ExpectedRevision+1 && receipt.ReviewRevision == request.ExpectedReviewRevision &&
		receipt.CaseStatus == request.ExpectedStatus && receipt.Enabled == request.Enabled && receipt.Reason == request.Reason
}

func PreparePrivacyExportApproval(report Report, actor string, request PrivacyExportApprovalRequest, at time.Time) (PrivacyExportApprovalReceipt, bool, error) {
	if request.Validate() != nil || actor == "" || at.IsZero() || report.ID.Hex() != request.ReportID || report.ReportType != "Account Data Export" {
		return PrivacyExportApprovalReceipt{}, false, ErrPrivacyExportApprovalConflict
	}
	identity, fingerprint := request.identities(actor)
	if saved, exists := report.ExportApprovalReceipts[identity]; exists {
		if !saved.matches(actor, request) {
			return PrivacyExportApprovalReceipt{}, false, ErrPrivacyExportApprovalConflict
		}
		return saved, true, nil
	}
	var revision int64
	enabled := false
	if report.ExportApproval != nil {
		revision = report.ExportApproval.Revision
		enabled = report.ExportApproval.Enabled
	}
	// Starting disabled and toggling only ensures revision256 ends disabled;
	// receipt exhaustion cannot leave an approval that cannot be revoked.
	if revision != request.ExpectedRevision || enabled != (revision%2 == 1) || enabled == request.Enabled ||
		report.ReviewRevision != request.ExpectedReviewRevision || report.Status != request.ExpectedStatus || len(report.ExportApprovalReceipts) >= MaximumPrivacyExportChanges {
		return PrivacyExportApprovalReceipt{}, false, ErrPrivacyExportApprovalConflict
	}
	return PrivacyExportApprovalReceipt{RequestID: request.ID, Fingerprint: fingerprint, Actor: AdminActivityAccountKey(actor),
		At: at.UTC().Truncate(time.Millisecond), Revision: revision + 1, ReviewRevision: report.ReviewRevision, CaseStatus: report.Status, Enabled: request.Enabled, Reason: request.Reason}, false, nil
}

func approvalRevisionFence(field string, revision int64) bson.M {
	if revision == 0 {
		return bson.M{"$or": bson.A{bson.M{field: 0}, bson.M{field: bson.M{"$exists": false}}}}
	}
	return bson.M{field: revision}
}

// Caller must verify durable staff authority and log admission immediately
// before this operation. CAS couples permission and receipt; ordinary case
// review never creates export approval.
func (db *DB) SetPrivacyExportApproval(actor string, request PrivacyExportApprovalRequest) (PrivacyExportApprovalReceipt, error) {
	if request.Validate() != nil || db == nil || db.reports == nil || actor == "" {
		return PrivacyExportApprovalReceipt{}, ErrPrivacyExportApprovalConflict
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	id, _ := primitive.ObjectIDFromHex(request.ReportID)
	var report Report
	if err := db.reports.FindOne(ctx, bson.M{"_id": id, "report_type": "Account Data Export"}).Decode(&report); err != nil {
		return PrivacyExportApprovalReceipt{}, err
	}
	receipt, replay, err := PreparePrivacyExportApproval(report, actor, request, time.Now())
	if err != nil || replay {
		return receipt, err
	}
	identity, _ := request.identities(actor)
	filter := bson.M{"_id": id, "report_type": "Account Data Export", "status": request.ExpectedStatus, "export_approval_receipts." + identity: bson.M{"$exists": false},
		"$and": bson.A{approvalRevisionFence("export_approval.revision", request.ExpectedRevision), approvalRevisionFence("review_revision", request.ExpectedReviewRevision)}}
	update := bson.M{"$set": bson.M{"export_approval": receipt, "export_approval_receipts." + identity: receipt}}
	err = db.reports.FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&report)
	if err == nil {
		if saved, exists := report.ExportApprovalReceipts[identity]; exists && saved.matches(actor, request) {
			return saved, nil
		}
		return PrivacyExportApprovalReceipt{}, errors.New("export approval receipt unavailable")
	}
	if errors.Is(err, mongo.ErrNoDocuments) {
		if readErr := db.reports.FindOne(ctx, bson.M{"_id": id}).Decode(&report); readErr == nil {
			if saved, exists := report.ExportApprovalReceipts[identity]; exists && saved.matches(actor, request) {
				return saved, nil
			}
		}
		return PrivacyExportApprovalReceipt{}, ErrPrivacyExportApprovalConflict
	}
	return PrivacyExportApprovalReceipt{}, err
}
