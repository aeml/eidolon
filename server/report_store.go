package main

import (
	"encoding/json"
	"errors"
	"log"
	"regexp"
)

var reportRequestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

func saveReport(username string, payload ReportPayload) (string, error) {
	if db == nil {
		log.Printf("Failed to save report from %s: database unavailable", username)
		return "", errors.New("database unavailable")
	}
	report, err := db.CreateReport(username, payload.ReportType, payload.Text)
	if err != nil {
		log.Printf("Failed to save report from %s: %v", username, err)
		return "", err
	}
	log.Printf("Queued report %s from %s: %s", report.ID.Hex(), username, payload.ReportType)
	return report.ID.Hex(), nil
}

// Correlate confirmation only after persistence; legacy clients still receive
// their existing system chat/error. No report body or database errors are echoed.
func (c *Client) handleReport(payloadBytes []byte) {
	var payload ReportPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil ||
		(payload.RequestID != "" && !reportRequestIDPattern.MatchString(payload.RequestID)) {
		c.sendError("Invalid report request")
		return
	}
	if c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		c.sendError("Please reconnect and authenticate before submitting a report.")
		return
	}
	var id string
	var err error
	if c.playerID == "" && payload.ReportType != "Moderation Appeal" {
		err = errors.New("active character required for non-appeal reports")
	} else {
		id, err = saveReport(c.username, payload)
	}
	result, _ := json.Marshal(struct {
		RequestID string `json:"requestId"`
		Success   bool   `json:"success"`
		ReportID  string `json:"reportId,omitempty"`
	}{payload.RequestID, err == nil, id})
	message, _ := json.Marshal(Message{Type: "report_result", Payload: result})
	c.sendSafe(message)
	if err != nil {
		c.sendError("Report submission failed")
		return
	}
	c.sendSystemChat("Report submitted successfully.")
}
