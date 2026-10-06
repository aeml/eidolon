package operations

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReadinessProbeActualResponsesAndPrivacy(t *testing.T) {
	for _, scenario := range []string{"ready", "database", "old-release", "identity", "malformed", "trailing", "oversized", "http", "redirect"} {
		t.Run(scenario, func(t *testing.T) {
			requests := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests++
				if r.URL.Path != "/healthz" || r.Header.Get("Cache-Control") != "no-cache" {
					t.Error("probe lost endpoint/cache policy")
				}
				body := `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.78.0","private":"secret-do-not-copy"}`
				switch scenario {
				case "database":
					body = strings.Replace(body, `"ready"`, `"unavailable"`, 1)
				case "old-release":
					body = strings.Replace(body, "abcdef1", "abcdef2", 1)
				case "identity":
					body = strings.Replace(body, "Alpha 1.78.0", "secret-do-not-copy", 1)
				case "malformed":
					body = "secret-do-not-copy"
				case "trailing":
					body += `{}`
				case "oversized":
					body = strings.Repeat("secret-do-not-copy", 3000)
				case "http":
					w.WriteHeader(503)
				case "redirect":
					w.Header().Set("Location", "/unexpected")
					w.WriteHeader(302)
				}
				_, _ = io.WriteString(w, body)
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "abcdef1", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			encoded, _ := json.Marshal(sample)
			if sample.Ready != (scenario == "ready") || requests != 1 || strings.Contains(string(encoded), "secret") || sample.Cause == "" {
				t.Fatal("readiness result, redirect refusal or private-field filtering failed")
			}
		})
	}
}

func TestReadinessProbeActualTimeoutAndShutdown(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer server.Close()
	probe, _ := NewProbe(server.URL+"/healthz", "", 50*time.Millisecond)
	start := time.Now()
	if sample := probe.Check(context.Background()); sample.Ready || sample.Cause != "probe_timeout" || time.Since(start) > time.Second {
		t.Fatal("stalled actual HTTP request did not finish within bounded timeout")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if sample := probe.Check(ctx); sample.Cause != "cancelled" || sample.Ready {
		t.Fatal("monitor cancellation became outage evidence")
	}
}

func TestReadinessProbeActualAggregateMetrics(t *testing.T) {
	for _, scenario := range []string{"valid", "missing", "partial", "partial-queue", "null-counter", "negative", "over-capacity", "bad-type"} {
		t.Run(scenario, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				body := `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.78.0","goroutines":12,"heapAllocBytes":1024,"heapObjects":50,"broadcastQueues":{"queued":3,"capacity":1024,"encounterQueued":1,"encounterCapacity":128,"dropped":8,"encounterDropped":2,"invalidDropped":5,"private":"secret-marker"},"players":[{"username":"secret-marker"}]}`
				switch scenario {
				case "missing":
					body = `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.78.0"}`
				case "partial":
					body = strings.Replace(body, `"goroutines":12,`, "", 1)
				case "partial-queue":
					body = strings.Replace(body, `"invalidDropped":5,`, "", 1)
				case "null-counter":
					body = strings.Replace(body, `"dropped":8`, `"dropped":null`, 1)
				case "negative":
					body = strings.Replace(body, `"goroutines":12`, `"goroutines":-1`, 1)
				case "over-capacity":
					body = strings.Replace(body, `"queued":3`, `"queued":1025`, 1)
				case "bad-type":
					body = strings.Replace(body, `"heapObjects":50`, `"heapObjects":"secret-marker"`, 1)
				}
				io.WriteString(w, body)
			}))
			defer server.Close()
			probe, err := NewProbe(server.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			valid := scenario == "valid" || scenario == "missing" || scenario == "partial" || scenario == "partial-queue" || scenario == "null-counter"
			if sample.Ready != valid || (sample.Runtime != nil) != (scenario == "valid") {
				t.Fatalf("unexpected aggregate sample: %+v", sample)
			}
			if scenario == "valid" && (sample.Runtime.Goroutines != 12 || sample.Runtime.HeapAllocBytes != 1024 || sample.Runtime.BroadcastQueues.Dropped != 8 || sample.Runtime.BroadcastQueues.EncounterDropped != 2) {
				t.Fatal("aggregate counters lost")
			}
			encoded, _ := json.Marshal(sample)
			if strings.Contains(string(encoded), "secret-marker") || strings.Contains(string(encoded), "username") {
				t.Fatal("private aggregate field leaked")
			}
		})
	}
}

func TestReadinessProbeActualBodyTimeoutAndCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()
	probe, err := NewProbe(server.URL+"/healthz", "", 50*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	if sample := probe.Check(context.Background()); sample.Cause != "probe_timeout" || sample.Ready {
		t.Fatalf("body timeout misclassified: %+v", sample)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	sample := probe.Check(ctx)
	detector, _ := NewDetector(1, 1, time.Minute)
	if sample.Cause != "cancelled" || detector.Observe(sample, time.Now()) != nil {
		t.Fatal("cancelled body read became an outage")
	}
}

func TestReadinessProbeRejectsUnsafeConfiguration(t *testing.T) {
	for _, endpoint := range []string{"http://example.com/healthz", "https://name:secret@example.com/healthz", "https://example.com/other", "https://example.com/healthz?token=secret", "https://example.com/healthz#secret", "file:///healthz"} {
		if _, err := NewProbe(endpoint, "", time.Second); err == nil || strings.Contains(err.Error(), "secret") {
			t.Fatal("unsafe probe configuration accepted or echoed")
		}
	}
	for _, timeout := range []time.Duration{0, -1, 11 * time.Second} {
		if _, err := NewProbe("https://example.com/healthz", "", timeout); err == nil {
			t.Fatal("unbounded timeout accepted")
		}
	}
}

func TestReadinessDetectorDebounceReminderRecoveryAndPrivacy(t *testing.T) {
	detector, err := NewDetector(2, 2, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1000, 0)
	bad, good := Sample{Cause: "secret-do-not-copy"}, Sample{Ready: true, Cause: "ready"}
	if detector.Observe(bad, now) != nil || detector.Observe(good, now) != nil || detector.Observe(bad, now) != nil {
		t.Fatal("a transient failed probe became an incident")
	}
	if notice := detector.Observe(bad, now); notice == nil || notice.Kind != "outage" || notice.Cause != "probe_failed" {
		t.Fatal("sustained failure lost sanitized outage notice")
	}
	for _, at := range []time.Time{now.Add(30 * time.Second), now.Add(-time.Hour)} {
		if detector.Observe(bad, at) != nil {
			t.Fatal("cooldown or backwards clock produced repeat notification")
		}
	}
	if notice := detector.Observe(bad, now.Add(time.Minute)); notice == nil || notice.Kind != "reminder" {
		t.Fatal("persistent outage lost bounded reminder")
	}
	if detector.Observe(Sample{Cause: "cancelled"}, now.Add(2*time.Minute)) != nil || detector.Observe(good, now) != nil {
		t.Fatal("cancellation or first healthy sample changed incident")
	}
	if notice := detector.Observe(good, now); notice == nil || notice.Kind != "recovered" || notice.Cause != "ready" {
		t.Fatal("sustained recovery lost confirmation")
	}
	if detector.Observe(good, now) != nil {
		t.Fatal("healthy monitoring generated repeat notifications")
	}
}
