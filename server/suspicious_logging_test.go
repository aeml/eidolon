package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestSuspiciousDiagnosticAddressesAreCanonicalAndNotAuthority(t *testing.T) {
	for _, tc := range []struct{ remote, forwarded, real, peer, reported string }{
		{"192.0.2.7:1234", "198.51.100.1, 192.0.2.8", "", "192.0.2.7", "198.51.100.1"},
		{"[2001:db8::1]:1234", "", "", "2001:db8::1", "2001:db8::1"},
		{"192.0.2.7:1234", "not-an-ip\nforged", "", "192.0.2.7", "192.0.2.7"},
		{"192.0.2.7:1234", strings.Repeat("x", 10000), "198.51.100.4", "192.0.2.7", "198.51.100.4"},
		{"[::ffff:192.0.2.7]:1234", "::ffff:198.51.100.2", "", "192.0.2.7", "198.51.100.2"},
		{"not-an-ip\nforged", "invalid", "invalid", "unknown", "unknown"},
		{"[fe80::1%interface]:1234", "", "", "fe80::1", "fe80::1"},
	} {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = tc.remote
		r.Header.Set("X-Forwarded-For", tc.forwarded)
		r.Header.Set("X-Real-IP", tc.real)
		if got := transportPeerIP(r); got != tc.peer {
			t.Fatalf("peer=%q want=%q", got, tc.peer)
		}
		if got := requestIP(r); got != tc.reported {
			t.Fatalf("reported=%q want=%q", got, tc.reported)
		}
	}
}

func TestSuspiciousPeerSamplingHasHardCardinalityAndReclaimsExpiredEntries(t *testing.T) {
	throttle := newIPThrottle()
	throttle.maxPeers = 3
	now := time.Unix(1000, 0)
	for _, ip := range []string{"one", "two", "three"} {
		if !throttle.allowAt(ip, 30*time.Second, now) {
			t.Fatal("initial diagnostic rejected")
		}
	}
	for i := 0; i < 100; i++ {
		if throttle.allowAt(fmt.Sprint(i), 30*time.Second, now) {
			t.Fatal("map capacity bypassed")
		}
	}
	if len(throttle.last) != 3 || throttle.allowAt("one", 30*time.Second, now.Add(-time.Hour)) {
		t.Fatal("cardinality or clock-rewind invariant lost")
	}
	if !throttle.allowAt("new", 30*time.Second, now.Add(30*time.Second)) || len(throttle.last) != 1 {
		t.Fatal("expired diagnostic keys not reclaimed")
	}
	throttle.allowAt(strings.Repeat("x", 10000), time.Minute, now.Add(time.Minute))
	for key := range throttle.last {
		if len(key) > 64+len("...[truncated]") {
			t.Fatal("unbounded diagnostic key retained")
		}
	}
	if newIPThrottle().maxPeers != 4096 {
		t.Fatal("production peer bound changed")
	}
}

func TestSuspiciousDisabledPeerCooldownDoesNotRetainKeys(t *testing.T) {
	throttle := newIPThrottle()
	for i := 0; i < 100; i++ {
		if !throttle.allowAt(fmt.Sprint(i), 0, time.Time{}) {
			t.Fatal("disabled peer cooldown rejected")
		}
	}
	if len(throttle.last) != 0 {
		t.Fatal("disabled peer cooldown retained keys")
	}
}

func TestSuspiciousSharedBudgetBoundsConcurrentFloodAndCountsSuppression(t *testing.T) {
	gate, now := newSuspiciousTrafficBudget(), time.Unix(1000, 0)
	var admitted atomic.Int32
	var work sync.WaitGroup
	for i := 0; i < 100; i++ {
		work.Add(1)
		go func() {
			defer work.Done()
			if _, ok := gate.allowAt(now); ok {
				admitted.Add(1)
			}
		}()
	}
	work.Wait()
	if admitted.Load() != 20 {
		t.Fatalf("concurrent budget admitted %d", admitted.Load())
	}
	if dropped, ok := gate.allowAt(now.Add(time.Second)); !ok || dropped != 80 {
		t.Fatalf("next emitted line: allowed=%v suppressed=%d", ok, dropped)
	}
	if _, ok := gate.allowAt(now.Add(-time.Hour)); ok {
		t.Fatal("rewind minted diagnostic budget")
	}
	gate.suppressed = ^uint64(0)
	gate.allowAt(now)
	if gate.suppressed != ^uint64(0) {
		t.Fatal("suppression counter wrapped")
	}
}

