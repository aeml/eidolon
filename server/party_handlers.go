package main

import "encoding/json"

// handleMsgPartyInvite invites a player to the caller's party, creating one if needed.
func handleMsgPartyInvite(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload PartyInvitePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	targetClient := getClientByUsername(payload.TargetName)
	if targetClient == nil {
		c.sendError("Player not found or offline")
		return
	}

	// Check if self
	if targetClient.playerID == c.playerID {
		c.sendError("Cannot invite yourself")
		return
	}

	inviter := world.GetEntity(c.playerID)
	if inviter == nil {
		return
	}

	// Reject if target has set their social status to "busy" (0.37.4).
	if ok, reason := world.CanReceivePartyInvite(targetClient.playerID); !ok {
		switch reason {
		case "busy":
			c.sendError(payload.TargetName + " is busy and cannot receive party invites")
		default:
			c.sendError("Player not available")
		}
		return
	}

	// Create party if not exists
	if inviter.PartyID == "" {
		party := world.CreateParty(c.playerID)
		if party == nil {
			c.sendError("Failed to create party")
			return
		}
		broadcastPartyUpdate(party) // Update inviter's UI
	} else {
		// Check if leader
		party := world.GetParty(inviter.PartyID)
		if party == nil {
			// Inconsistent state
			inviter.PartyID = ""
			return
		}
		if party.LeaderID != c.playerID {
			c.sendError("Only party leader can invite")
			return
		}
		if len(party.Members) >= party.MaxSize {
			c.sendError("Party is full")
			return
		}
	}

	// Send invite to target
	reqPayload := PartyRequestPayload{
		TargetName: c.username, // The name of the person inviting
	}
	reqBytes, _ := json.Marshal(reqPayload)
	targetClient.sendSafe(createMessage(MsgPartyRequest, reqBytes))
	c.sendError("Invite sent to " + payload.TargetName)
}

// handleMsgPartyResponse handles acceptance or rejection of a party invite.
func handleMsgPartyResponse(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload PartyResponsePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	if !payload.Accepted {
		// Notify inviter?
		return
	}

	inviterClient := getClientByUsername(payload.InviterName)
	if inviterClient == nil {
		c.sendError("Inviter is no longer online")
		return
	}

	inviter := world.GetEntity(inviterClient.playerID)
	if inviter == nil || inviter.PartyID == "" {
		c.sendError("Party no longer exists")
		return
	}

	err := world.JoinParty(inviter.PartyID, c.playerID)
	if err != nil {
		c.sendError("Failed to join party: " + err.Error())
		return
	}

	party := world.GetParty(inviter.PartyID)
	broadcastPartyUpdate(party)
}

// handleMsgPartyLeave removes the caller from their current party.
func handleMsgPartyLeave(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	party, err := world.LeaveParty(c.playerID)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	// Clear client's party UI
	emptyPayload := map[string]interface{}{
		"partyId": "",
		"members": []interface{}{},
	}
	emptyBytes, _ := json.Marshal(emptyPayload)
	c.sendSafe(createMessage(MsgPartyUpdate, emptyBytes))

	if party != nil {
		broadcastPartyUpdate(party)
	}
}

// handleMsgPartyKick removes a member from the caller's party (leader only).
func handleMsgPartyKick(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload PartyKickPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	party, err := world.KickPartyMember(c.playerID, payload.TargetID)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	broadcastPartyUpdate(party)

	// Notify kicked player
	targetClient := getClientByPlayerID(payload.TargetID)
	if targetClient != nil {
		emptyPayload := map[string]interface{}{
			"partyId": "",
			"members": []interface{}{},
		}
		emptyBytes, _ := json.Marshal(emptyPayload)
		targetClient.sendSafe(createMessage(MsgPartyUpdate, emptyBytes))
		targetClient.sendError("You have been kicked from the party")
	}
}

// handleMsgPartyPromote promotes a party member to leader (leader only).
func handleMsgPartyPromote(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload PartyPromotePayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	party, err := world.PromotePartyMember(c.playerID, payload.TargetID)
	if err != nil {
		c.sendError(err.Error())
		return
	}

	broadcastPartyUpdate(party)
}
