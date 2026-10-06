package operations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Preserve the production fixed URL until this test-only transport redirects
// it to a trusted local TLS fixture. Never open an upstream/provider connection.
type postmarkFixtureTransport struct {
	t      *testing.T
	origin *url.URL
	base   http.RoundTripper
}

func (transport postmarkFixtureTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.String() != operatorPostmarkEndpoint {
		transport.t.Fatal("notifier changed its fixed provider endpoint")
	}
	cloned := request.Clone(request.Context())
	u := *request.URL
	u.Scheme, u.Host = transport.origin.Scheme, transport.origin.Host
	cloned.URL = &u
	return transport.base.RoundTrip(cloned)
}

func fixtureNotifier(t *testing.T, handler http.HandlerFunc) *PostmarkNotifier {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	notifier, err := NewPostmarkNotifier(PostmarkConfig{Token: "synthetic-operator-token", From: "monitor@example.invalid",
		Recipients: "owner@example.invalid, other@example.invalid", Stream: "outbound", Timeout: time.Second, MinInterval: time.Minute})
	if err != nil {
		t.Fatal(err)
	}
	origin, _ := url.Parse(server.URL)
	notifier.client.Transport = postmarkFixtureTransport{t: t, origin: origin, base: server.Client().Transport}
	return notifier
}

func outageEvent() Event {
	return Event{Notice: Notice{Kind: "outage", Cause: "http_unavailable"}, Sample: Sample{Cause: "http_unavailable", Commit: "abcdef1", Version: "Alpha 1.78.0", LatencyMS: 3}}
}

func TestPostmarkNotifierActualTLSReceiptsAndPrivacy(t *testing.T) {
	for _, scenario := range []string{"accepted", "http", "provider-error", "missing-code", "missing-id", "malformed", "trailing", "oversized", "redirect"} {
		t.Run(scenario, func(t *testing.T) {
			var requests atomic.Int32
			notifier := fixtureNotifier(t, func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				if r.Method != http.MethodPost || r.URL.Path != "/email" || r.Header.Get("X-Postmark-Server-Token") != "synthetic-operator-token" || r.Header.Get("Content-Type") != "application/json" || r.Header.Get("Accept") != "application/json" {
					t.Error("provider method, endpoint or JSON authentication contract changed")
				}
				var payload map[string]any
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Error(err)
				}
				if payload["From"] != "monitor@example.invalid" || payload["To"] != "owner@example.invalid,other@example.invalid" || payload["MessageStream"] != "outbound" || payload["TrackLinks"] != "None" || payload["TrackOpens"] != false || payload["Subject"] != "Eidolon monitor: outage" {
					t.Error("mail routing or tracking controls changed")
				}
				if _, exists := payload["Bcc"]; exists || strings.Contains(payload["TextBody"].(string), "private-marker") {
					t.Error("extra recipient or arbitrary caller string leaked")
				}
				body := `{"ErrorCode":0,"MessageID":"synthetic-receipt","Message":"private-provider-marker"}`
				switch scenario {
				case "http":
					w.WriteHeader(403)
				case "provider-error":
					body = `{"ErrorCode":42,"MessageID":"synthetic-receipt","Message":"private-provider-marker"}`
				case "missing-code":
					body = `{"MessageID":"synthetic-receipt"}`
				case "missing-id":
					body = `{"ErrorCode":0}`
				case "malformed":
					body = "private-provider-marker"
				case "trailing":
					body += `{}`
				case "oversized":
					body = strings.Repeat("private-provider-marker", 1000)
				case "redirect":
					w.Header().Set("Location", "/unexpected")
					w.WriteHeader(302)
				}
				io.WriteString(w, body)
			})
			event := outageEvent()
			event.Delivery = "private-marker"
			status, err := notifier.Deliver(context.Background(), event)
			if (err == nil) != (scenario == "accepted") || scenario == "accepted" && status != "accepted" || requests.Load() != 1 || err != nil && strings.Contains(err.Error(), "private") {
				t.Fatal("receipt validation, redirect refusal or generic failure contract changed", err)
			}
		})
	}
}

