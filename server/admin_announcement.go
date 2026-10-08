package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgAdminAnnouncement = "admin_announcement"

type adminAnnouncementRequest struct {
	ID, Kind, Message, NextUpdateAt string
	Confirmed                       bool
}

// Closed schema: no supplied actor, audience, markup, role or automatic action.
func decodeAdminAnnouncement(payload []byte, now time.Time) (adminAnnouncementRequest, error) {
	var request adminAnnouncementRequest
	invalid := errors.New("invalid announcement")
	if len(payload) > 1024 || !utf8.Valid(payload) {
		return request, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
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
		case "kind":
			request.Kind = text
		case "message":
			request.Message = text
		case "nextUpdateAt":
			request.NextUpdateAt = text
		default:
			return request, invalid
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return request, invalid
	}
	if _, err := decoder.Token(); err != io.EOF || len(seen) != 5 || !request.Confirmed || !adminRequestID.MatchString(request.ID) {
		return request, invalid
	}
	if request.Kind != "maintenance" && request.Kind != "incident" && request.Kind != "recovery" {
		return request, invalid
	}
	if request.Message != strings.TrimSpace(request.Message) || request.Message == "" || len(request.Message) > 220 {
		return request, invalid
	}
	for _, r := range request.Message {
		if unicode.IsControl(r) {
			return request, invalid
		}
	}
	if request.NextUpdateAt == "" && request.Kind == "recovery" {
		return request, nil
	}
	if len(request.NextUpdateAt) > 30 || !strings.HasSuffix(request.NextUpdateAt, "Z") {
		return request, invalid
	}
	deadline, err := time.Parse(time.RFC3339Nano, request.NextUpdateAt)
	if err != nil || !deadline.After(now) || deadline.After(now.Add(24*time.Hour)) {
		return request, invalid
	}
	request.NextUpdateAt = deadline.UTC().Format(time.RFC3339Nano)
	return request, nil
}

func handleAdminAnnouncement(c *Client, msg Message) {
	result := adminMutationResult{Message: "Announcement unavailable. No notice was queued."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminAnnouncement+"_result", payload))
	}()
	request, err := decodeAdminAnnouncement(msg.Payload, time.Now())
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	reject := func(outcome, summary string) {
		if c.username != "" {
			auditAdminRejectedRequest(c, MsgAdminAnnouncement, adminMutationRequest{ID: result.ID}, outcome, summary)
		}
	}
	if err != nil {
		result.Message = "Invalid or unconfirmed notice. Use plain text and a future UTC update time within 24 hours. No notice was queued."
		reject("denied", result.Message)
		return
	}
	if c.username == "" || adminActivities == nil {
		return
	}
	if denial := adminAuthorityDenial(c); denial != "" {
		result.Message = denial
		reject("denied", "Announcement authority could not be confirmed; no notice queued.")
		return
	}
	result.Authorized = true
	// Persist exact public copy and timing under the existing retention policy.
	// This is admission, not a claim that any socket received the announcement.
	event, err := database.NewAdminActivity(c.username, "", MsgAdminAnnouncement, request.ID, "success",
		"Announcement requested: "+request.Message, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	event.Reason = "Kind: " + request.Kind + "; next update UTC: " + request.NextUpdateAt + "; admission only"
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Administration activity storage is unavailable. No notice was queued."
		return
	}
	if denial := adminAuthorityDenial(c); denial != "" {
		result.Authorized = false
		result.Message = denial
		reject("denied", "Authority changed after announcement admission; no notice queued.")
		return
	}
	text := "[" + strings.ToUpper(request.Kind[:1]) + request.Kind[1:] + "] " + request.Message
	if request.NextUpdateAt != "" {
		text += " Next update: " + request.NextUpdateAt + " (UTC)."
	}
	payload, _ := json.Marshal(struct {
		Sender  string `json:"sender"`
		Channel string `json:"channel"`
		Message string `json:"message"`
	}{"System", "server", text})
	if !enqueueTransientBroadcast(BroadcastMessage{Type: MsgChat, Data: createMessage(MsgChat, payload)}) {
		result.Message = "Notice could not be queued. History records admission only; no delivery was acknowledged."
		reject("error", "Announcement queue unavailable; no delivery acknowledged.")
		return
	}
	result.Success, result.Final = true, true
	result.Message = "Notice queued for connected players in every area. Check server chat; delivery to every player is not guaranteed."
}
