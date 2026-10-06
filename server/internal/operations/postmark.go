package operations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"sync"
	"time"
)

const operatorPostmarkEndpoint = "https://api.postmarkapp.com/email"

var messageStream = regexp.MustCompile(`^[A-Za-z0-9_-]{1,100}$`)

type PostmarkConfig struct {
	Token, From, Recipients, Stream string
	Timeout, MinInterval            time.Duration
}

type PostmarkNotifier struct {
	config      PostmarkConfig
	client      *http.Client
	mu          sync.Mutex
	lastAttempt time.Time
	now         func() time.Time
}

// Construction is local validation only, never a provider request. Explicit
// timeout and a global mail-attempt interval are required: flapping incidents
// must not bypass reminder cooldown and produce an unbounded email bill.
func NewPostmarkNotifier(config PostmarkConfig) (*PostmarkNotifier, error) {
	invalid := errors.New("invalid operator Postmark configuration")
	if config.Timeout <= 0 || config.Timeout > 10*time.Second || config.MinInterval < time.Minute || config.MinInterval > 24*time.Hour ||
		len(config.Token) == 0 || len(config.Token) > 512 || strings.ContainsAny(config.Token, " \t\r\n") ||
		!bareMailAddress(config.From) || len(config.Recipients) > 50*255 || !messageStream.MatchString(config.Stream) {
		return nil, invalid
	}
	addresses := strings.Split(config.Recipients, ",")
	if len(addresses) == 0 || len(addresses) > 50 {
		return nil, invalid
	}
	seen := make(map[string]bool, len(addresses))
	for index, address := range addresses {
		address = strings.TrimSpace(address)
		if !bareMailAddress(address) || seen[strings.ToLower(address)] {
			return nil, invalid
		}
		seen[strings.ToLower(address)] = true
		addresses[index] = address
	}
	config.Recipients = strings.Join(addresses, ",")
	return &PostmarkNotifier{config: config, now: time.Now, client: &http.Client{Timeout: config.Timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func bareMailAddress(address string) bool {
	if len(address) == 0 || len(address) > 254 || strings.ContainsAny(address, "\r\n") {
		return false
	}
	parsed, err := mail.ParseAddress(address)
	return err == nil && parsed.Address == address && parsed.Name == "" && strings.Contains(address, "@")
}

func alertBody(event Event) ([]byte, error) {
	valid := false
	switch event.Notice.Kind {
	case "outage", "reminder":
		if !event.Sample.Ready && event.Sample.Cause == event.Notice.Cause {
			switch event.Notice.Cause {
			case "probe_failed", "probe_timeout", "http_unavailable", "invalid_response", "not_ready", "invalid_identity", "release_mismatch",
				"latency_budget", "heap_budget", "goroutine_budget", "queue_budget", "inflight_budget", "metrics_unavailable",
				"storage_budget", "storage_timeout", "storage_unavailable":
				valid = true
			}
		}
	case "recovered":
		valid = event.Sample.Ready && event.Notice.Cause == "ready" && event.Sample.Cause == "ready"
	}
	if !valid || event.Sample.LatencyMS < 0 || event.Sample.Commit != "" && !releaseCommit.MatchString(event.Sample.Commit) ||
		event.Sample.Version != "" && !releaseVersion.MatchString(event.Sample.Version) {
		return nil, errors.New("invalid operator alert")
	}
	// Ignore any caller-supplied delivery string. This deliberately serializes
	// only our fixed notice and typed aggregate sample, never raw response JSON.
	return json.Marshal(Event{Notice: event.Notice, Sample: event.Sample})
}

func (notifier *PostmarkNotifier) Deliver(ctx context.Context, event Event) (string, error) {
	failure := errors.New("operator alert delivery unconfirmed")
	body, err := alertBody(event)
	if err != nil {
		return "", err
	}
	notifier.mu.Lock()
	if ctx.Err() != nil {
		notifier.mu.Unlock()
		return "", failure
	}
	now := notifier.now()
	if !notifier.lastAttempt.IsZero() && now.Sub(notifier.lastAttempt) < notifier.config.MinInterval {
		notifier.mu.Unlock()
		return "suppressed", nil
	}
	notifier.lastAttempt = now // Failed or ambiguous calls also consume the interval.
	notifier.mu.Unlock()       // Never hold the rate-admission lock across network IO.
	payload := struct {
		From, To, Subject, TextBody, MessageStream, TrackLinks string
		TrackOpens                                             bool
	}{From: notifier.config.From, To: notifier.config.Recipients, Subject: "Eidolon monitor: " + event.Notice.Kind,
		TextBody: "Eidolon service monitor\n\n" + string(body), MessageStream: notifier.config.Stream, TrackLinks: "None", TrackOpens: false}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", failure
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, operatorPostmarkEndpoint, bytes.NewReader(encoded))
	if err != nil {
		return "", failure
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Postmark-Server-Token", notifier.config.Token)
	response, err := notifier.client.Do(request)
	if err != nil {
		return "", failure
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", failure
	}
	receipt, err := io.ReadAll(io.LimitReader(response.Body, (8<<10)+1))
	var result struct {
		ErrorCode *int
		MessageID string
	}
	if err != nil || len(receipt) > 8<<10 || json.Unmarshal(receipt, &result) != nil || result.ErrorCode == nil ||
		*result.ErrorCode != 0 || len(result.MessageID) == 0 || len(result.MessageID) > 128 {
		return "", failure
	}
	return "accepted", nil // Provider receipt, never guaranteed inbox delivery.
}
