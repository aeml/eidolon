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

type ownChatMuteNoticeStore interface {
	OwnChatMuteNotice(string) (*database.ChatMuteNotice, error)
}

var moderationNotices ownChatMuteNoticeStore

// A single correlation ID: no target, account override, notice lookup or staff
// privileges. Duplicate fields, trailing JSON and non-string IDs are rejected.
func decodeModerationNoticeRequest(payload []byte) (string, error) {
	invalid := errors.New("invalid moderation notice request")
	if len(payload) > 256 || !utf8.Valid(payload) {
		return "", invalid
	}
	d := json.NewDecoder(bytes.NewReader(payload))
	if token, err := d.Token(); err != nil || token != json.Delim('{') {
		return "", invalid
	}
	if token, err := d.Token(); err != nil || token != "requestId" {
		return "", invalid
	}
	value, err := d.Token()
	id, ok := value.(string)
	if err != nil || !ok || !reportRequestIDPattern.MatchString(id) {
		return "", invalid
	}
	if token, err := d.Token(); err != nil || token != json.Delim('}') {
		return id, invalid
	}
	if _, err := d.Token(); err != io.EOF {
		return id, invalid
	}
	return id, nil
}

func handleOwnModerationNotice(c *Client, msg Message) {
	result := struct {
		RequestID string                   `json:"requestId"`
		Success   bool                     `json:"success"`
		Notice    *database.ChatMuteNotice `json:"notice,omitempty"`
		Message   string                   `json:"message"`
	}{Message: "Your chat-mute notice is unavailable. Reconnect and try again."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgModerationNotice+"_result", payload))
	}()
	requestID, err := decodeModerationNoticeRequest(msg.Payload)
	if reportRequestIDPattern.MatchString(requestID) {
		result.RequestID = requestID
	}
	if err != nil || c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		return
	}
	var store ownChatMuteNoticeStore = moderationNotices
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	owner := c.username
	notice, err := store.OwnChatMuteNotice(owner)
	if err != nil || (notice != nil && !notice.Valid()) {
		return
	}
	// A replacement session may arrive during the database read. Do not send
	// the previous owner's notice through retired character/session controls.
	if c.username != owner || c.transportClosed.Load() || !currentCharacterConnection(c) {
		return
	}
	now := time.Now()
	if notice != nil && (now.Before(notice.StartedAt) || !now.Before(notice.ExpiresAt)) {
		notice = nil
	}
	result.Success, result.Notice = true, notice
	result.Message = "No active temporary chat-mute notice for this account."
	if notice != nil {
		result.Message = "Your active chat-mute notice. An appeal requests review; it does not automatically reverse a decision."
	}
}
