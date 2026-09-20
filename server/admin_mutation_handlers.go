package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/mongo"
)

type adminMutationResult struct {
	ID         string `json:"id"`
	Success    bool   `json:"success"`
	Authorized bool   `json:"authorized"`
	Pending    bool   `json:"pending"`
	Final      bool   `json:"final"`
	Message    string `json:"message"`
}

func isAdminMutation(action string) bool {
	return action == MsgAdminGrantGold || action == MsgAdminGrantItem || action == MsgAdminTeleport
}

// Mutation admission owns the ordered actor/recipient/destination locks itself.
// Never call this while holding the ordinary dispatcher's single actor lock.
func handleAdminMutation(c *Client, msg Message) {
	if err := c.acceptInboundMessage(msg, time.Now()); err != nil {
		c.rejectAdminAdmission(msg, err.Error())
		return
	}
	request, parseErr := decodeAdminMutation(msg)
	accounts := []string{c.username}
	if parseErr == nil {
		accounts = append(accounts, request.Target, request.DestinationPlayer)
	}
	unlock := lockCharactersWork(accounts...)
	defer unlock()
	result := adminMutationResult{Message: "Administration is unavailable. Retry the same request after refreshing access."}
	if adminRequestID.MatchString(request.ID) {
		result.ID = request.ID
	}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(msg.Type+"_result", payload))
	}()
	pendingFailure := func(summary string) {
		result.Pending = true
		// Preserve the retry identity and any existing durable intent. This
		// records an unavailable attempt, not a final decision on its effect.
		auditAdminRejectedRequest(c, msg.Type, request, "error", summary)
	}
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		result.Message = "This connection is no longer active. Reconnect before using administration."
		// Admission already required an authenticated, rate-limited request.
		// A replacement connection may win while we wait for account locks;
		// retain this rejection without touching any earlier operation receipt.
		if c.username != "" {
			auditAdminRejectedRequest(c, msg.Type, request, "denied", result.Message)
		}
		return
	}
	if parseErr != nil {
		result.Message = "Invalid administration operation. Nothing was changed."
		if !auditAdminRejectedRequest(c, msg.Type, request, "denied", result.Message) {
			result.Message = "Administration activity storage is unavailable. Nothing was changed."
		}
		return
	}
	if adminRoles == nil || adminOperations == nil || adminActivities == nil {
		auditAdminRejectedRequest(c, msg.Type, request, "error", "Administration services unavailable; no new operation admitted.")
		return
	}
	authorized, err := adminRoles.HasAdminRole(c.username)
	if err != nil {
		auditAdminRejectedRequest(c, msg.Type, request, "error", "Administrator role could not be verified; no new operation admitted.")
		return
	}
	result.Authorized = authorized
	id, fingerprint := request.identities(c.username, msg.Type)
	stored, err := adminOperations.GetAdminOperation(id)
	if err != nil {
		// The original operation may already exist. Record only this failed
		// lookup attempt; do not invent a final denial or replace its receipt.
		pendingFailure("Previous operation could not be verified; no new operation admitted. Retry the same request.")
		return
	}
	if stored != nil && (stored.Fingerprint != fingerprint || stored.Actor != c.username || stored.Target != request.Target || stored.Action != msg.Type) {
		result.Message = "This request ID belongs to a different operation. Nothing new was changed."
		if !auditAdminRejectedRequest(c, msg.Type, request, "denied", result.Message) {
			result.Message = "Administration activity storage is unavailable. Nothing new was changed."
		}
		return
	}
	if !authorized && stored != nil {
		// Replays never create a second audit or reveal a formerly authorized
		// result after revocation. Recovery of an existing effect is independent.
		result.Message = "Administrator access is not enabled for this account."
		result.Final = stored.State == database.AdminOperationComplete && stored.Audit.Result == "denied" && stored.Audit.Summary == result.Message
		return
	}
	if stored == nil {
		outcome, summary := "denied", "Administrator access is not enabled for this account."
		var plan []byte
		if authorized {
			for _, account := range accounts {
				if account == "" {
					continue
				}
				if err := recoverAccountAdminOperationsLocked(account); err != nil {
					pendingFailure("Existing administration changes await recovery; no new operation admitted.")
					return
				}
				if err := recoverAccountBlackjackLocked(account); err != nil {
					pendingFailure("Existing casino funds await recovery; no new operation admitted.")
					return
				}
				if err := recoverAccountAuctionBidsLocked(account); err != nil {
					pendingFailure("Existing trading funds await recovery; no new operation admitted.")
					return
				}
			}
			if err := reconcileAdminCharacterLocked(request.Target); err != nil {
				pendingFailure("Character persistence unavailable; no new operation admitted.")
				return
			}
			plan, summary, err = planAdminMutationLocked(c.username, msg.Type, request, id, fingerprint)
			if err != nil {
				if !errors.Is(err, game.ErrAdminGrantRejected) && !errors.Is(err, game.ErrAdminTeleportRejected) {
					pendingFailure("Character change could not be planned; no new operation admitted.")
					return
				}
				plan = nil
			} else {
				outcome = "success"
			}
		}
		audit, err := database.NewAdminActivity(c.username, request.Target, msg.Type, request.ID, outcome, summary, time.Now(), adminActivities.AdminActivityRetentionDays())
		if err != nil {
			auditAdminRejectedRequest(c, msg.Type, request, "error", "Operation audit could not be prepared; no new operation admitted.")
			return
		}
		audit.Reason = request.Reason
		op := database.AdminOperation{Version: 1, ID: id, Fingerprint: fingerprint, Actor: c.username,
			Target: request.Target, RequestID: request.ID, Action: msg.Type, Audit: audit,
			State: database.AdminOperationAuditing, Payload: plan}
		if outcome == "success" {
			op.State = database.AdminOperationPending
		}
		stored, err = prepareAdminOperationLocked(op)
		if err != nil {
			pendingFailure("Operation preparation could not be confirmed. Retry the same request; its outcome is not yet known.")
			return
		}
	}
	completed, err := completeAdminOperationLocked(*stored)
	if err != nil || completed == nil || completed.State != database.AdminOperationComplete {
		result.Pending = true
		result.Message = "Operation is awaiting persistence or audit recovery. Retry this same request; do not submit a new one."
		return
	}
	forgetAdminOperation(*completed)
	result.Final = true
	result.Success = completed.Audit.Result == "success"
	result.Message = completed.Audit.Summary
}

