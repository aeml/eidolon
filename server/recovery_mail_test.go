package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestRecoveryMailPostmarkContractAndFailures(t *testing.T) {
	for _, scenario := range []string{"accepted", "rejected", "http-error", "missing-code", "missing-id", "malformed", "trailing", "redirect"} {
		t.Run(scenario, func(t *testing.T) {
			requests := 0
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests++
				if r.URL.Path != "/email" || r.Method != "POST" || r.Header.Get("X-Postmark-Server-Token") != "synthetic-private-token" || r.Header.Get("Content-Type") != "application/json" {
					t.Error("wrong provider authentication/endpoint")
				}
				var message postmarkRecoveryMessage
				if json.NewDecoder(r.Body).Decode(&message) != nil || message.To != "owner@example.invalid" || message.From != "sender@example.invalid" || message.MessageStream != "fixture-stream" || message.TrackOpens || message.TrackLinks != "None" || !strings.Contains(message.TextBody, "synthetic-link") {
					t.Error("lost recipient/content or enabled tracking")
				}
				switch scenario {
				case "http-error":
					w.WriteHeader(500)
				case "redirect":
					w.Header().Set("Location", "/unexpected")
					w.WriteHeader(302)
				case "rejected":
					io.WriteString(w, `{"ErrorCode":422,"Message":"private diagnostic"}`)
				case "missing-code":
					io.WriteString(w, `{"MessageID":"fixture"}`)
				case "missing-id":
					io.WriteString(w, `{"ErrorCode":0}`)
				case "malformed":
					io.WriteString(w, `not-json`)
				case "trailing":
					io.WriteString(w, `{"ErrorCode":0,"MessageID":"fixture"} {}`)
				default:
					io.WriteString(w, `{"ErrorCode":0,"MessageID":"fixture"}`)
				}
			}))
			defer server.Close()
			m, err := newRecoveryMailer(func(key string) string {
				return map[string]string{"POSTMARK_SERVER_TOKEN": "synthetic-private-token", "POSTMARK_FROM_EMAIL": "sender@example.invalid", "POSTMARK_MESSAGE_STREAM": "fixture-stream"}[key]
			})
			if err != nil {
				t.Fatal(err)
			}
			client := server.Client()
			client.Timeout = time.Second
			client.CheckRedirect = m.client.CheckRedirect
			m.client, m.endpoint = client, server.URL+"/email"
			err = m.send(context.Background(), "owner@example.invalid", "Eidolon recovery", "synthetic-link")
			if (err == nil) != (scenario == "accepted") || requests != 1 {
				t.Fatal("wrong provider outcome", err, requests)
			}
			if err != nil && (strings.Contains(err.Error(), "private") || strings.Contains(err.Error(), "synthetic")) {
				t.Fatal("provider secret/diagnostic leaked")
			}
		})
	}
}

func TestRecoveryMailConfigurationAndSafeLink(t *testing.T) {
	if mailer, err := newRecoveryMailer(func(string) string { return "" }); err != nil || mailer != nil {
		t.Fatal("unconfigured mail was enabled")
	}
	for _, values := range []map[string]string{
		{"POSTMARK_SERVER_TOKEN": "token"},
		{"POSTMARK_SERVER_TOKEN": "token\nsecret", "POSTMARK_FROM_EMAIL": "sender@example.invalid"},
		{"POSTMARK_SERVER_TOKEN": "token", "POSTMARK_FROM_EMAIL": "sender@example.invalid,other@example.invalid"},
		{"POSTMARK_SERVER_TOKEN": "token", "POSTMARK_FROM_EMAIL": "sender@example.invalid", "POSTMARK_MESSAGE_STREAM": "bad\nstream"},
	} {
		if _, err := newRecoveryMailer(func(key string) string { return values[key] }); err == nil {
			t.Fatal("invalid mail configuration admitted")
		}
	}
	m, err := newRecoveryMailer(func(key string) string {
		return map[string]string{"POSTMARK_SERVER_TOKEN": "token", "POSTMARK_FROM_EMAIL": "sender@example.invalid"}[key]
	})
	if err != nil || m.stream != "outbound" || m.endpoint != postmarkEmailEndpoint || m.client.Timeout != 8*time.Second || m.client.CheckRedirect(nil, nil) != http.ErrUseLastResponse {
		t.Fatal("unbounded/untrusted delivery configuration")
	}
	link, err := recoveryLink("reset", "owner with & symbols", strings.Repeat("a", 64))
	u, parseErr := url.Parse(link)
	if err != nil || parseErr != nil || u.Host != "play.eidolonrealms.com" || u.Scheme != "https" || u.RawQuery != "" {
		t.Fatal("untrusted/leaking reset URL")
	}
	fragment, _ := url.ParseQuery(u.EscapedFragment())
	if fragment.Get("account") != "owner with & symbols" || fragment.Get("token") != strings.Repeat("a", 64) || fragment.Get("eidolon-recovery") != "reset" {
		t.Fatal("handoff encoding lost values")
	}
	for _, kind := range []string{"", "injected-kind"} {
		if _, err := recoveryLink(kind, "owner", strings.Repeat("a", 64)); err == nil {
			t.Fatal("invalid purpose admitted")
		}
	}
	if _, err := recoveryLink("verify", "owner", strings.Repeat("X", 64)); err == nil {
		t.Fatal("invalid secret admitted")
	}
}
