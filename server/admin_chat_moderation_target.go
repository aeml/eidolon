package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"time"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

// Preview is independently authenticated and audited before any confirmation.
const MsgAdminChatModerationTarget = "admin_chat_moderation_target"

type adminChatModerationTargetStore interface {
	ReadChatModerationTarget(string, string) (database.ChatModerationTarget, error)
}

var adminChatModerationTargets adminChatModerationTargetStore

func decodeAdminChatModerationTarget(payload []byte) (adminMutationRequest, error) {
	var request adminMutationRequest
	invalid := errors.New("invalid moderation target request")
	if len(payload) > 3072 || !utf8.Valid(payload) {
		return request, invalid
	}
	d := json.NewDecoder(bytes.NewReader(payload))
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
		text, ok := value.(string)
		if err != nil || !ok {
			return request, invalid
		}
		switch key {
		case "id":
			request.ID = text
		case "target":
			request.Target = text
		default:
			return request, invalid
		}
	}
	if token, err := d.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err := d.Token(); err != io.EOF || len(seen) != 2 || !adminRequestID.MatchString(request.ID) || !validAdminText(request.Target, 256) {
		return request, invalid
	}
	return request, nil
}

// Normal dispatch holds the actor's character-work lock throughout.
func handleAdminChatModerationTarget(c *Client, msg Message) {
	if c == nil {
		return
	}
	result := struct {
		ID         string                         `json:"id"`
		Success    bool                           `json:"success"`
		Authorized bool                           `json:"authorized"`
		Message    string                         `json:"message"`
		Target     *database.ChatModerationTarget `json:"target,omitempty"`
	}{Message: "Moderation target preview is unavailable. No account details were returned."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminChatModerationTarget+"_result", payload))
	}()
	request, err := decodeAdminChatModerationTarget(msg.Payload)
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	actor := c.username
	current := func() bool {
		return actor != "" && c.username == actor && !c.transportClosed.Load() && currentCharacterConnection(c)
	}
	if err != nil {
		if current() {
			auditAdminRejectedRequest(c, MsgAdminChatModerationTarget, adminMutationRequest{ID: result.ID}, "denied", "Invalid moderation target preview request.")
		}
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
		if current() {
			auditAdminRejectedRequest(c, MsgAdminChatModerationTarget, adminMutationRequest{ID: result.ID}, "denied", "Administrator access was not verified; no target preview returned.")
		}
		return
	}
	var store adminChatModerationTargetStore = adminChatModerationTargets
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	target, err := store.ReadChatModerationTarget(actor, request.Target)
	if !current() || !authorize() {
		result.Authorized = false
		return
	}
	if err != nil || !target.Valid() || target.Account != request.Target {
		return
	}
	event, err := database.NewAdminActivity(actor, target.AccountID.Hex(), MsgAdminChatModerationTarget, request.ID, "success",
		"Moderation target preview requested; no credentials, saves or private receipts included.", time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		return
	}
	if !current() || !authorize() {
		result.Authorized = false
		return
	}
	result.Success, result.Target = true, &target
	result.Message = "Check this exact account, current notice and revision before deciding. The report author is not automatically the subject."
}
