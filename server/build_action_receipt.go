package main

import "encoding/json"

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
