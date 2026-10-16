package main

import "encoding/json"

// Metadata carries no token, key, roster or account details. It accompanies a
// registration rejection only; existing login/recovery traffic is unchanged.
func (c *Client) sendRegistrationInvitationRequired() {
	payload := json.RawMessage(`{"mode":"invitation"}`)
	data, _ := json.Marshal(Message{Type: "registration_status", Payload: payload})
	c.sendSafe(data)
}
