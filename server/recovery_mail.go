package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"eidolon-server/internal/database"
)

const postmarkEmailEndpoint = "https://api.postmarkapp.com/email"

var errRecoveryMail = errors.New("Recovery email delivery was not confirmed.")

type recoveryMailer struct {
	token, from, stream string
	client              *http.Client
	endpoint            string
}

// Does not read/dump a .env file. Docker passes these existing operator values
// into the server process. No administrator BCC receives player recovery links.
func newRecoveryMailer(getenv func(string) string) (*recoveryMailer, error) {
	token := getenv("POSTMARK_SERVER_TOKEN")
	from := getenv("POSTMARK_FROM_EMAIL")
	stream := getenv("POSTMARK_MESSAGE_STREAM")
	if token == "" && from == "" && stream == "" {
		return nil, nil // Optional until configured; no unverifiable reset path.
	}
	if token == "" || len(token) > 256 || strings.ContainsAny(token, "\r\n\x00") || !database.ValidRecoveryEmail(from) {
		return nil, errors.New("Postmark recovery requires a token and a single verified sender address")
	}
	if stream == "" {
		stream = "outbound"
	}
	if len(stream) > 100 || strings.ContainsAny(stream, "\r\n\x00") {
		return nil, errors.New("Postmark message stream is invalid")
	}
	return &recoveryMailer{token: token, from: from, stream: stream, endpoint: postmarkEmailEndpoint,
		client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse // Never forward the provider token elsewhere.
		}}}, nil
}

type postmarkRecoveryMessage struct {
	From          string
	To            string
	Subject       string
	TextBody      string
	MessageStream string
	TrackOpens    bool
	TrackLinks    string
}

func (m *recoveryMailer) send(ctx context.Context, recipient, subject, text string) error {
	if m == nil || !database.ValidRecoveryEmail(recipient) || len(subject) > 120 || strings.ContainsAny(subject, "\r\n\x00") || len(text) > 8192 {
		return errRecoveryMail
	}
	body, err := json.Marshal(postmarkRecoveryMessage{From: m.from, To: recipient, Subject: subject,
		TextBody: text, MessageStream: m.stream, TrackOpens: false, TrackLinks: "None"})
	if err != nil {
		return errRecoveryMail
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, m.endpoint, bytes.NewReader(body))
	if err != nil {
		return errRecoveryMail
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Postmark-Server-Token", m.token)
	response, err := m.client.Do(request)
	if err != nil {
		return errRecoveryMail // Do not echo request headers or provider diagnostics.
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return errRecoveryMail
	}
	var receipt struct {
		ErrorCode *int
		MessageID string
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 32<<10))
	if decoder.Decode(&receipt) != nil || receipt.ErrorCode == nil || *receipt.ErrorCode != 0 || receipt.MessageID == "" {
		return errRecoveryMail
	}
	var trailing any
	if decoder.Decode(&trailing) != io.EOF {
		return errRecoveryMail
	}
	return nil // Provider accepted; this is not an inbox-delivery guarantee.
}

// Fixed trusted frontend, never derived from Host/forwarding headers. Fragment
// handoff avoids putting bearer secrets into proxy paths or release-cache keys.
func recoveryLink(kind, username, token string) (string, error) {
	if kind != "verify" && kind != "reset" || username == "" || len(username) > 128 || len(token) != 64 {
		return "", errRecoveryMail
	}
	for _, c := range token {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return "", errRecoveryMail
		}
	}
	fragment := url.Values{"eidolon-recovery": {kind}, "account": {username}, "token": {token}}
	return "https://play.eidolonrealms.com/#" + fragment.Encode(), nil
}
