package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgAdminReportReview = "admin_report_review"

type adminReportReviewStore interface {
	ReviewReport(string, database.ReportReviewRequest) (database.ReportReviewReceipt, error)
}

var adminReportReviews adminReportReviewStore

func decodeAdminReportReview(payload []byte) (database.ReportReviewRequest, error) {
	var request database.ReportReviewRequest
	invalid := errors.New("invalid report review")
	if len(payload) > 4096 || !utf8.Valid(payload) {
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return request, invalid
	}
	seen := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return request, invalid
		}
		seen[key] = true
		value, err := decoder.Token()
		if err != nil {
			return request, invalid
		}
		switch key {
		case "confirmed":
			if value != true {
				return request, invalid
			}
			request.Confirmed = true
		case "expectedRevision":
			number, ok := value.(json.Number)
			if !ok {
				return request, invalid
			}
			request.ExpectedRevision, err = strconv.ParseInt(string(number), 10, 64)
			if err != nil {
				return request, invalid
			}
		case "id", "reportId", "expectedStatus", "status", "reason":
			text, ok := value.(string)
			if !ok {
				return request, invalid
			}
			switch key {
			case "id":
				request.ID = text
			case "reportId":
				request.ReportID = text
			case "expectedStatus":
				request.ExpectedStatus = text
			case "status":
				request.Status = text
			case "reason":
				request.Reason = text
			}
		default:
			return request, invalid
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err := decoder.Token(); err != io.EOF || len(seen) != 7 {
		return request, invalid
	}
	return request, request.Validate()
}

func handleAdminReportReview(c *Client, msg Message) {
	result := adminMutationResult{Message: "Report review is unavailable. Nothing was acknowledged; refresh before trying again."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminReportReview+"_result", payload))
	}()
	request, err := decodeAdminReportReview(msg.Payload)
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	// Rejected attempts retain only their validated correlation ID and a fixed
	// description. Allegations and private review reasons stay on the case.
	auditRejected := func(outcome, summary string) {
		if c.username != "" && !c.transportClosed.Load() && currentCharacterConnection(c) {
			auditAdminRejectedRequest(c, MsgAdminReportReview, adminMutationRequest{ID: result.ID}, outcome, summary)
		}
	}
	if err != nil {
		result.Message = "Invalid or unconfirmed report review. Nothing changed."
		auditRejected("denied", result.Message)
		return
	}
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) || adminRoles == nil || adminActivities == nil {
		return
	}
	allowed, err := adminRoles.HasAdminRole(c.username)
	if err != nil {
		auditRejected("error", "Administrator role could not be verified; no report review admitted.")
		return
	}
	result.Authorized = allowed
	if !allowed {
		result.Message = "Administrator access is not enabled for this account."
		auditRejected("denied", result.Message)
		return
	}
	var store adminReportReviewStore = adminReportReviews
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	// This history entry explicitly records admission, NOT final resolution.
	// Actual status and its private actor/reason/time receipt commit together
	// on the report document. Never copy a report body or staff note to history.
	summary := fmt.Sprintf("Review requested for report %s at revision %d; consult the case receipt for its outcome.", request.ReportID, request.ExpectedRevision)
	event, err := database.NewAdminActivity(c.username, "", MsgAdminReportReview, request.ID, "success", summary,
		time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Administration activity storage is unavailable. The report was not changed."
		return
	}
	receipt, err := store.ReviewReport(c.username, request)
	if errors.Is(err, database.ErrReportReviewConflict) {
		result.Final = true
		result.Message = "The report changed or this request conflicts with an earlier review. Refresh reports before deciding again."
		return
	}
	if err != nil {
		result.Pending = true
		result.Message = "Review outcome could not be confirmed. Refresh the case or retry this exact request; do not assume it was resolved."
		return
	}
	result.Success, result.Final = true, true
	result.Message = fmt.Sprintf("Report review recorded at revision %d. Refresh to see the current case; no player sanction was applied.", receipt.Revision)
}
