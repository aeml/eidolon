package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

type captureWriter struct {
	text    strings.Builder
	onWrite func()
}

func (w *captureWriter) Write(p []byte) (int, error) {
	n, err := w.text.Write(p)
	if w.onWrite != nil {
		w.onWrite()
	}
	return n, err
}

func arguments(endpoint string) []string {
	return []string{"-health-url", endpoint, "-request-timeout", "100ms", "-poll-interval", "1s", "-failure-threshold", "2", "-recovery-threshold", "2", "-notice-cooldown", "1m"}
}

func TestMonitorCommandDeploymentValidationDoesNotProbeOrSend(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { requests.Add(1) }))
	defer server.Close()
	t.Setenv("EIDOLON_MONITOR_CHECK_CONFIG", "true")
	t.Setenv("POSTMARK_SERVER_TOKEN", "synthetic-operator-token")
	t.Setenv("POSTMARK_FROM_EMAIL", "monitor@example.invalid")
	t.Setenv("POSTMARK_MESSAGE_STREAM", "outbound")
	t.Setenv("ADMIN_NOTIFICATION_EMAILS", "owner@example.invalid")
	args := append(arguments(server.URL+"/healthz"), "-postmark-alerts", "-mail-timeout", "1s", "-mail-min-interval", "1m")
	args = append(args, "-public-frontend-url", "https://example.invalid/release.json", "-public-backend-url", "https://api.example.invalid/healthz")
	var output strings.Builder
	if err := run(context.Background(), args, &output); err != nil || requests.Load() != 0 || output.Len() != 0 {
		t.Fatalf("validation should be local/silent: %v requests=%d", err, requests.Load())
	}
	t.Setenv("POSTMARK_SERVER_TOKEN", "")
	if err := run(context.Background(), args, &output); err == nil {
		t.Fatal("validation bypassed notifier configuration")
	}
	t.Setenv("EIDOLON_MONITOR_CHECK_CONFIG", "synthetic-private-invalid")
	if err := run(context.Background(), arguments(server.URL+"/healthz"), &output); err == nil || strings.Contains(err.Error(), "synthetic-private") {
		t.Fatal("invalid validation mode was accepted or leaked", err)
	}
}

func TestMonitorCommandPublicConfigurationRejectsWithoutIO(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { requests.Add(1) }))
	defer server.Close()
	t.Setenv("EIDOLON_MONITOR_CHECK_CONFIG", "true")
	for _, extra := range [][]string{
		{"-public-frontend-url", "https://example.invalid/release.json"},
		{"-public-backend-url", "https://api.example.invalid/healthz"},
		{"-public-frontend-url", "http://example.invalid/release.json", "-public-backend-url", "https://api.example.invalid/healthz"},
		{"-public-frontend-url", "https://example.invalid/release.json", "-public-backend-url", "https://synthetic-private-user:secret@api.example.invalid/healthz"},
	} {
		var output strings.Builder
		err := run(context.Background(), append(arguments(server.URL+"/healthz"), extra...), &output)
		if err == nil || strings.Contains(err.Error(), "synthetic-private") || output.Len() != 0 || requests.Load() != 0 {
			t.Fatal("unsafe public configuration admission", err)
		}
	}
}

func TestMonitorCommandActualOutageRecovery(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if requests.Add(1) <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprint(w, "synthetic-private-peer-text")
			return
		}
		fmt.Fprint(w, `{"status":"ok","database":"ready","commit":"abcdef0","version":"Alpha 1.78.0","private":"synthetic-private-peer-text"}`)
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	writes := 0
	output := &captureWriter{onWrite: func() {
		writes++
		if writes == 2 {
			cancel()
		}
	}}
	if err := run(ctx, arguments(server.URL+"/healthz"), output); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.text.String()), "\n")
	if len(lines) != 2 || requests.Load() != 4 {
		t.Fatalf("got %d notices from %d polls", len(lines), requests.Load())
	}
	for i, kind := range []string{"outage", "recovered"} {
		var event struct {
			Notice struct{ Kind, Cause string }
			Sample struct{ Ready bool }
		}
		if err := json.Unmarshal([]byte(lines[i]), &event); err != nil {
			t.Fatal(err)
		}
		if event.Notice.Kind != kind || event.Sample.Ready != (i == 1) {
			t.Fatalf("unexpected event: %s", lines[i])
		}
	}
	if strings.Contains(output.text.String(), "synthetic-private") || strings.Contains(output.text.String(), server.URL) {
		t.Fatal("private response or URL leaked")
	}
}

