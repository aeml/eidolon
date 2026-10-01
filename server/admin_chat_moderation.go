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
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Prepared, deliberately absent from the protocol registry and admission map.
// Activate only with the approved sanction policy, target preview and action UI.
const MsgAdminChatModeration = "admin_chat_moderation"

type adminChatModerationStore interface {
	ApplyChatModeration(string, primitive.ObjectID, database.ChatModerationRequest) (database.ChatModerationReceipt, error)
}

var adminChatModerations adminChatModerationStore

type adminChatModerationRequest struct {
	AccountID primitive.ObjectID
	Change    database.ChatModerationRequest
}

func decodeAdminChatModeration(payload []byte) (adminChatModerationRequest, error) {
	var request adminChatModerationRequest
	invalid := errors.New("invalid chat moderation request")
	if len(payload) > 12288 || !utf8.Valid(payload) {
		return request, invalid
	}
	d := json.NewDecoder(bytes.NewReader(payload))
	d.UseNumber()
	if token, err := d.Token(); err != nil || token != json.Delim('{') {
		return request, invalid
	}
	seen := map[string]bool{}
	for d.More() {
		token, err := d.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return request, invalid
		}
		seen[key] = true
		value, err := d.Token()
		if err != nil {
			return request, invalid
		}
		switch key {
		case "confirmed":
			if value != true {
				return request, invalid
			}
			request.Change.Confirmed = true
		case "expectedRevision", "durationSeconds":
			number, ok := value.(json.Number)
			if !ok {
				return request, invalid
			}
			n, err := strconv.ParseInt(string(number), 10, 64)
			if err != nil {
				return request, invalid
			}
			if key == "expectedRevision" {
				request.Change.ExpectedRevision = n
			} else {
				request.Change.DurationSeconds = n
			}
		case "id", "accountId", "reportId", "action", "noticeId", "publicReason", "privateReason":
			text, ok := value.(string)
			if !ok {
				return request, invalid
			}
			switch key {
			case "id":
				request.Change.ID = text
			case "accountId":
				id, err := primitive.ObjectIDFromHex(text)
				if err != nil || id.IsZero() || id.Hex() != text {
					return request, invalid
				}
				request.AccountID = id
			case "reportId":
				request.Change.ReportID = text
			case "action":
				request.Change.Action = text
			case "noticeId":
				request.Change.NoticeID = text
			case "publicReason":
				request.Change.PublicReason = text
			case "privateReason":
				request.Change.PrivateReason = text
			}
		default:
			return request, invalid
		}
	}
	if token, err := d.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err := d.Token(); err != io.EOF || len(seen) != 10 {
		return request, invalid
	}
	return request, request.Change.Validate()
}

// The future dispatcher must hold the authenticated actor's character-work
// lock, as for report review. Do not call from an unfenced background worker.
func handleAdminChatModeration(c *Client, msg Message) {
	result := adminMutationResult{Message: "Chat moderation is unavailable. Nothing was acknowledged."}
	if c == nil {
		return
	}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminChatModeration+"_result", payload))
	}()
	request, err := decodeAdminChatModeration(msg.Payload)
	if adminRequestID.MatchString(request.Change.ID) {
		result.ID = request.Change.ID
	}
	actor := c.username
	current := func() bool {
		return actor != "" && c.username == actor && !c.transportClosed.Load() && currentCharacterConnection(c)
	}
	rejected := func(outcome, summary string) {
		if current() {
			auditAdminRejectedRequest(c, MsgAdminChatModeration, adminMutationRequest{ID: result.ID}, outcome, summary)
		}
	}
	if err != nil {
		result.Message = "Invalid or unconfirmed chat moderation request. Nothing changed."
		rejected("denied", result.Message)
		return
	}
	if !current() || adminRoles == nil || adminActivities == nil {
		return
	}
	authorize := func() bool {
		allowed, err := adminRoles.HasAdminRole(actor)
		result.Authorized = err == nil && allowed && current()
		return result.Authorized
	}
	if !authorize() {
		rejected("denied", "Administrator access was not verified; no chat moderation admitted.")
		return
	}
	var store adminChatModerationStore = adminChatModerations
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	// Admission is not a final sanction. The authoritative account write stores
	// its state and private receipt atomically; history retains no allegations.
	summary := fmt.Sprintf("Chat moderation requested for account %s, case %s, revision %d; consult the private account receipt for the outcome.",
		request.AccountID.Hex(), request.Change.ReportID, request.Change.ExpectedRevision)
	event, err := database.NewAdminActivity(actor, request.AccountID.Hex(), MsgAdminChatModeration, request.Change.ID,
		"success", summary, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Administration activity storage is unavailable. No chat moderation was applied."
		return
	}
	if !current() || !authorize() {
		result.Authorized = false
		return
	}
	receipt, err := store.ApplyChatModeration(actor, request.AccountID, request.Change)
	if errors.Is(err, database.ErrChatModerationConflict) {
		result.Final = true
		result.Message = "Chat moderation changed or the request conflicts with an earlier decision. Refresh before deciding again."
		return
	}
	if err != nil {
		result.Pending = true
		result.Message = "The outcome could not be confirmed. Check the account or retry this exact request; do not assume a mute or reversal succeeded."
		return
	}
	result.Success, result.Final = true, true
	result.Message = fmt.Sprintf("Chat moderation recorded at revision %d. Refresh the account to check its current notice; the case was not automatically resolved.", receipt.Revision)
}