func TestPostmarkNotifierGlobalAttemptIntervalAndCancellation(t *testing.T) {
	var requests atomic.Int32
	notifier := fixtureNotifier(t, func(w http.ResponseWriter, _ *http.Request) {
		if requests.Add(1) == 1 {
			w.WriteHeader(503)
		}
		fmt.Fprint(w, `{"ErrorCode":0,"MessageID":"synthetic-receipt"}`)
	})
	now := time.Date(2026, 10, 4, 0, 0, 0, 0, time.UTC)
	notifier.now = func() time.Time { return now }
	if _, err := notifier.Deliver(context.Background(), outageEvent()); err == nil {
		t.Fatal("provider failure hidden")
	}
	recovered := Event{Notice: Notice{Kind: "recovered", Cause: "ready"}, Sample: Sample{Ready: true, Cause: "ready"}}
	if status, err := notifier.Deliver(context.Background(), recovered); err != nil || status != "suppressed" {
		t.Fatal("flapping recovery bypassed attempt interval")
	}
	now = now.Add(-time.Minute)
	if status, _ := notifier.Deliver(context.Background(), outageEvent()); status != "suppressed" {
		t.Fatal("backward clock bypassed interval")
	}
	now = now.Add(2 * time.Minute)
	if status, err := notifier.Deliver(context.Background(), recovered); err != nil || status != "accepted" {
		t.Fatal("exact interval did not permit a new deliberate notice")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	now = now.Add(time.Minute)
	if _, err := notifier.Deliver(ctx, outageEvent()); err == nil || requests.Load() != 2 {
		t.Fatal("cancellation or suppressed notice reached provider")
	}
}

func TestPostmarkNotifierActualBodyTimeout(t *testing.T) {
	notifier := fixtureNotifier(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	})
	notifier.client.Timeout = 50 * time.Millisecond
	started := time.Now()
	if _, err := notifier.Deliver(context.Background(), outageEvent()); err == nil || time.Since(started) > time.Second {
		t.Fatal("stalled provider body escaped its configured deadline")
	}
}

func TestPostmarkNotifierRejectsPrivateConfigurationAndPayload(t *testing.T) {
	valid := PostmarkConfig{Token: "synthetic-token", From: "monitor@example.invalid", Recipients: "owner@example.invalid", Stream: "outbound", Timeout: time.Second, MinInterval: time.Minute}
	for _, change := range []func(*PostmarkConfig){
		func(c *PostmarkConfig) { c.Token = "private-marker\n" }, func(c *PostmarkConfig) { c.From = "private-marker" },
		func(c *PostmarkConfig) { c.Recipients = "owner@example.invalid,owner@example.invalid" }, func(c *PostmarkConfig) { c.Recipients = "" },
		func(c *PostmarkConfig) { c.Stream = "private-marker/unsafe" }, func(c *PostmarkConfig) { c.MinInterval = 0 }, func(c *PostmarkConfig) { c.Timeout = 11 * time.Second },
	} {
		config := valid
		change(&config)
		if _, err := NewPostmarkNotifier(config); err == nil || strings.Contains(err.Error(), "private-marker") {
			t.Fatal("unsafe configuration or disclosed input", err)
		}
	}
	for _, change := range []func(*Event){
		func(e *Event) { e.Notice.Kind = "private-marker" }, func(e *Event) { e.Sample.Cause = "private-marker" },
		func(e *Event) { e.Sample.Commit = "private-marker" }, func(e *Event) { e.Sample.Version = "private-marker" },
		func(e *Event) { e.Sample.Ready = true }, func(e *Event) { e.Sample.LatencyMS = -1 },
	} {
		event := outageEvent()
		change(&event)
		if _, err := alertBody(event); err == nil || strings.Contains(err.Error(), "private-marker") {
			t.Fatal("untrusted payload accepted/disclosed", err)
		}
	}
}
