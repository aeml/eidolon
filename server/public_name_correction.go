package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgPublicNameCorrection = "public_name_correction"

type publicNameCorrectionStore interface {
	CorrectPublicName(string, database.PublicNameCorrectionRequest) (database.ChatModerationReceipt, error)
}

var publicNameCorrections publicNameCorrectionStore

func decodePublicNameCorrection(payload []byte) (database.PublicNameCorrectionRequest, error) {
	var request database.PublicNameCorrectionRequest
	invalid := errors.New("invalid public name correction")
	if len(payload) > 1024 || !utf8.Valid(payload) {
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
		if err != nil {
			return request, invalid
		}
		if key == "confirmed" {
			if value != true {
				return request, invalid
			}
			request.Confirmed = true
			continue
		}
		text, ok := value.(string)
		if !ok {
			return request, invalid
		}
		switch key {
		case "id":
			request.ID = text
		case "noticeId":
			request.NoticeID = text
		case "publicName":
			request.PublicName = text
		default:
			return request, invalid
		}
	}
	if token, err := d.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err := d.Token(); err != io.EOF || len(seen) != 4 {
		return request, invalid
	}
	return request, request.Validate()
}

// The ordinary dispatcher holds this authenticated account's character-work
// lock. No actor/account/save identity is taken from the player's payload.
func handlePublicNameCorrection(c *Client, msg Message) {
	if c == nil {
		return
	}
	result := struct {
		ID      string `json:"id"`
		Success bool   `json:"success"`
		Final   bool   `json:"final"`
		Pending bool   `json:"pending"`
		Message string `json:"message"`
	}{
		Message: "Public name correction is unavailable. Nothing was acknowledged."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgPublicNameCorrection+"_result", payload))
	}()
	request, err := decodePublicNameCorrection(msg.Payload)
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	owner := c.username
	current := func() bool {
		return owner != "" && c.username == owner && !c.transportClosed.Load() && currentCharacterConnection(c)
	}
	if err != nil {
		result.Final = true
		result.Message = "Enter a different 3–24 character public name starting with a letter, then confirm. Letters, numbers, spaces, apostrophes, hyphens and underscores are allowed."
		return
	}
	if !current() {
		return
	}
	store := publicNameCorrections
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	_, err = store.CorrectPublicName(owner, request)
	if !current() {
		return
	}
	if errors.Is(err, database.ErrPublicNameUnavailable) {
		result.Final = true
		result.Message = "That public name is unavailable or unchanged. Choose another and confirm again."
		return
	}
	if errors.Is(err, database.ErrChatModerationConflict) {
		result.Final = true
		result.Message = "The required-name-change notice changed. Check your notices before correcting it again."
		return
	}
	if err != nil {
		result.Pending = true
		result.Message = "The correction could not be confirmed. Check your notices or retry the exact confirmed request; do not assume it changed."
		return
	}
	result.Success, result.Final = true, true
	result.Message = "Your confirmed name correction was recorded. Login and saved progress are unchanged. Check your notices; other restrictions are not cleared."
}
