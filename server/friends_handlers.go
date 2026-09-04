package main

import "encoding/json"

// handleMsgFriendList sends the caller's current friend list.
func handleMsgFriendList(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	listPayload := buildFriendListPayload(c.playerID)
	p, _ := json.Marshal(listPayload)
	c.sendSafe(createMessage(MsgFriendList, p))
}

// handleMsgFriendRequest sends a friend request to another player.
func handleMsgFriendRequest(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var req FriendUsernamePayload
	if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Username == "" {
		c.sendError("invalid friend request payload")
		return
	}
	if req.Username == c.username {
		c.sendError("cannot send friend request to yourself")
		return
	}
	if chatService.shouldFilter(req.Username, c.username) || chatService.shouldFilter(c.username, req.Username) {
		c.sendError("player is not available for friend requests")
		return
	}
	requesterID := c.playerID
	addresseeID := usernameToPlayerID(req.Username)
	if err := db.SendFriendRequest(requesterID, addresseeID); err != nil {
		c.sendError(err.Error())
		return
	}
	// Ack to sender.
	ackP, _ := json.Marshal(FriendUsernamePayload{Username: req.Username})
	c.sendSafe(createMessage(MsgFriendRequest, ackP))
	// Notify addressee if online so their pending list updates immediately.
	sessionsMu.Lock()
	addrClient, addrOnline := activeSessions[req.Username]
	sessionsMu.Unlock()
	if addrOnline {
		notifP, _ := json.Marshal(FriendUsernamePayload{Username: c.username})
		addrClient.sendSafe(createMessage(MsgFriendRequest, notifP))
	}
}

// handleMsgFriendAccept accepts a pending friend request from another player.
func handleMsgFriendAccept(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var req FriendUsernamePayload
	if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Username == "" {
		c.sendError("invalid friend accept payload")
		return
	}
	requesterID := usernameToPlayerID(req.Username)
	addresseeID := c.playerID
	if err := db.AcceptFriendRequest(requesterID, addresseeID); err != nil {
		c.sendError(err.Error())
		return
	}
	// Push fresh friend lists to both players.
	acceptorList := buildFriendListPayload(c.playerID)
	ap, _ := json.Marshal(acceptorList)
	c.sendSafe(createMessage(MsgFriendList, ap))

	sessionsMu.Lock()
	reqClient, reqOnline := activeSessions[req.Username]
	sessionsMu.Unlock()
	if reqOnline {
		reqList := buildFriendListPayload(requesterID)
		rp, _ := json.Marshal(reqList)
		reqClient.sendSafe(createMessage(MsgFriendList, rp))
	}
}

// handleMsgFriendDecline declines a pending friend request.
func handleMsgFriendDecline(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var req FriendUsernamePayload
	if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Username == "" {
		c.sendError("invalid friend decline payload")
		return
	}
	requesterID := usernameToPlayerID(req.Username)
	if err := db.DeclineFriendRequest(requesterID, c.playerID); err != nil {
		c.sendError(err.Error())
		return
	}
	// Ack to decliner.
	ackP, _ := json.Marshal(FriendUsernamePayload{Username: req.Username})
	c.sendSafe(createMessage(MsgFriendDecline, ackP))
}

// handleMsgFriendRemove removes an accepted friend from both sides.
func handleMsgFriendRemove(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var req FriendUsernamePayload
	if err := json.Unmarshal(msg.Payload, &req); err != nil || req.Username == "" {
		c.sendError("invalid friend remove payload")
		return
	}
	otherID := usernameToPlayerID(req.Username)
	if err := db.RemoveFriend(c.playerID, otherID); err != nil {
		c.sendError(err.Error())
		return
	}
	// Ack to requester and push updated list.
	myList := buildFriendListPayload(c.playerID)
	mp, _ := json.Marshal(myList)
	c.sendSafe(createMessage(MsgFriendList, mp))

	sessionsMu.Lock()
	otherClient, otherOnline := activeSessions[req.Username]
	sessionsMu.Unlock()
	if otherOnline {
		otherList := buildFriendListPayload(otherID)
		op, _ := json.Marshal(otherList)
		otherClient.sendSafe(createMessage(MsgFriendList, op))
	}
}
