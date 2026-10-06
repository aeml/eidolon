package operations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestStorageConfigurationAndByteGeometry(t *testing.T) {
	if probe, err := NewStorageProbe(StorageConfig{}); probe != nil || err != nil {
		t.Fatal("default storage configuration enabled IO")
	}
	for _, config := range []StorageConfig{
		{Path: "relative", Timeout: time.Second}, {Path: "/synthetic-private\npath", Timeout: time.Second},
		{Path: "/synthetic-private\x00path", Timeout: time.Second}, {Path: "/synthetic-private"},
		{Timeout: time.Second}, {MinFreeBytes: 1}, {MinFreePercent: 1},
		{Path: "/synthetic-private", Timeout: 11 * time.Second},
		{Path: "/synthetic-private", Timeout: time.Second, MinFreePercent: 101},
	} {
		if _, err := NewStorageProbe(config); err == nil || strings.Contains(err.Error(), "synthetic-private") {
			t.Fatal("invalid storage configuration accepted or leaked its path")
		}
	}
	for _, test := range []struct {
		unit              int64
		blocks, available uint64
		valid             bool
	}{
		{4096, 100, 25, true}, {4096, 100, 0, true},
		{0, 100, 25, false}, {-1, 100, 25, false}, {1, 0, 0, false},
		{1, 100, 101, false}, {1, math.MaxUint64, 1, false},
		{4096, math.MaxUint64/4096 + 1, 1, false}, {1, 100, math.MaxUint64, false},
	} {
		metrics, err := storageBytes(test.unit, test.blocks, test.available)
		if (err == nil) != test.valid || (metrics != nil) != test.valid {
			t.Fatal("unknown/overflowing filesystem numbers became valid")
		}
		if test.valid && (metrics.TotalBytes != uint64(test.unit)*test.blocks || metrics.AvailableBytes != uint64(test.unit)*test.available) {
			t.Fatal("filesystem byte conversion incorrect")
		}
	}
}

func TestStorageFloorBoundariesAndUnavailableMeasurements(t *testing.T) {
	for _, test := range []struct {
		name           string
		metrics        *StorageMetrics
		bytes, percent uint64
		readErr        error
		want           string
	}{
		{"observe-only", &StorageMetrics{100, 0}, 0, 0, nil, ""},
		{"equal-byte-floor", &StorageMetrics{100, 20}, 20, 0, nil, ""},
		{"below-byte-floor", &StorageMetrics{100, 19}, 20, 0, nil, "storage_budget"},
		{"equal-percent-floor", &StorageMetrics{100, 20}, 0, 20, nil, ""},
		{"below-percent-floor", &StorageMetrics{100, 19}, 0, 20, nil, "storage_budget"},
		{"fraction-needs-ceiling", &StorageMetrics{101, 20}, 0, 20, nil, "storage_budget"},
		{"fraction-enough", &StorageMetrics{101, 21}, 0, 20, nil, ""},
		{"all-free-uint64-edge", &StorageMetrics{math.MaxUint64, math.MaxUint64}, 0, 100, nil, ""},
		{"one-byte-short-uint64-edge", &StorageMetrics{math.MaxUint64, math.MaxUint64 - 1}, 0, 100, nil, "storage_budget"},
		{"nil", nil, 0, 0, nil, "storage_unavailable"},
		{"zero-total", &StorageMetrics{}, 0, 0, nil, "storage_unavailable"},
		{"impossible-free", &StorageMetrics{100, 101}, 0, 0, nil, "storage_unavailable"},
		{"kernel-error", nil, 0, 0, errors.New("synthetic-private-path kernel details"), "storage_unavailable"},
	} {
		t.Run(test.name, func(t *testing.T) {
			probe, err := NewStorageProbe(StorageConfig{Path: "/synthetic-private-path", Timeout: time.Second, MinFreeBytes: test.bytes, MinFreePercent: test.percent})
			if err != nil {
				t.Fatal(err)
			}
			probe.read = func(string) (*StorageMetrics, error) { return test.metrics, test.readErr }
			metrics, cause := probe.check(context.Background())
			if cause != test.want || (metrics != nil) != (test.want != "storage_unavailable") {
				t.Fatal("storage floor/read boundary failed", cause)
			}
		})
	}
}

