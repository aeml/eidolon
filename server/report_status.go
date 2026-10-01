package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"unicode/utf8"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ownReportStatusStore interface {
	OwnReportStatus(string, string) (database.ReportStatusView, error)
}

var reportStatuses ownReportStatusStore

func decodeReportStatus(payload []byte) (string, string, error) {
	invalid := errors.New("invalid report status request")
	if len(payload) > 512 || !utf8.Valid(payload) {
		return "", "", invalid
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return "", "", invalid
	}
	fields := map[string]string{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || key != "requestId" && key != "reportId" {
			return fields["requestId"], "", invalid
		}
		if _, duplicate := fields[key]; duplicate {
			return fields["requestId"], "", invalid
		}
		value, err := decoder.Token()
		text, ok := value.(string)
		if err != nil || !ok {
			return fields["requestId"], "", invalid
		}
		fields[key] = text
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return fields["requestId"], "", invalid
	}
	if _, err := decoder.Token(); err != io.EOF {
		return fields["requestId"], "", invalid
	}
	id, err := primitive.ObjectIDFromHex(fields["reportId"])
	if len(fields) != 2 || !reportRequestIDPattern.MatchString(fields["requestId"]) || err != nil || id.IsZero() || id.Hex() != fields["reportId"] {
		return fields["requestId"], "", invalid
	}
	return fields["requestId"], fields["reportId"], nil
}

func handleOwnReportStatus(c *Client, msg Message) {
	result := struct {
		RequestID string                     `json:"requestId"`
		Success   bool                       `json:"success"`
		Report    *database.ReportStatusView `json:"report,omitempty"`
		Message   string                     `json:"message"`
	}{Message: "Report status unavailable. Verify the reference and use the account that submitted it."}
	defer func() {
		payload, _ := json.Marshal(result)
		c.sendSafe(createMessage(MsgReportStatus+"_result", payload))
	}()
	requestID, reference, err := decodeReportStatus(msg.Payload)
	if reportRequestIDPattern.MatchString(requestID) {
		result.RequestID = requestID
	}
	if err != nil || c.username == "" || c.transportClosed.Load() || !currentCharacterConnection(c) {
		return
	}
	var store ownReportStatusStore = reportStatuses
	if store == nil && db != nil {
		store = db
	}
	if store == nil {
		return
	}
	view, err := store.OwnReportStatus(c.username, reference)
	if err != nil || view.ID.Hex() != reference || view.Status != database.ReportStatusOpen && view.Status != database.ReportStatusResolved {
		return
	}
	result.Success, result.Report, result.Message = true, &view, "Status checked for your own report. Resolution means review finished, not a promised fix or sanction reversal."
}
