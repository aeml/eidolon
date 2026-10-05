package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgAdminPrivacyExportApproval = "admin_privacy_export_approval"

type privacyExportApprovalStore interface {
	SetPrivacyExportApproval(string, database.PrivacyExportApprovalRequest) (database.PrivacyExportApprovalReceipt, error)
}

var privacyExportApprovals privacyExportApprovalStore

func decodePrivacyExportApproval(payload []byte) (database.PrivacyExportApprovalRequest, error) {
	var request database.PrivacyExportApprovalRequest
	invalid := errors.New("invalid export approval")
	if len(payload) > 4096 || !utf8.Valid(payload) {
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return request, invalid
	}
	allowed := map[string]bool{"id": true, "reportId": true, "expectedRevision": true, "expectedReviewRevision": true, "expectedStatus": true, "enabled": true, "reason": true, "confirmed": true}
	seen := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || !allowed[key] || seen[key] {
			return request, invalid
		}
		seen[key] = true
		var raw json.RawMessage
		if decoder.Decode(&raw) != nil || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return request, invalid
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') || len(seen) != len(allowed) {
		return request, invalid
	}
	if _, err := decoder.Token(); err != io.EOF || json.Unmarshal(payload, &request) != nil || request.Validate() != nil {
		return request, invalid
	}
	return request, nil
}

func handleAdminPrivacyExportApproval(c *Client, msg Message) {
	result := adminMutationResult{Message: "Export approval is unavailable. Nothing was confirmed; refresh the case."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminPrivacyExportApproval+"_result", payload))
	}()
	request, err := decodePrivacyExportApproval(msg.Payload)
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	auditRejected := func(outcome, summary string) {
		if c.username != "" {
			auditAdminRejectedRequest(c, MsgAdminPrivacyExportApproval, adminMutationRequest{ID: result.ID}, outcome, summary)
		}
	}
	if err != nil {
		result.Message = "Invalid or unconfirmed export approval. Nothing changed."
		auditRejected("denied", result.Message)
		return
	}
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) || adminRoles == nil || adminActivities == nil {
		return
	}
	allowed, err := adminRoles.HasAdminRole(c.username)
	if err != nil {
		auditRejected("error", "Administrator role could not be verified; no export approval admitted.")
		return
	}
	result.Authorized = allowed
	if !allowed {
		result.Message = "Administrator access is not enabled for this account."
		auditRejected("denied", result.Message)
		return
	}
	var store privacyExportApprovalStore = privacyExportApprovals
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	summary := fmt.Sprintf("Export permission change requested for report %s at approval revision %d; consult the private case receipt for outcome.", request.ReportID, request.ExpectedRevision)
	event, err := database.NewAdminActivity(c.username, "", MsgAdminPrivacyExportApproval, request.ID, "success", summary, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Administration activity storage is unavailable. Export permission was not changed."
		return
	}
	if message := adminAuthorityDenial(c); message != "" {
		result.Authorized = false
		result.Message = message
		auditRejected("denied", message)
		return
	}
	receipt, err := store.SetPrivacyExportApproval(c.username, request)
	if errors.Is(err, database.ErrPrivacyExportApprovalConflict) {
		result.Final = true
		result.Message = "The case or export approval changed. Refresh before deciding again."
		return
	}
	if err != nil {
		result.Pending = true
		result.Message = "Export approval outcome could not be confirmed. Refresh or retry this exact request; do not assume access changed."
		return
	}
	result.Success, result.Final = true, true
	result.Message = fmt.Sprintf("Export permission decision recorded at revision %d. Refresh for current permission; no data was sent or removed.", receipt.Revision)
}
