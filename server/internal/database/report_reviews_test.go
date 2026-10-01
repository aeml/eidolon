package database

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func reportReviewFixture() (Report, ReportReviewRequest) {
	id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234567")
	return Report{ID: id, Status: ReportStatusOpen}, ReportReviewRequest{
		ID: "review-request-000001", ReportID: id.Hex(), ExpectedStatus: ReportStatusOpen,
		Status: ReportStatusResolved, Reason: "Reviewed the supplied evidence.", Confirmed: true,
	}
}

func TestReportReviewPreparationReplayAndStaleDecision(t *testing.T) {
	report, request := reportReviewFixture()
	now := time.Date(2026, 10, 1, 12, 0, 0, 123456789, time.UTC)
	receipt, replay, err := PrepareReportReview(report, "operator", request, now)
	if err != nil || replay || receipt.Revision != 1 || receipt.Actor != AdminActivityAccountKey("operator") ||
		!receipt.At.Equal(now.Truncate(time.Millisecond)) || receipt.Status != ReportStatusResolved {
		t.Fatal(receipt, replay, err)
	}
	id, _ := request.identities("operator")
	report.ReviewReceipts = map[string]ReportReviewReceipt{id: receipt}
	report.ReviewRevision, report.Status = 2, ReportStatusOpen // Later reopen does not erase the original outcome.
	saved, replay, err := PrepareReportReview(report, "operator", request, now.Add(time.Hour))
	if err != nil || !replay || !reflect.DeepEqual(saved, receipt) {
		t.Fatal("exact retry must return original receipt", saved, replay, err)
	}
	changed := request
	changed.Reason = "Different decision"
	if _, _, err := PrepareReportReview(report, "operator", changed, now); !errors.Is(err, ErrReportReviewConflict) {
		t.Fatal("nonce reuse accepted", err)
	}
	if _, _, err := PrepareReportReview(report, "other-admin", request, now); !errors.Is(err, ErrReportReviewConflict) {
		t.Fatal("another actor overwrote stale case", err)
	}
	report, request = reportReviewFixture()
	report.Status = ReportStatusResolved // A legacy CLI resolution must also invalidate the open quote.
	if _, _, err := PrepareReportReview(report, "operator", request, now); !errors.Is(err, ErrReportReviewConflict) {
		t.Fatal("legacy status change ignored", err)
	}
}

func TestReportReviewRejectsCorruptReceipts(t *testing.T) {
	report, request := reportReviewFixture()
	receipt, _, _ := PrepareReportReview(report, "operator", request, time.Now())
	id, _ := request.identities("operator")
	for name, corrupt := range map[string]func(*ReportReviewReceipt){
		"id":          func(r *ReportReviewReceipt) { r.RequestID = "different-request" },
		"actor":       func(r *ReportReviewReceipt) { r.Actor = "other" },
		"time":        func(r *ReportReviewReceipt) { r.At = time.Time{} },
		"revision":    func(r *ReportReviewReceipt) { r.Revision++ },
		"previous":    func(r *ReportReviewReceipt) { r.PreviousStatus = "resolved" },
		"status":      func(r *ReportReviewReceipt) { r.Status = "open" },
		"reason":      func(r *ReportReviewReceipt) { r.Reason = "other" },
		"fingerprint": func(r *ReportReviewReceipt) { r.Fingerprint = "other" },
	} {
		t.Run(name, func(t *testing.T) {
			bad := receipt
			corrupt(&bad)
			report.ReviewReceipts = map[string]ReportReviewReceipt{id: bad}
			if _, _, err := PrepareReportReview(report, "operator", request, time.Now()); !errors.Is(err, ErrReportReviewConflict) {
				t.Fatal("corrupt receipt acknowledged", err)
			}
		})
	}
}

func TestReportReviewInputAndReceiptBounds(t *testing.T) {
	_, valid := reportReviewFixture()
	for name, change := range map[string]func(*ReportReviewRequest){
		"zero case":      func(r *ReportReviewRequest) { r.ReportID = strings.Repeat("0", 24) },
		"uppercase case": func(r *ReportReviewRequest) { r.ReportID = strings.ToUpper(r.ReportID) },
		"nonce":          func(r *ReportReviewRequest) { r.ID = "short" },
		"unconfirmed":    func(r *ReportReviewRequest) { r.Confirmed = false },
		"negative":       func(r *ReportReviewRequest) { r.ExpectedRevision = -1 },
		"limit":          func(r *ReportReviewRequest) { r.ExpectedRevision = MaximumReportReviews },
		"status":         func(r *ReportReviewRequest) { r.Status = "deleted" },
		"no change":      func(r *ReportReviewRequest) { r.Status = r.ExpectedStatus },
		"empty":          func(r *ReportReviewRequest) { r.Reason = " \t " },
		"too long":       func(r *ReportReviewRequest) { r.Reason = strings.Repeat("界", 401) },
		"control":        func(r *ReportReviewRequest) { r.Reason = "reason\nprivate" },
		"invalid UTF8":   func(r *ReportReviewRequest) { r.Reason = string([]byte{255}) },
	} {
		t.Run(name, func(t *testing.T) {
			request := valid
			change(&request)
			if request.Validate() == nil {
				t.Fatal("invalid request accepted")
			}
		})
	}
	valid.Reason = strings.Repeat("界", 400)
	if err := valid.Validate(); err != nil {
		t.Fatal("bounded Unicode rejected", err)
	}
	report, request := reportReviewFixture()
	report.ReviewReceipts = make(map[string]ReportReviewReceipt)
	for i := 0; i < MaximumReportReviews; i++ {
		report.ReviewReceipts[primitive.NewObjectID().Hex()] = ReportReviewReceipt{}
	}
	if _, _, err := PrepareReportReview(report, "operator", request, time.Now()); !errors.Is(err, ErrReportReviewConflict) {
		t.Fatal("unbounded audit receipts", err)
	}
}

func TestReportReviewCASAndPrivateJSON(t *testing.T) {
	report, request := reportReviewFixture()
	id, _ := request.identities("operator")
	filter := reportReviewFilter(request, id)
	if filter["_id"] != report.ID || filter["status"] != "open" || len(filter["$or"].(bson.A)) != 2 ||
		!reflect.DeepEqual(filter["review_receipts."+id], bson.M{"$exists": false}) {
		t.Fatal("missing legacy CAS boundary", filter)
	}
	request.ExpectedRevision = 5
	filter = reportReviewFilter(request, id)
	if filter["review_revision"] != int64(5) || filter["$or"] != nil {
		t.Fatal(filter)
	}
	request.ExpectedRevision = 0
	receipt, _, _ := PrepareReportReview(report, "operator", request, time.Now())
	report.LastReview = &receipt
	report.ReviewReceipts = map[string]ReportReviewReceipt{id: receipt}
	encoded, err := json.Marshal(report)
	if err != nil || strings.Contains(string(encoded), id) || strings.Contains(string(encoded), receipt.Fingerprint) ||
		!strings.Contains(string(encoded), "lastReview") {
		t.Fatal("private receipts exposed", string(encoded), err)
	}
}
