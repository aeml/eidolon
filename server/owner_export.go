package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"time"
	"unicode/utf8"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const MsgOwnerExportSection = "owner_export_section"
const maximumOwnerSectionBytes = 512 << 10

type ownerExportPayload struct {
	RequestID        string `json:"requestId"`
	ReportID         string `json:"reportId"`
	ApprovalRevision int64  `json:"approvalRevision"`
	CurrentPassword  string `json:"currentPassword"`
	Section          string `json:"section"`
	CharacterName    string `json:"characterName"`
	Before           string `json:"before,omitempty"`
}
type ownerExportStore interface {
	ReadApprovedOwnerExportQuery(context.Context, string, string, string, int64, database.OwnerExportQuery, time.Time, int) ([]byte, error)
}

var ownerExports ownerExportStore

func decodeOwnerExport(payload []byte) (ownerExportPayload, error) {
	var request ownerExportPayload
	invalid := errors.New("invalid owner export request")
	if len(payload) > 2048 || !utf8.Valid(payload) {
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return request, invalid
	}
	allowed := map[string]bool{"requestId": true, "reportId": true, "approvalRevision": true, "currentPassword": true, "section": true, "characterName": true}
	required := len(allowed)
	allowed["before"] = true
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
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') || len(seen) < required {
		return request, invalid
	}
	for key := range allowed {
		if key != "before" && !seen[key] {
			return request, invalid
		}
	}
	if _, err := decoder.Token(); err != io.EOF || json.Unmarshal(payload, &request) != nil {
		return request, invalid
	}
	id, idErr := primitive.ObjectIDFromHex(request.ReportID)
	if idErr != nil || id.IsZero() || id.Hex() != request.ReportID {
		return request, invalid
	}
	if !reportRequestIDPattern.MatchString(request.RequestID) || len(request.ReportID) != 24 || request.ApprovalRevision < 1 || request.ApprovalRevision >= 256 || request.ApprovalRevision%2 != 1 ||
		len(request.CurrentPassword) < 1 || len(request.CurrentPassword) > 72 || (request.Section != "profile" && request.Section != "progress" && request.Section != "reports" && request.Section != "sessions" && request.Section != "social" && request.Section != "market") ||
		(request.Section == "profile" && request.CharacterName != "") || (request.Section == "progress" && (request.CharacterName == "" || len(request.CharacterName) > 128)) {
		return request, invalid
	}
	if (request.Section == "profile" || request.Section == "progress") && request.Before != "" || request.Section != "profile" && request.Section != "progress" && request.CharacterName != "" {
		return request, invalid
	}
	if request.Before != "" {
		cursor, err := primitive.ObjectIDFromHex(request.Before)
		if err != nil || cursor.IsZero() || cursor.Hex() != request.Before {
			return request, invalid
		}
	}
	return request, nil
}

func sendOwnerExportResult(c *Client, id string, data []byte) {
	// Do not include passwords, case notes, database details or unbounded data.
	result := struct {
		RequestID string          `json:"requestId"`
		Success   bool            `json:"success"`
		Data      json.RawMessage `json:"data,omitempty"`
		Message   string          `json:"message"`
	}{RequestID: id, Message: "Section unavailable. Recheck your own approved request and current password; larger or missing data needs operator review."}
	var marker struct {
		Format  string `json:"format"`
		Version int    `json:"version"`
	}
	if len(data) > 0 && len(data) <= maximumOwnerSectionBytes && json.Unmarshal(data, &marker) == nil && marker.Version == 1 && (marker.Format == "eidolon-owner-account-profile" || marker.Format == "eidolon-owner-progression" || marker.Format == "eidolon-owner-report-submissions" || marker.Format == "eidolon-owner-session-history" || marker.Format == "eidolon-owner-social-relationships" || marker.Format == "eidolon-owner-marketplace-summary") {
		result.Success = true
		result.Data = data
		result.Message = "Section ready. This is not a complete account export or a restore image."
	}
	payload, _ := json.Marshal(result)
	c.sendSafe(createMessage(MsgOwnerExportSection+"_result", payload))
}

func handleOwnerExport(c *Client, msg Message) {
	request, err := decodeOwnerExport(msg.Payload)
	if err != nil {
		if reportRequestIDPattern.MatchString(request.RequestID) {
			sendOwnerExportResult(c, request.RequestID, nil)
		} else {
			c.sendError("Invalid export request.")
		}
		return
	}
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	done, err := credentialAdmission.begin(MsgOwnerExportSection, c.username, time.Now())
	if err != nil {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	defer done()
	var store ownerExportStore = ownerExports
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	if adminActivities == nil {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	event, err := database.NewAdminActivity(c.username, "", MsgOwnerExportSection, request.RequestID, "success", "Owner export section read requested for this account; no delivery outcome or contents recorded.", time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	if c.transportClosed.Load() || !currentCharacterConnection(c) {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	data, err := store.ReadApprovedOwnerExportQuery(ctx, c.username, request.CurrentPassword, request.ReportID, request.ApprovalRevision, database.OwnerExportQuery{Section: request.Section, CharacterName: request.CharacterName, Before: request.Before}, time.Now(), maximumOwnerSectionBytes)
	request.CurrentPassword = ""
	// The socket may have been replaced while approval/password/source IO ran.
	if err != nil || ctx.Err() != nil || c.transportClosed.Load() || !currentCharacterConnection(c) {
		sendOwnerExportResult(c, request.RequestID, nil)
		return
	}
	sendOwnerExportResult(c, request.RequestID, data)
}
