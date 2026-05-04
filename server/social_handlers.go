package main

import "encoding/json"

// handleMsgSocial sends the current online-player social list to the requester.
func handleMsgSocial(c *Client, msg Message) {
	playerList := buildSocialList()
	payload, _ := json.Marshal(playerList)
	c.sendSafe(createMessage(MsgSocial, payload))
}

// handleMsgSocialStatus updates the caller's social status and broadcasts the
// change to all connected clients (0.37.3).
func handleMsgSocialStatus(c *Client, msg Message) {
	if c.playerID == "" {
		return
	}
	var payload SocialStatusPayload
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}
	status, ok := world.SetPlayerSocialStatus(c.playerID, payload.Status)
	if !ok {
		return
	}
	// Ack to requester.
	ackPayload, _ := json.Marshal(SocialStatusPayload{Status: status})
	c.sendSafe(createMessage(MsgSocialStatus, ackPayload))
	// Proactively push a fresh social list to all connected clients so their
	// Social windows update within one tick (0.37.3).
	go broadcastSocialToAll()
}