func TestStorageBlockedReadBoundedAndCancellationDoesNotSpawnWorkers(t *testing.T) {
	probe, _ := NewStorageProbe(StorageConfig{Path: "/synthetic-private", Timeout: 20 * time.Millisecond})
	entered, release, returned := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	probe.read = func(string) (*StorageMetrics, error) {
		calls.Add(1)
		close(entered)
		<-release
		close(returned)
		return &StorageMetrics{100, 20}, nil
	}
	start := time.Now()
	if metrics, cause := probe.check(context.Background()); metrics != nil || cause != "storage_timeout" || time.Since(start) > time.Second {
		close(release)
		t.Fatal("blocked filesystem read did not return a bounded timeout", cause)
	}
	<-entered
	for i := 0; i < 100; i++ {
		if metrics, cause := probe.check(context.Background()); metrics != nil || cause != "storage_unavailable" {
			close(release)
			t.Fatal("blocked read admitted another worker")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, cause := probe.check(ctx); cause != "cancelled" || calls.Load() != 1 {
		close(release)
		t.Fatal("cancellation failed or spawned reads")
	}
	close(release)
	<-returned
	deadline := time.Now().Add(time.Second)
	for probe.active.Load() {
		if time.Now().After(deadline) {
			t.Fatal("completed storage worker retained admission slot")
		}
		time.Sleep(time.Millisecond)
	}
	probe.read = func(string) (*StorageMetrics, error) { return &StorageMetrics{100, 20}, nil }
	if _, cause := probe.check(context.Background()); cause != "" {
		t.Fatal("probe did not recover after blocked syscall returned")
	}
}

func TestStorageActualHTTPProbeDebounceRecoveryAndSecretFreeNotices(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, `{"status":"ok","database":"ready","commit":"abcdef0","version":"Alpha 1.78.0","private":"synthetic-private-peer"}`)
	}))
	defer server.Close()
	probe, err := NewProbeWithStorage(server.URL+"/healthz", "abcdef0", time.Second, PressureLimits{}, StorageConfig{
		Path: "/synthetic-private-mount", Timeout: time.Second, MinFreePercent: 20})
	if err != nil {
		t.Fatal(err)
	}
	var reads int
	probe.storage.read = func(string) (*StorageMetrics, error) {
		reads++
		if reads <= 2 {
			return &StorageMetrics{100, 19}, nil
		}
		return &StorageMetrics{100, 20}, nil
	}
	detector, _ := NewDetector(2, 2, time.Minute)
	var notices []Notice
	for i := 0; i < 4; i++ {
		sample := probe.Check(context.Background())
		if sample.Storage == nil || sample.Ready != (i >= 2) {
			t.Fatal("local storage lost ready boundary")
		}
		if notice := detector.Observe(sample, time.Unix(100+int64(i), 0)); notice != nil {
			body, err := alertBody(Event{Sample: sample, Notice: *notice})
			if err != nil || strings.Contains(string(body), "synthetic-private") || strings.Contains(string(body), server.URL) {
				t.Fatal("storage notification rejected or exposed private paths/peer/URL")
			}
			var retained Event
			if json.Unmarshal(body, &retained) != nil || retained.Sample.Storage == nil {
				t.Fatal("notification lost aggregate filesystem measurement")
			}
			notices = append(notices, *notice)
		}
	}
	if len(notices) != 2 || notices[0] != (Notice{Kind: "outage", Cause: "storage_budget"}) || notices[1] != (Notice{Kind: "recovered", Cause: "ready"}) {
		t.Fatal("storage incident debounce/recovery incorrect", notices)
	}
}