// Malformed/conflicting requests and service/preparation failures use this path.
// Valid decisions (including denied non-admin requests) use permanent operation
// identities so an identical retry never inserts another audit entry.
func auditAdminRejectedRequest(c *Client, action string, request adminMutationRequest, outcome, summary string) bool {
	if adminActivities == nil {
		return false
	}
	id, target, reason := "invalid-request", "", ""
	if adminRequestID.MatchString(request.ID) {
		id = request.ID
	}
	if validAdminText(request.Target, 256) {
		target = request.Target
	}
	if validAdminText(request.Reason, 160) {
		reason = request.Reason
	}
	event, err := database.NewAdminActivity(c.username, target, action, id, outcome, summary, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err != nil {
		return false
	}
	event.Reason = reason
	if adminActivities.AppendAdminActivity(event) == nil {
		return true
	}
	// Rejections have no character mutation/operation journal to replay. Keep
	// their exact sanitized event in the existing durable activity outbox when
	// Mongo is unavailable; the normal retry/startup drain inserts that same ID.
	if adminActivityJournal != nil && adminActivityJournal.Write(event) == nil {
		return true
	}
	// Both stores failed. Reuse the disconnect-event recovery buffer: readiness
	// and clean shutdown stay blocked until the exact event becomes durable.
	// End this connection so repeated rejected requests cannot grow the buffer.
	// This is explicitly NOT a durable acknowledgement or a final decision on
	// an existing operation; a process/device failure before recovery can lose RAM.
	unjournaledActivity.Lock()
	unjournaledActivity.events[event.ID] = event
	unjournaledActivity.Unlock()
	c.transportClosed.Store(true)
	if c.conn != nil {
		_ = c.conn.Close()
	}
	return false
}

// A rejected transport must not remain an unlimited audit producer. The first
// administration admission violation ends that connection; subsequent buffered
// packets never reach operation handling. Anonymous traffic has no authenticated
// actor and is not attributed to a client-supplied identity.
func (c *Client) rejectAdminAdmission(msg Message, reason string) {
	if !c.transportClosed.CompareAndSwap(false, true) {
		return
	}
	defer func() {
		if c.conn != nil {
			_ = c.conn.Close()
		}
	}()
	if c.username != "" {
		request := adminMutationRequest{}
		if len(msg.Payload) <= adminMutationPayloadLimit {
			request, _ = decodeAdminMutation(msg)
		}
		if !auditAdminRejectedRequest(c, msg.Type, request, "denied", "Administration admission rejected: "+reason+". Connection closed; no new operation admitted.") {
			reason = "Administration activity storage is unavailable. Reconnect and retry the same request."
		}
	}
	// Preserve non-final correlation if the queued reply reaches the peer. A
	// transport close may win the write race; the existing reconnect UI also
	// retains this same operation identity rather than assuming a final denial.
	c.sendInboundRejection(msg, reason)
}

// Exact online binding, not a display name, stale socket or disconnected entity.
// The caller holds the account lock throughout planning, mutation and saving.
func adminOnlineCharacter(account string) *game.Entity {
	sessionsMu.Lock()
	client := activeSessions[account]
	sessionsMu.Unlock()
	if client == nil || client.username != account || client.playerID != "player-"+account || client.retired.Load() || client.transportClosed.Load() || world == nil {
		return nil
	}
	entity := world.GetEntityCopy(client.playerID)
	if entity == nil || entity.Type != game.TypePlayer || entity.Disconnected {
		return nil
	}
	return entity
}

func planAdminMutationLocked(actor, action string, request adminMutationRequest, id, fingerprint string) ([]byte, string, error) {
	if action == MsgAdminTeleport {
		denied := "Teleport rejected: select an available online character and a permitted clear destination."
		if adminOnlineCharacter(request.Target) == nil || request.Destination == "player" &&
			(adminOnlineCharacter(request.DestinationPlayer) == nil || request.Target != actor && request.DestinationPlayer != actor) {
			return nil, denied, game.ErrAdminTeleportRejected
		}
		plan, err := world.PlanAdminTeleport("player-"+request.Target, request.Destination, playerIDIfPresent(request.DestinationPlayer))
		if err != nil {
			return nil, denied, err
		}
		payload, err := json.Marshal(plan)
		summary := "Teleported character to town."
		if request.Destination == "player" {
			summary = "Teleported character beside account " + database.AdminActivityAccountKey(request.DestinationPlayer) + "."
		}
		return payload, summary, err
	}
	denied := "Grant rejected: verify the exact account, living character, inventory space and Gold limit."
	var entity *game.Entity
	if world != nil {
		entity = world.GetEntityCopy("player-" + request.Target)
	}
	if entity != nil && entity.Type != game.TypePlayer {
		return nil, denied, game.ErrAdminGrantRejected
	}
	if entity == nil {
		character, err := adminOperations.GetCharacter(request.Target, request.Target)
		if errors.Is(err, mongo.ErrNoDocuments) || err == nil && (character == nil || character.Name != request.Target) {
			return nil, denied, game.ErrAdminGrantRejected
		}
		if err != nil {
			return nil, "", err
		}
		entity = adminGrantEntityFromCharacter(character)
	}
	grant := game.AdminGrant{Action: action, Amount: request.Amount}
	summary := fmt.Sprintf("Granted %d Gold.", request.Amount)
	if action == MsgAdminGrantItem {
		var err error
		grant.Items, err = game.GenerateAdminItems(request.Item)
		if err != nil {
			return nil, denied, game.ErrAdminGrantRejected
		}
		summary = fmt.Sprintf("Created %d × %s (%s, level %d).", request.Item.Quantity, request.Item.Item, request.Item.Rarity, request.Item.Level)
	}
	// Check the entire plan on a detached snapshot before journaling intent.
	if _, err := entity.ApplyAdminGrant(id, fingerprint, grant); err != nil {
		return nil, denied, err
	}
	payload, err := json.Marshal(grant)
	return payload, summary, err
}

func playerIDIfPresent(account string) string {
	if account == "" {
		return ""
	}
	return "player-" + account
}
