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

type ownAccountModerationNoticeStore interface {
	OwnModerationNotices(string) ([]database.ChatMuteNotice, error)
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
		RequestID string                    `json:"requestId"`
		Success   bool                      `json:"success"`
		Notice    *database.ChatMuteNotice  `json:"notice,omitempty"`
		Notices   []database.ChatMuteNotice `json:"notices"`
		Message   string                    `json:"message"`
	}{Message: "Your moderation notices are unavailable. Reconnect and try again."}
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
	var notices []database.ChatMuteNotice
	if accountStore, ok := store.(ownAccountModerationNoticeStore); ok {
		notices, err = accountStore.OwnModerationNotices(owner)
	} else {
		// Preserve the isolated mute fixtures while the complete account store
		// serves all three restriction types. Production DB implements both.
		var notice *database.ChatMuteNotice
		notice, err = store.OwnChatMuteNotice(owner)
		if notice != nil {
			notices = append(notices, *notice)
		}
	}
	if err != nil || len(notices) > 3 {
		return
	}
	seen := make(map[string]bool)
	for _, notice := range notices {
		kind := notice.Kind
		if kind == "" {
			kind = database.ChatModerationMute
		}
		if !notice.Valid() || seen[kind] {
			return
		}
		seen[kind] = true
	}
	// A replacement session may arrive during the database read. Do not send
	// the previous owner's notice through retired character/session controls.
	if c.username != owner || c.transportClosed.Load() || !currentCharacterConnection(c) {
		return
	}
	now := time.Now()
	result.Notices = []database.ChatMuteNotice{}
	for _, notice := range notices {
		if !notice.Active(now) {
			continue
		}
		result.Notices = append(result.Notices, notice)
		if notice.Kind == "" || notice.Kind == database.ChatModerationMute {
			copy := notice
			result.Notice = &copy
		}
	}
	result.Success = true
	result.Message = "No active moderation notices for this account."
	if len(result.Notices) != 0 {
		result.Message = "Your active moderation notices. An appeal requests review; it does not automatically reverse a decision."
	}
}