func TestStorageKeepsPrimaryFailuresAndCancellationPrecedence(t *testing.T) {
	for _, test := range []struct{ status, commit, cause string }{
		{"unavailable", "abcdef0", "not_ready"}, {"ok", "abcdef1", "release_mismatch"}, {"ok", "abcdef0", "storage_unavailable"},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			fmt.Fprintf(w, `{"status":%q,"database":"ready","commit":%q,"version":"Alpha 1.78.0"}`, test.status, test.commit)
		}))
		probe, err := NewProbeWithStorage(server.URL+"/healthz", "abcdef0", time.Second, PressureLimits{}, StorageConfig{Path: "/synthetic-private", Timeout: time.Second})
		if err != nil {
			t.Fatal(err)
		}
		probe.storage.read = func(string) (*StorageMetrics, error) { return nil, errors.New("synthetic-private-error") }
		if sample := probe.Check(context.Background()); sample.Ready || sample.Cause != test.cause || sample.Storage != nil {
			t.Fatal("storage masked primary failure or invented healthy zero", sample.Cause)
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if sample := probe.Check(ctx); sample.Ready || sample.Cause != "cancelled" {
			t.Fatal("storage lost cancellation boundary")
		}
		server.Close()
	}
}

func TestStorageIncidentThroughMonitorAndLocalTLSNotifier(t *testing.T) {
	var polls, reads, mails, clockCalls atomic.Int32
	health := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		polls.Add(1)
		fmt.Fprint(w, `{"status":"ok","database":"ready","commit":"abcdef0","version":"Alpha 1.78.0","private":"synthetic-private-peer"}`)
	}))
	defer health.Close()
	probe, err := NewProbeWithStorage(health.URL+"/healthz", "abcdef0", time.Second, PressureLimits{}, StorageConfig{
		Path: "/synthetic-private-mount", Timeout: time.Second, MinFreePercent: 20})
	if err != nil {
		t.Fatal(err)
	}
	probe.storage.read = func(string) (*StorageMetrics, error) {
		if reads.Add(1) <= 2 {
			return &StorageMetrics{100, 19}, nil
		}
		return &StorageMetrics{100, 20}, nil
	}
	notifier := fixtureNotifier(t, func(w http.ResponseWriter, r *http.Request) {
		var payload struct{ Subject, TextBody string }
		if json.NewDecoder(r.Body).Decode(&payload) != nil || strings.Contains(payload.TextBody, "synthetic-private") || strings.Contains(payload.TextBody, health.URL) {
			t.Error("private mount/peer/URL reached notification")
		}
		index := mails.Add(1)
		kind := "outage"
		if index == 2 {
			kind = "recovered"
		}
		if payload.Subject != "Eidolon monitor: "+kind || !strings.Contains(payload.TextBody, `"storage":`) {
			t.Error("storage notification lost cause/measurement")
		}
		fmt.Fprint(w, `{"ErrorCode":0,"MessageID":"synthetic-storage-receipt"}`)
	})
	notifier.now = func() time.Time { return time.Unix(int64(clockCalls.Add(1))*60, 0) }
	detector, _ := NewDetector(2, 2, time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	output := &notifiedEventWriter{cancel: cancel}
	if err := MonitorWithNotifier(ctx, probe, detector, time.Second, output, notifier); err != nil {
		t.Fatal(err)
	}
	if polls.Load() != 4 || reads.Load() != 4 || mails.Load() != 2 || output.events != 2 || strings.Contains(output.String(), "synthetic-private") {
		t.Fatal("storage monitor/notification/debounce/recovery boundary failed")
	}
	for index, line := range strings.Split(strings.TrimSpace(output.String()), "\n") {
		var event Event
		if json.Unmarshal([]byte(line), &event) != nil || event.Delivery != "accepted" || event.Sample.Storage == nil ||
			index == 0 && event.Notice.Cause != "storage_budget" || index == 1 && event.Notice.Cause != "ready" {
			t.Fatal("unexpected storage notice")
		}
	}
}
