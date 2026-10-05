package database

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func privacyApprovalFixture() (Report, PrivacyExportApprovalRequest) {
	id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234567")
	return Report{ID: id, Username: "owner", ReportType: "Account Data Export", Status: "open"}, PrivacyExportApprovalRequest{
		ID: "export-approval-000001", ReportID: id.Hex(), ExpectedStatus: "open", Enabled: true, Confirmed: true, Reason: "Owner and requested scope reviewed",
	}
}

func TestPrivacyExportApprovalReversibleBoundedAndReplaySafe(t *testing.T) {
	report, request := privacyApprovalFixture()
	report.ExportApprovalReceipts = map[string]PrivacyExportApprovalReceipt{}
	first, _, err := PreparePrivacyExportApproval(report, "staff", request, time.Now())
	if err != nil || !first.Enabled || first.Revision != 1 {
		t.Fatal(err)
	}
	identity, _ := request.identities("staff")
	report.ExportApprovalReceipts[identity] = first
	report.ExportApproval = &first
	revoke := request
	revoke.ID = "export-revoke-000002"
	revoke.ExpectedRevision = 1
	revoke.Enabled = false
	second, _, err := PreparePrivacyExportApproval(report, "staff", revoke, time.Now())
	if err != nil || second.Enabled || second.Revision != 2 {
		t.Fatal("approval not reversible", err)
	}
	identity, _ = revoke.identities("staff")
	report.ExportApprovalReceipts[identity] = second
	report.ExportApproval = &second
	old, replay, err := PreparePrivacyExportApproval(report, "staff", request, time.Now().Add(time.Hour))
	if err != nil || !replay || !reflect.DeepEqual(old, first) || report.ExportApproval.Enabled {
		t.Fatal("old approval retry reinstated revoked access", err)
	}
	changed := request
	changed.Reason = "Changed reason"
	if _, _, err := PreparePrivacyExportApproval(report, "staff", changed, time.Now()); !errors.Is(err, ErrPrivacyExportApprovalConflict) {
		t.Fatal("nonce reused for a changed decision")
	}
	for next := int64(2); next < MaximumPrivacyExportChanges; next++ {
		request.ID = fmt.Sprintf("export-change-%06d", next)
		request.ExpectedRevision = next
		request.Enabled = next%2 == 0
		receipt, replay, err := PreparePrivacyExportApproval(report, "staff", request, time.Now())
		if err != nil || replay {
			t.Fatal("valid toggle denied", next, err)
		}
		identity, _ := request.identities("staff")
		report.ExportApprovalReceipts[identity] = receipt
		report.ExportApproval = &receipt
	}
	if report.ExportApproval.Enabled || report.ExportApproval.Revision != 256 || len(report.ExportApprovalReceipts) != 256 {
		t.Fatal("receipt exhaustion stranded enabled approval")
	}
	request.ID = "export-change-exhausted"
	request.ExpectedRevision = 256
	request.Enabled = true
	if _, _, err := PreparePrivacyExportApproval(report, "staff", request, time.Now()); err == nil {
		t.Fatal("unbounded approval receipts admitted")
	}
	encoded, _ := json.Marshal(report)
	if strings.Contains(string(encoded), "exportApprovalReceipts") || strings.Contains(string(encoded), "fingerprint") {
		t.Fatal("private replay map leaked to queue JSON")
	}
}

func TestPrivacyExportApprovalRequiresExactCaseAndIndependentQuote(t *testing.T) {
	for _, mutate := range []func(*Report, *PrivacyExportApprovalRequest){
		func(r *Report, q *PrivacyExportApprovalRequest) { r.ReportType = "Account Removal Request" },
		func(r *Report, q *PrivacyExportApprovalRequest) { r.Status = "resolved" },
		func(r *Report, q *PrivacyExportApprovalRequest) { r.ReviewRevision = 1 },
		func(r *Report, q *PrivacyExportApprovalRequest) { q.Confirmed = false },
		func(r *Report, q *PrivacyExportApprovalRequest) { q.Enabled = false },
		func(r *Report, q *PrivacyExportApprovalRequest) { q.Reason = "" },
		func(r *Report, q *PrivacyExportApprovalRequest) { q.Reason = "bad\nreason" },
		func(r *Report, q *PrivacyExportApprovalRequest) {
			r.ExportApproval = &PrivacyExportApprovalReceipt{Enabled: false, Revision: 1}
			q.ExpectedRevision = 1
		},
	} {
		report, request := privacyApprovalFixture()
		mutate(&report, &request)
		if _, _, err := PreparePrivacyExportApproval(report, "staff", request, time.Now()); err == nil {
			t.Fatal("invalid/stale case or quote admitted")
		}
	}
	report, request := privacyApprovalFixture()
	review := ReportReviewRequest{ID: "ordinary-case-review-01", ReportID: report.ID.Hex(), ExpectedStatus: "open", Status: "resolved", Reason: "Review finished, not approval", Confirmed: true}
	if _, _, err := PrepareReportReview(report, "staff", review, time.Now()); err != nil || report.ExportApproval != nil {
		t.Fatal("ordinary review supplied approval", err)
	}
	report.ReviewRevision = 256
	request.ExpectedReviewRevision = 256
	if _, _, err := PreparePrivacyExportApproval(report, "staff", request, time.Now()); err != nil {
		t.Fatal("case review exhaustion blocked independent approval", err)
	}
}