func isolatedSuspiciousLoggers(t *testing.T) (*bytes.Buffer, *bytes.Buffer) {
	t.Helper()
	oldFile, oldStdout, oldGate, oldThrottle := suspiciousFileLogger, suspiciousStdoutLogger, suspiciousLogBudget, suspiciousLogThrottle
	oldEnabled, oldCooldown := suspiciousStdout, suspiciousCooldown
	file, stdout := new(bytes.Buffer), new(bytes.Buffer)
	suspiciousFileLogger, suspiciousStdoutLogger = log.New(file, "", 0), log.New(stdout, "", 0)
	suspiciousLogBudget, suspiciousLogThrottle = newSuspiciousTrafficBudget(), newIPThrottle()
	enabled, cooldown := true, 30*time.Second
	suspiciousStdout, suspiciousCooldown = &enabled, &cooldown
	t.Cleanup(func() {
		suspiciousFileLogger, suspiciousStdoutLogger, suspiciousLogBudget, suspiciousLogThrottle = oldFile, oldStdout, oldGate, oldThrottle
		suspiciousStdout, suspiciousCooldown = oldEnabled, oldCooldown
	})
	return file, stdout
}

func TestSuspiciousLogsQuoteAndBoundEveryUntrustedFieldWithoutCredentialHeaders(t *testing.T) {
	file, stdout := isolatedSuspiciousLoggers(t)
	r := httptest.NewRequest(http.MethodGet, "/?token=PRIVATE_QUERY", nil)
	r.RemoteAddr = "192.0.2.7:1234"
	r.URL.Path = "/injected\nADMIN GRANT\x00" + strings.Repeat("x", 10000)
	r.Method = "GET\nFORGED"
	r.Header.Set("X-Forwarded-For", "invalid\nFORGED")
	r.Header.Set("User-Agent", "client\nFORGED\x00"+strings.Repeat("y", 10000))
	r.Header.Set("Authorization", "Bearer PRIVATE_AUTH")
	r.Header.Set("Cookie", "session=PRIVATE_COOKIE")
	logSuspiciousAt(r, "bad\nrequest\x00", fmt.Errorf("failure\nFORGED %s", strings.Repeat("z", 10000)), time.Unix(1000, 0))
	for _, output := range []string{file.String(), stdout.String()} {
		if strings.Count(output, "\n") != 1 || len(output) > 4608 || !strings.Contains(output, "...[truncated]") {
			t.Fatal("diagnostic line not single-line and bounded")
		}
		for _, private := range []string{"PRIVATE_QUERY", "PRIVATE_AUTH", "PRIVATE_COOKIE", "\x00"} {
			if strings.Contains(output, private) {
				t.Fatal("query/header/control data entered diagnostic record")
			}
		}
		if !strings.Contains(output, `peer_ip="192.0.2.7" reported_ip="192.0.2.7"`) {
			t.Fatal("malformed forwarding source was not canonicalized")
		}
	}
}

func TestSuspiciousForwardedSpoofCannotExpandPeerMapOrBypassFileBudget(t *testing.T) {
	file, stdout := isolatedSuspiciousLoggers(t)
	r, now := httptest.NewRequest(http.MethodGet, "/", nil), time.Unix(1000, 0)
	r.RemoteAddr = "192.0.2.7:1234"
	for i := 0; i < 100; i++ {
		r.Header.Set("X-Forwarded-For", fmt.Sprintf("198.51.100.%d", i))
		logSuspiciousAt(r, "non-ws request", nil, now)
	}
	if strings.Count(file.String(), "\n") != 20 || strings.Count(stdout.String(), "\n") != 1 || len(suspiciousLogThrottle.last) != 1 {
		t.Fatal("forwarding spoof bypassed source or shared logging bounds")
	}
	logSuspiciousAt(r, "non-ws request", nil, now.Add(time.Second))
	if !strings.Contains(file.String(), "suppressed=80") {
		t.Fatal("next file diagnostic omitted flood summary")
	}
}

func TestSuspiciousActualHTTPDecodedPathCannotForgeDiagnosticLines(t *testing.T) {
	file, _ := isolatedSuspiciousLoggers(t)
	done := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logSuspicious(r, "non-ws request", nil)
		close(done)
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()
	r, err := http.NewRequest(http.MethodGet, server.URL+"/test%0AFORGED?token=PRIVATE_QUERY", nil)
	if err != nil {
		t.Fatal(err)
	}
	r.Header.Set("Authorization", "Bearer PRIVATE_AUTH")
	response, err := server.Client().Do(r)
	if err != nil {
		t.Fatal(err)
	}
	io.Copy(io.Discard, response.Body)
	response.Body.Close()
	<-done
	output := file.String()
	if response.StatusCode != http.StatusBadRequest || strings.Count(output, "\n") != 1 ||
		!strings.Contains(output, `path="/test\nFORGED"`) || strings.Contains(output, "PRIVATE_") {
		t.Fatal("actual decoded HTTP path forged a line or exposed credentials")
	}
}
