package database

import (
	"strings"
	"testing"
	"time"
)

func TestPrivacyRequestsOnlyCreateValidatedOpenCases(t *testing.T) {
	for _, category := range []string{"Account Data Export", "Account Removal Request"} {
		if !SupportedReportType(category) || !AccountSupportReportType(category) {
			t.Fatal("privacy request not available in authenticated support", category)
		}
		report, err := NewReport("owner", category, "Please review my account request", time.Now())
		if err != nil || report.Status != ReportStatusOpen || report.ResolvedAt != nil || report.LastReview != nil || report.ReviewRevision != 0 {
			t.Fatal("request implied a review or fulfillment", err)
		}
		for _, body := range []string{"", strings.Repeat("x", maximumReportLength+1)} {
			if _, err := NewReport("owner", category, body, time.Now()); err == nil {
				t.Fatal("privacy request bypassed existing text limits", category)
			}
		}
		if _, err := NewReport("", category, "Details", time.Now()); err == nil {
			t.Fatal("privacy request lacked an authenticated owner")
		}
	}
	for _, category := range []string{"Bug Report", "Player Report", "Feature Request", "account data export", "Account Removal Request ", "Delete Account"} {
		if AccountSupportReportType(category) {
			t.Fatal("unsupported outside-world type accepted", category)
		}
	}
}
