package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgAdminRemovalReview = "admin_removal_review"

type adminRemovalReviewStore interface {
	ReadRemovalReview(database.RemovalReviewQuery) (database.RemovalReviewSnapshot, error)
}

var adminRemovalReviews adminRemovalReviewStore

type adminRemovalReviewRequest struct {
	ID string `json:"id"`
	database.RemovalReviewQuery
}

func decodeAdminRemovalReview(payload []byte) (adminRemovalReviewRequest, error) {
	var request adminRemovalReviewRequest
	invalid := errors.New("invalid removal review")
	if len(payload) > 1024 || !utf8.Valid(payload) {
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return request, invalid
	}
	allowed := map[string]bool{"id": true, "reportId": true, "expectedRevision": true, "expectedStatus": true}
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
	if _, err := decoder.Token(); err != io.EOF || json.Unmarshal(payload, &request) != nil || !adminRequestID.MatchString(request.ID) || request.RemovalReviewQuery.Validate() != nil {
		return request, invalid
	}
	return request, nil
}

func handleAdminRemovalReview(c *Client, msg Message) {
	result := adminReadResult{Message: "Removal dependency review unavailable. Refresh the case; nothing was removed."}
	defer func() {
		result = auditAdminReadResult(c, MsgAdminRemovalReview, result)
		if result.Success && result.Authorized {
			if message := adminAuthorityDenial(c); message != "" {
				result = auditAdminReadResult(c, MsgAdminRemovalReview, adminReadResult{ID: result.ID, Message: message})
			}
		}
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminRemovalReview+"_result", payload))
	}()
	request, err := decodeAdminRemovalReview(msg.Payload)
	if err != nil {
		result.Message = "Invalid removal dependency review. Nothing was removed."
		return
	}
	result.ID = request.ID
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) || adminRoles == nil || adminActivities == nil {
		return
	}
	allowed, err := adminRoles.HasAdminRole(c.username)
	if err != nil {
		return
	}
	result.Authorized = allowed
	if !allowed {
		result.Message = "Administrator access is not enabled for this account."
		return
	}
	var store adminRemovalReviewStore = adminRemovalReviews
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	snapshot, err := store.ReadRemovalReview(request.RemovalReviewQuery)
	if err != nil || snapshot.Owner == "" || snapshot.ReportID != request.ReportID || snapshot.ReviewRevision != request.ExpectedRevision || snapshot.CaseStatus != request.ExpectedStatus || snapshot.RemovalSupported || snapshot.RemovalAuthorized {
		return
	}
	if characterSaveJournal != nil {
		pending, err := characterSaveJournal.HasPendingAccountSave(snapshot.Owner)
		if err != nil {
			return
		}
		snapshot.PendingCharacterSave = &pending
	}
	sessionsMu.Lock()
	online := activeSessions[snapshot.Owner] != nil
	sessionsMu.Unlock()
	snapshot.OnlineObserved = &online
	result.Success, result.Removal = true, &snapshot
	result.Message = "Read-only removal dependencies observed. References are not unresolved counts; absence is not removal approval. No deletion or writer drain occurred."
}
