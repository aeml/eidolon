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

// Approved reversible sanctions; admission, preview, owner support and live
// session retirement are all registered together for this milestone.
const MsgAdminChatModeration = "admin_chat_moderation"

type adminChatModerationStore interface {
	ApplyChatModeration(string, primitive.ObjectID, database.ChatModerationRequest) (database.ChatModerationReceipt, error)
	ModerationAccountUsername(string, primitive.ObjectID) (string, error)
	OwnModerationNotices(string) ([]database.ChatMuteNotice, error)
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

// Own ordered actor/target locks, rather than nesting below the actor-only
// dispatcher. Never call from an unfenced background worker.
func handleAdminChatModeration(c *Client, msg Message) {
	result := adminMutationResult{Message: "Moderation is unavailable. Nothing was acknowledged."}
	if c == nil {
		return
	}
	// This cross-account handler owns its ordered locks, like other admin
	// mutations. It must never run below the dispatcher's actor-only lock.
	if err := c.acceptInboundMessage(msg, time.Now()); err != nil {
		c.rejectAdminAdmission(msg, err.Error())
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
		// Retain the submitting authenticated actor even if this connection
		// was replaced during IO; never attribute a changed username to it.
		if actor != "" && c.username == actor {
			auditAdminRejectedRequest(c, MsgAdminChatModeration, adminMutationRequest{ID: result.ID}, outcome, summary)
		}
	}
	if err != nil {
		result.Message = "Invalid or unconfirmed moderation request. Nothing changed."
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
		rejected("denied", "Administrator access was not verified; no moderation admitted.")
		return
	}
	var store adminChatModerationStore = adminChatModerations
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	target, err := store.ModerationAccountUsername(actor, request.AccountID)
	if err != nil || target == "" || !current() {
		return
	}
	unlock := lockCharactersWork(actor, target)
	defer unlock()
	if !authorize() {
		result.Authorized = false
		rejected("denied", "Administrator access or connection changed; no moderation admitted.")
		return
	}
	for _, account := range []string{actor, target} {
		if err := recoverAccountAdminOperationsLocked(account); err != nil {
			return
		}
		if err := recoverAccountGuildBankOperationsLocked(account); err != nil {
			return
		}
		if err := recoverAccountBlackjackLocked(account); err != nil {
			return
		}
		if err := recoverAccountAuctionBidsLocked(account); err != nil {
			return
		}
	}
	// Admission is not a final sanction. The authoritative account write stores
	// its state and private receipt atomically; history retains no allegations.
	summary := fmt.Sprintf("Moderation %s requested for account %s, case %s, revision %d; consult the private account receipt for the outcome.",
		request.Change.Action, request.AccountID.Hex(), request.Change.ReportID, request.Change.ExpectedRevision)
	event, err := database.NewAdminActivity(actor, request.AccountID.Hex(), MsgAdminChatModeration, request.Change.ID,
		"success", summary, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return
	}
	if err := adminActivities.AppendAdminActivity(event); err != nil {
		retainFailedAdminActivity(c, event)
		result.Message = "Administration activity storage is unavailable. No moderation was applied."
		return
	}
	if !current() || !authorize() {
		result.Authorized = false
		rejected("denied", "Administrator access or connection changed; no moderation admitted.")
		return
	}
	receipt, err := store.ApplyChatModeration(actor, request.AccountID, request.Change)
	// An uncertain write may have committed. Enforce current state before any
	// reply; a failed read safely retires world play without declaring a ban.
	retireModeratedWorldSession(store, target)
	if errors.Is(err, database.ErrChatModerationConflict) {
		result.Final = true
		result.Message = "Moderation changed or the request conflicts with an earlier decision. Refresh before deciding again."
		return
	}
	if err != nil {
		result.Pending = true
		result.Message = "The outcome could not be confirmed. Check the account or retry this exact request; do not assume the decision or reversal succeeded."
		return
	}
	result.Success, result.Final = true, true
	result.Message = fmt.Sprintf("Moderation recorded at revision %d. Refresh the account to check its current notices; the case was not automatically resolved.", receipt.Revision)
}

// Caller holds the target's character-work lock. Read current restrictions,
// not the historic action in an exact-retry receipt. Login-only support stays
// available; only an active world session needs escrow-returning retirement.
func retireModeratedWorldSession(store ownAccountModerationNoticeStore, target string) {
	if c := getClientByUsername(target); c != nil && c.playerID != "" && currentCharacterConnection(c) {
		notice, err := newWorldModerationGate(store, time.Now)(c)
		if notice != nil || err != nil {
			sendWorldAccessDenied(c, notice, err)
			cleanupClientLocked(c)
		}
	}
}
