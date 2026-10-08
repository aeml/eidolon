package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"eidolon-server/internal/database"
)

const MsgAdminBetaInvitation = "admin_beta_invitation"

type betaInvitationRequest struct {
	ID, Username, Email, ExpiresAt string
	Confirmed                      bool
}

type betaInvitationResult struct {
	adminMutationResult
	Code      string `json:"code,omitempty"`
	Username  string `json:"username,omitempty"`
	ExpiresAt string `json:"expiresAt,omitempty"`
}

func decodeBetaInvitationRequest(payload []byte, now time.Time) (betaInvitationRequest, time.Time, error) {
	var request betaInvitationRequest
	invalid := errors.New("invalid invitation request")
	if len(payload) > 2048 || !utf8.Valid(payload) {
		return request, time.Time{}, invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return request, time.Time{}, invalid
	}
	seen := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return request, time.Time{}, invalid
		}
		seen[key] = true
		value, err := decoder.Token()
		if err != nil {
			return request, time.Time{}, invalid
		}
		if key == "confirmed" {
			if value != true {
				return request, time.Time{}, invalid
			}
			request.Confirmed = true
			continue
		}
		text, ok := value.(string)
		if !ok {
			return request, time.Time{}, invalid
		}
		switch key {
		case "id":
			request.ID = text
		case "username":
			request.Username = text
		case "email":
			request.Email = text
		case "expiresAt":
			request.ExpiresAt = text
		default:
			return request, time.Time{}, invalid
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return request, time.Time{}, invalid
	}
	if _, err := decoder.Token(); err != io.EOF || len(seen) != 5 || !request.Confirmed || !adminRequestID.MatchString(request.ID) ||
		!validInvitationIdentity(request.Username, request.Email) || isReservedBootstrapRegistrationName(request.Username) ||
		len(request.ExpiresAt) > 30 || !strings.HasSuffix(request.ExpiresAt, "Z") {
		return request, time.Time{}, invalid
	}
	expires, err := time.Parse(time.RFC3339Nano, request.ExpiresAt)
	if err != nil || expires.Unix() <= now.Unix() || expires.Sub(now) > registrationInviteMaxLifetime {
		return request, time.Time{}, invalid
	}
	return request, expires.UTC(), nil
}

// Only a private authenticated response receives a proof. Audit contains target,
// expiry and admission outcome, never a proof, signing key, password or email.
func handleAdminBetaInvitation(c *Client, msg Message) {
	result := betaInvitationResult{adminMutationResult: adminMutationResult{Message: "Invitation unavailable. No invitation was returned."}}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgAdminBetaInvitation+"_result", payload))
	}()
	request, expires, err := decodeBetaInvitationRequest(msg.Payload, time.Now())
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	reject := func(summary string) {
		if c.username != "" {
			auditAdminRejectedRequest(c, MsgAdminBetaInvitation, adminMutationRequest{ID: result.ID}, "denied", summary)
		}
	}
	if err != nil {
		result.Message = "Review a valid account identity and future UTC expiry within seven days, then explicitly confirm."
		reject(result.Message)
		return
	}
	if c.username == "" || adminActivities == nil {
		return
	}
	if denial := adminAuthorityDenial(c); denial != "" {
		result.Message = denial
		reject("Invitation authority unavailable; no proof returned.")
		return
	}
	result.Authorized = true
	code, err := registrationInvitations.issue(request.Username, request.Email, time.Now(), expires)
	if err != nil {
		result.Message = "Invitations are not configured or the reviewed expiry is no longer valid."
		reject(result.Message)
		return
	}
	event, err := database.NewAdminActivity(c.username, request.Username, MsgAdminBetaInvitation, request.ID, "success",
		"Signup invitation admitted; no account was created", time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	event.Reason = "Expiry UTC: " + expires.Format(time.RFC3339Nano) + "; private response admission only"
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Activity storage unavailable. No invitation was returned."
		return
	}
	if denial := adminAuthorityDenial(c); denial != "" {
		result.Authorized = false
		result.Message = denial
		reject("Authority changed after invitation admission; no proof returned.")
		return
	}
	result.Success, result.Final = true, true
	result.Code, result.Username, result.ExpiresAt = code, request.Username, expires.Format(time.RFC3339Nano)
	result.Message = "Invitation prepared. Share the code privately with this exact account identity; no email or account creation was performed."
}
