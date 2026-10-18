package main

import "encoding/json"

// A capability contract rather than a release pin: compatible patches retain
// normal reconnects. This does not replace authoritative action validation.
const gameplayProtocol = "stationary-actions-roofs-v1"

func gameplayAdmissionAllowed(c *Client, protocol string) bool {
	if protocol == gameplayProtocol {
		return true
	}
	// The previously deployed client already presents world_access_denied.
	// Keep authentication/account help available; no moderation notice is made.
	payload, _ := json.Marshal(map[string]string{
		"code":    "client_update_required",
		"message": "The game has been updated. Reload this page to continue with your saved character.",
	})
	c.sendSafe(createMessage("world_access_denied", payload))
	return false
}
