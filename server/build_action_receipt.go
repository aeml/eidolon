package main

import (
	"eidolon-server/internal/database"
	"encoding/json"
)

// Admission failures must finish the same deliberate UI action as dispatcher
// failures. Otherwise a valid rejected purchase leaves touch controls pending
// indefinitely. Never parse oversized payloads or reflect malformed IDs.
func (c *Client) sendInboundRejection(msg Message, reason string) {
	if msg.Type == MsgAdminChatModeration && len(msg.Payload) <= 12288 {
		request, err := decodeAdminChatModeration(msg.Payload)
		if err == nil {
			payload, _ := json.Marshal(adminMutationResult{ID: request.Change.ID, Pending: true, Message: reason})
			c.sendSafe(createMessage(msg.Type+"_result", payload))
			return
		}
	}
	if isAdminMutation(msg.Type) && len(msg.Payload) <= adminMutationPayloadLimit {
		request, err := decodeAdminMutation(msg)
		if err == nil {
			// Rejected admission does not decide whether an earlier identical
			// request committed. Keep the retry identity until a durable result.
			payload, _ := json.Marshal(adminMutationResult{ID: request.ID, Message: reason})
			c.sendSafe(createMessage(msg.Type+"_result", payload))
			return
		}
	}
	switch msg.Type {
	case MsgOwnerExportSection:
		if p, known := inboundMessagePolicies[msg.Type]; known && len(msg.Payload) <= p.maxPayloadBytes {
			var request struct {
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(msg.Payload, &request) == nil && reportRequestIDPattern.MatchString(request.RequestID) {
				sendOwnerExportResult(c, request.RequestID, nil)
				return
			}
		}
	case MsgSetRecoveryEmail, MsgRequestPasswordRecovery, MsgConfirmRecoveryEmail, MsgCompletePasswordRecovery:
		if p, known := inboundMessagePolicies[msg.Type]; known && len(msg.Payload) <= p.maxPayloadBytes {
			var request struct {
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(msg.Payload, &request) == nil && reportRequestIDPattern.MatchString(request.RequestID) {
				sendEmailRecoveryResult(c, msg, request.RequestID, false, reason)
				return
			}
		}
	case MsgChangePassword:
		if p, known := inboundMessagePolicies[msg.Type]; known && len(msg.Payload) <= p.maxPayloadBytes {
			var request struct {
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(msg.Payload, &request) == nil && reportRequestIDPattern.MatchString(request.RequestID) {
				c.sendPasswordChangeResult(request.RequestID, false, reason, "")
				return
			}
		}
	case MsgGuildBankDeposit, MsgGuildBankWithdraw:
		if p, known := inboundMessagePolicies[msg.Type]; known && len(msg.Payload) <= p.maxPayloadBytes {
			var request GuildBankPayload
			if json.Unmarshal(msg.Payload, &request) == nil && database.ValidGuildBankRequestID(request.RequestID) {
				c.sendGuildBankResult(guildBankResult{RequestID: request.RequestID, Status: "pending", Message: reason})
				return // Admission cannot decide an earlier identical request's outcome.
			}
		}
	case MsgSelectBranch, MsgUnlockTalent, MsgResetTalents, MsgSelectRune:
		if p, known := inboundMessagePolicies[msg.Type]; known && len(msg.Payload) <= p.maxPayloadBytes {
			var request struct {
				RequestID string `json:"requestId"`
			}
			if json.Unmarshal(msg.Payload, &request) == nil && len(request.RequestID) > 0 && len(request.RequestID) <= 64 {
				c.sendBuildActionResult(request.RequestID, false, reason)
				return
			}
		}
	}
	c.sendError(reason)
}

func (c *Client) buildRequestID(msg Message) (string, bool) {
	var request struct {
		RequestID string `json:"requestId"`
	}
	if (len(msg.Payload) > 0 && json.Unmarshal(msg.Payload, &request) != nil) || len(request.RequestID) > 64 {
		c.sendError("Invalid build request")
		return "", false
	}
	return request.RequestID, true
}

// Additive, lossless receipts let touch menus distinguish an accepted build
// action from an unrelated state update. The build itself still arrives through
// the authoritative state/rune messages; a receipt is not a local build mutation.
func (c *Client) sendBuildActionResult(requestID string, ok bool, message string) {
	if requestID == "" {
		if !ok {
			c.sendError(message)
		}
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{"requestId": requestID, "ok": ok, "message": message})
	c.sendSafe(createMessage("build_action", payload))
}