type rejectedWriter struct{}

func (rejectedWriter) Write([]byte) (int, error) {
	return 0, errors.New("synthetic-private-output-error")
}

func TestMonitorCommandOutputFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusServiceUnavailable) }))
	defer server.Close()
	args := append(arguments(server.URL+"/healthz"), "-failure-threshold", "1")
	err := run(context.Background(), args, rejectedWriter{})
	if err == nil || err.Error() != "monitor output unavailable" {
		t.Fatalf("unexpected output error: %v", err)
	}
}

func TestMonitorCommandConfigurationAndShutdown(t *testing.T) {
	for _, args := range [][]string{nil, {"-health-url", "https://synthetic-private-user:secret@example.com/healthz"}, {"-unknown", "synthetic-private-value"}, {"synthetic-private-positional"}, append(arguments("http://127.0.0.1/healthz"), "-poll-interval", "0s")} {
		var out strings.Builder
		err := run(context.Background(), args, &out)
		if err == nil || strings.Contains(err.Error(), "synthetic-private") || out.Len() != 0 {
			t.Fatalf("unsafe invalid configuration: %v", err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var out strings.Builder
	if err := run(ctx, arguments("http://127.0.0.1/healthz"), &out); err != nil || out.Len() != 0 {
		t.Fatalf("shutdown wrote an outage: %v", err)
	}
}

func TestMonitorCommandPostmarkRequiresExplicitOptIn(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	t.Setenv("POSTMARK_SERVER_TOKEN", "synthetic-private-invalid\n")
	t.Setenv("POSTMARK_FROM_EMAIL", "synthetic-private-invalid")
	t.Setenv("POSTMARK_MESSAGE_STREAM", "synthetic-private-invalid/")
	t.Setenv("ADMIN_NOTIFICATION_EMAILS", "synthetic-private-invalid")
	var output strings.Builder
	args := arguments("http://127.0.0.1/healthz")
	if err := run(ctx, args, &output); err != nil || output.Len() != 0 {
		t.Fatal("disabled alerts unexpectedly read/required provider configuration", err)
	}
	for _, extra := range [][]string{{"-mail-timeout", "1s"}, {"-mail-min-interval", "1m"}, {"-postmark-alerts"}, {"-postmark-alerts", "-mail-timeout", "1s", "-mail-min-interval", "1m"}} {
		if err := run(ctx, append(append([]string{}, args...), extra...), &output); err == nil || strings.Contains(err.Error(), "synthetic-private") || output.Len() != 0 {
			t.Fatal("unsafe opt-in/configuration handling", err)
		}
	}
	t.Setenv("POSTMARK_SERVER_TOKEN", "synthetic-operator-token")
	t.Setenv("POSTMARK_FROM_EMAIL", "monitor@example.invalid")
	t.Setenv("POSTMARK_MESSAGE_STREAM", "outbound")
	t.Setenv("ADMIN_NOTIFICATION_EMAILS", "owner@example.invalid")
	// A pre-cancelled run proves configuration only. No real provider request.
	if err := run(ctx, append(args, "-postmark-alerts", "-mail-timeout", "1s", "-mail-min-interval", "1m"), &output); err != nil || output.Len() != 0 {
		t.Fatal("valid explicit configuration or cancellation failed", err)
	}
}

func TestMonitorCommandActualQueuePressureRecovery(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		queued := 0
		if requests.Add(1) <= 2 {
			queued = 8
		}
		fmt.Fprintf(w, `{"status":"ok","database":"ready","commit":"abcdef0","version":"Alpha 1.78.0","goroutines":10,"heapAllocBytes":100,"heapObjects":1,"broadcastQueues":{"queued":%d,"capacity":10,"encounterQueued":0,"encounterCapacity":10,"dropped":0,"encounterDropped":0,"invalidDropped":0},"private":"synthetic-private-peer-text"}`, queued)
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	writes := 0
	output := &captureWriter{onWrite: func() {
		writes++
		if writes == 2 {
			cancel()
		}
	}}
	args := append(arguments(server.URL+"/healthz"), "-queue-alert-percent", "80")
	if err := run(ctx, args, output); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.text.String()), "\n")
	if len(lines) != 2 || requests.Load() != 4 || strings.Contains(output.text.String(), "synthetic-private") {
		t.Fatal("pressure monitoring lost debounce/recovery/privacy")
	}
	for index, want := range []struct{ kind, cause string }{{"outage", "queue_budget"}, {"recovered", "ready"}} {
		var event struct{ Notice struct{ Kind, Cause string } }
		if json.Unmarshal([]byte(lines[index]), &event) != nil || event.Notice.Kind != want.kind || event.Notice.Cause != want.cause {
			t.Fatal("unexpected pressure notification")
		}
	}
}

func TestMonitorCommandPressureConfigurationAndDefaults(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	for _, flags := range [][]string{
		{"-max-probe-latency", "-1ns"}, {"-max-probe-latency", "101ms"},
		{"-max-heap-bytes", "-1"}, {"-max-goroutines", "-1"}, {"-queue-alert-percent", "101"},
		{"-queue-alert-percent", "-1"}, {"-max-inflight-calls", "18446744073709551616"},
	} {
		var output strings.Builder
		if err := run(ctx, append(arguments("http://127.0.0.1/healthz"), flags...), &output); err == nil || output.Len() != 0 {
			t.Fatal("unsafe pressure arguments accepted")
		}
	}
	var output strings.Builder
	args := append(arguments("http://127.0.0.1/healthz"), "-max-probe-latency", "100ms", "-max-heap-bytes", "100",
		"-max-goroutines", "10", "-queue-alert-percent", "100", "-max-inflight-calls", "18446744073709551615")
	if err := run(ctx, args, &output); err != nil || output.Len() != 0 {
		t.Fatal("valid optional budgets or shutdown failed", err)
	}
}

func TestMonitorCommandStorageConfigurationAndCancelledOptIn(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	for _, extra := range [][]string{
		{"-storage-path", "synthetic-private-relative", "-storage-timeout", "1s"},
		{"-storage-path", "/synthetic-private"}, {"-storage-timeout", "1s"},
		{"-min-storage-free-bytes", "1"}, {"-min-storage-free-percent", "20"},
		{"-storage-path", "/synthetic-private", "-storage-timeout", "11s"},
		{"-storage-path", "/synthetic-private", "-storage-timeout", "1s", "-min-storage-free-percent", "101"},
		{"-min-storage-free-bytes", "-1"}, {"-min-storage-free-bytes", "18446744073709551616"},
	} {
		var output strings.Builder
		if err := run(ctx, append(arguments("http://127.0.0.1/healthz"), extra...), &output); err == nil || strings.Contains(err.Error(), "synthetic-private") || output.Len() != 0 {
			t.Fatal("unsafe storage arguments or diagnostic path leak")
		}
	}
	var output strings.Builder
	if err := run(ctx, append(arguments("http://127.0.0.1/healthz"), "-storage-path", "/synthetic-private-absent", "-storage-timeout", "1s", "-min-storage-free-percent", "20"), &output); err != nil || output.Len() != 0 {
		t.Fatal("explicit storage settings or cancelled no-IO configuration failed", err)
	}
}
