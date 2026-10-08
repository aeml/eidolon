package operations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const frontendFixtureCommit = "abcdef1"
const frontendFixtureVersion = "Alpha 1.79.1"
const frontendFixtureHealth = `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.79.1"}`
const frontendFixtureRelease = `{"commit":"abcdef1","version":"Alpha 1.79.1","private":"synthetic-private-peer"}`

func TestFrontendReleaseProbeActualResponses(t *testing.T) {
	for _, scenario := range []struct{ name, cause string }{
		{"ready", "ready"}, {"commit", "frontend_release_mismatch"}, {"version", "frontend_release_mismatch"},
		{"missing", "frontend_invalid_response"}, {"private-identity", "frontend_invalid_response"},
		{"malformed", "frontend_invalid_response"}, {"trailing", "frontend_invalid_response"},
		{"limit", "ready"}, {"oversized", "frontend_invalid_response"},
		{"http", "frontend_unavailable"}, {"redirect", "frontend_unavailable"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			var healthRequests, frontendRequests, unexpected atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet || r.Header.Get("Cache-Control") != "no-cache" || r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
					t.Error("probe changed read-only/cache/credential policy")
				}
				switch r.URL.Path {
				case "/healthz":
					healthRequests.Add(1)
					io.WriteString(w, frontendFixtureHealth)
				case "/release.json":
					frontendRequests.Add(1)
					body := frontendFixtureRelease
					switch scenario.name {
					case "commit":
						body = strings.Replace(body, "abcdef1", "abcdef2", 1)
					case "version":
						body = strings.Replace(body, "Alpha 1.79.1", "Alpha 1.79.0", 1)
					case "missing":
						body = `{}`
					case "private-identity":
						body = strings.Replace(body, "abcdef1", "synthetic-private-peer", 1)
					case "malformed":
						body = "synthetic-private-peer"
					case "trailing":
						body += `{}`
					case "limit":
						body += strings.Repeat(" ", 4096-len(body))
					case "oversized":
						body += strings.Repeat(" ", 4097-len(body))
					case "http":
						w.WriteHeader(503)
					case "redirect":
						w.Header().Set("Location", "/unexpected")
						w.WriteHeader(302)
					}
					io.WriteString(w, body)
				default:
					unexpected.Add(1)
					w.WriteHeader(500)
				}
			}))
			defer server.Close()
			p, err := NewProbeWithFrontendRelease(server.URL+"/healthz", server.URL+"/release.json", "", time.Second, PressureLimits{}, StorageConfig{})
			if err != nil {
				t.Fatal(err)
			}
			sample := p.Check(context.Background())
			if sample.Cause != scenario.cause || sample.Ready != (scenario.cause == "ready") || healthRequests.Load() != 1 || frontendRequests.Load() != 1 || unexpected.Load() != 0 {
				t.Fatalf("wrong result/requests: %+v health=%d frontend=%d unexpected=%d", sample, healthRequests.Load(), frontendRequests.Load(), unexpected.Load())
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "synthetic-private") || strings.Contains(string(encoded), server.URL) || sample.Commit != frontendFixtureCommit || sample.Version != frontendFixtureVersion {
				t.Fatal("frontend response leaked or replaced authoritative API identity")
			}
		})
	}
}

func TestFrontendReleaseProbeDisabledAndBackendFailurePrecedence(t *testing.T) {
	for _, scenario := range []string{"disabled", "database", "backend-http", "expected-commit"} {
		t.Run(scenario, func(t *testing.T) {
			var unexpected atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/healthz" {
					unexpected.Add(1)
					w.WriteHeader(500)
					return
				}
				body := frontendFixtureHealth
				if scenario == "database" {
					body = strings.Replace(body, "ready", "unavailable", 1)
				}
				if scenario == "backend-http" {
					w.WriteHeader(503)
				}
				io.WriteString(w, body)
			}))
			defer server.Close()
			frontend, expected := server.URL+"/release.json", ""
			if scenario == "disabled" {
				frontend = ""
			}
			if scenario == "expected-commit" {
				expected = "abcdef2"
			}
			p, err := NewProbeWithFrontendRelease(server.URL+"/healthz", frontend, expected, time.Second, PressureLimits{}, StorageConfig{})
			if err != nil {
				t.Fatal(err)
			}
			sample := p.Check(context.Background())
			causes := map[string]string{"disabled": "ready", "database": "not_ready", "backend-http": "http_unavailable", "expected-commit": "release_mismatch"}
			if unexpected.Load() != 0 || sample.Cause != causes[scenario] {
				t.Fatal("optional frontend request overrode/ran despite backend result", sample)
			}
		})
	}
}

