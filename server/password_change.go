package main

import (
	"encoding/json"
	"time"
)

type passwordChangePayload struct {
	RequestID       string `json:"requestId"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type passwordChangeStore interface {
	ChangePassword(username, current, next string) (bool, error)
}

func (c *Client) sendPasswordChangeResult(id string, success bool, message, token string) {
	// Never echo either credential, storage errors or a different account's data.
	payload, _ := json.Marshal(struct {
		RequestID   string `json:"requestId"`
		Success     bool   `json:"success"`
		Message     string `json:"message"`
		ResumeToken string `json:"resumeToken,omitempty"`
	}{id, success, message, token})
	frame, _ := json.Marshal(Message{Type: "password_change_result", Payload: payload})
	c.sendSafe(frame)
}

func handlePasswordChange(c *Client, msg Message) {
	if db == nil {
		c.sendInboundRejection(msg, "Account service is unavailable. Nothing was changed.")
		return
	}
	handlePasswordChangeWithStore(c, msg, db)
}

// Normal dispatch holds the actor's account-work lock throughout this handler,
// serializing login/resume/takeover against credential mutation and rotation.
func handlePasswordChangeWithStore(c *Client, msg Message, store passwordChangeStore) {
	var payload passwordChangePayload
	if json.Unmarshal(msg.Payload, &payload) != nil || !reportRequestIDPattern.MatchString(payload.RequestID) {
		c.sendError("Invalid password change request.")
		return
	}
	fail := func(message string) { c.sendPasswordChangeResult(payload.RequestID, false, message, "") }
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		fail("Please reconnect and authenticate before changing your password.")
		return
	}
	if len(payload.CurrentPassword) == 0 || len(payload.CurrentPassword) > registrationPasswordMaxBytes {
		fail("Enter your current password.")
		return
	}
	if err := validateNewPassword(c.username, payload.NewPassword); err != nil {
		fail(err.Error())
		return
	}
	if payload.CurrentPassword == payload.NewPassword {
		fail("Choose a different new password.")
		return
	}
	done, err := credentialAdmission.begin(MsgChangePassword, c.username, time.Now())
	if err != nil {
		fail(err.Error())
		return
	}
	defer done()
	// Fail before touching credentials if entropy is unavailable. Once storage
	// confirms mutation, installation cannot leave the former resume token live.
	token, err := generateResumeToken()
	if err != nil || store == nil {
		fail("Account service is unavailable. Nothing was changed.")
		return
	}
	changed, err := store.ChangePassword(c.username, payload.CurrentPassword, payload.NewPassword)
	if err != nil {
		// A lost database acknowledgement may follow a committed write. Do not
		// promise rollback or automatically resend old credentials.
		revokeAccountResumeToken(c.username)
		fail("Password change was not confirmed. Try signing in with the new password before retrying; the server may have saved it. Session resume is disabled until you sign in again.")
		return
	}
	if !changed {
		fail("Current password did not match, or credentials changed. Nothing was changed by this request.")
		return
	}
	installResumeToken(c.username, c, token)
	c.sendPasswordChangeResult(payload.RequestID, true, "Password changed. Your current session stays signed in; its previous resume token is no longer valid.", token)
}