func TestFrontendReleaseProbeTLSVerificationAndValidatedTrust(t *testing.T) {
	health := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { io.WriteString(w, frontendFixtureHealth) }))
	defer health.Close()
	frontend := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { io.WriteString(w, frontendFixtureRelease) }))
	defer frontend.Close()
	p, err := NewProbeWithFrontendRelease(health.URL+"/healthz", frontend.URL+"/release.json", "", time.Second, PressureLimits{}, StorageConfig{})
	if err != nil {
		t.Fatal(err)
	}
	if s := p.Check(context.Background()); s.Ready || s.Cause != "frontend_probe_failed" {
		t.Fatal("untrusted TLS accepted", s)
	}
	// Trust only the synthetic server's CA; do not disable certificate checks.
	p.client.Transport = frontend.Client().Transport
	if s := p.Check(context.Background()); !s.Ready {
		t.Fatal("valid trusted TLS refused", s)
	}
}

type frontendDeadlineTransport struct {
	mu        sync.Mutex
	deadlines []time.Time
}

func (r *frontendDeadlineTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	deadline, ok := request.Context().Deadline()
	if !ok {
		return nil, fmt.Errorf("synthetic-private-missing-deadline")
	}
	r.mu.Lock()
	r.deadlines = append(r.deadlines, deadline)
	r.mu.Unlock()
	return http.DefaultTransport.RoundTrip(request)
}

func TestFrontendReleaseProbeSharedDeadlineAndCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			select {
			case <-time.After(15 * time.Millisecond):
				io.WriteString(w, frontendFixtureHealth)
			case <-r.Context().Done():
			}
			return
		}
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()
	p, err := NewProbeWithFrontendRelease(server.URL+"/healthz", server.URL+"/release.json", "", 100*time.Millisecond, PressureLimits{}, StorageConfig{})
	if err != nil {
		t.Fatal(err)
	}
	transport := &frontendDeadlineTransport{}
	p.client.Transport = transport
	start := time.Now()
	if s := p.Check(context.Background()); s.Ready || s.Cause != "frontend_probe_timeout" || time.Since(start) > time.Second {
		t.Fatal("frontend body was not bounded", s)
	}
	transport.mu.Lock()
	deadlines := append([]time.Time(nil), transport.deadlines...)
	transport.mu.Unlock()
	if len(deadlines) != 2 || !deadlines[0].Equal(deadlines[1]) {
		t.Fatal("API/frontend did not share the same total request deadline")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	s := p.Check(ctx)
	detector, _ := NewDetector(1, 1, time.Minute)
	if s.Cause != "cancelled" || detector.Observe(s, time.Now()) != nil {
		t.Fatal("caller cancellation produced an outage", s)
	}
}

func TestFrontendReleaseProbeRejectsUnsafeURLs(t *testing.T) {
	for _, endpoint := range []string{
		"http://example.invalid/release.json", "https://synthetic-private:secret@example.invalid/release.json",
		"https://example.invalid/", "https://example.invalid/release.json?token=synthetic-private", "https://example.invalid/release.json?",
		"https://example.invalid/release.json#synthetic-private", "https://example.invalid/%72elease.json",
		"https://example.invalid/release.json#", "https://:443/release.json", "https://::1/release.json",
		"https://example.invalid:/release.json", "https://example.invalid:0/release.json", "https://example.invalid:65536/release.json",
		"https://[example.invalid]/release.json", "https://[127.0.0.1]/release.json", "file:///release.json",
	} {
		if _, err := NewProbeWithFrontendRelease("http://127.0.0.1/healthz", endpoint, "", time.Second, PressureLimits{}, StorageConfig{}); err == nil || strings.Contains(err.Error(), "synthetic-private") {
			t.Fatal("unsafe URL accepted or leaked", err)
		}
	}
	for _, endpoint := range []string{"http://localhost/release.json", "http://[::1]:18082/release.json", "https://play.eidolonrealms.com/release.json"} {
		if _, err := NewProbeWithFrontendRelease("http://127.0.0.1/healthz", endpoint, "", time.Second, PressureLimits{}, StorageConfig{}); err != nil {
			t.Fatal("valid configured frontend refused", err)
		}
	}
}

func TestFrontendReleaseProbeIncidentsRetainSanitizedCause(t *testing.T) {
	for _, cause := range []string{"frontend_probe_failed", "frontend_probe_timeout", "frontend_unavailable", "frontend_invalid_response", "frontend_release_mismatch"} {
		detector, _ := NewDetector(1, 1, time.Minute)
		sample := Sample{Cause: cause, Commit: frontendFixtureCommit, Version: frontendFixtureVersion}
		notice := detector.Observe(sample, time.Now())
		if notice == nil || notice.Cause != cause {
			t.Fatal("frontend cause discarded", cause)
		}
		if _, err := alertBody(Event{Notice: *notice, Sample: sample}); err != nil {
			t.Fatal("sanitized frontend notice refused by existing mail adapter", err)
		}
	}
}
