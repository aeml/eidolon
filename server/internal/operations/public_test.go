package operations

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const publicHealthFixture = `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.79.8","private":"private-public-probe-marker"}`
const publicReleaseFixture = `{"commit":"abcdef1","version":"Alpha 1.79.8","private":"private-public-probe-marker"}`
const publicPageFixture = `<html><div id="start-screen"><button id="btn-login">Login</button></div></html>`

func TestPublicMonitorActualTLSResponsesAndPrivacy(t *testing.T) {
	for _, tc := range []struct{ scenario, cause string }{
		{"ready", "ready"}, {"page404", "public_frontend_unavailable"},
		{"pageblank", "public_invalid_response"}, {"pageoversized", "public_invalid_response"},
		{"page-redirect", "public_frontend_unavailable"}, {"releasebad", "public_invalid_response"},
		{"releaseoversized", "public_invalid_response"}, {"release-trailing", "public_invalid_response"},
		{"releaseidentity", "public_invalid_response"}, {"releasecommit", "public_release_mismatch"},
		{"releaseversion", "public_release_mismatch"}, {"api404", "public_backend_unavailable"},
		{"api-redirect", "public_backend_unavailable"}, {"apibad", "public_invalid_response"},
		{"apidatabase", "public_backend_unavailable"}, {"apiidentity", "public_invalid_response"},
		{"apicommit", "public_release_mismatch"}, {"apiversion", "public_release_mismatch"},
		{"bothpublicnew", "public_release_mismatch"}, {"tls-untrusted", "public_frontend_unavailable"},
	} {
		t.Run(tc.scenario, func(t *testing.T) {
			var requests atomic.Int32
			local := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { io.WriteString(w, publicHealthFixture) }))
			defer local.Close()
			public := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				if r.Header.Get("Cache-Control") != "no-cache" {
					t.Error("missing public cache policy")
				}
				var body string
				switch r.URL.Path {
				case "/":
					body = publicPageFixture
					if tc.scenario == "page404" {
						w.WriteHeader(404)
					}
					if tc.scenario == "pageblank" {
						body = "private-public-probe-marker"
					}
					if tc.scenario == "pageoversized" {
						body = strings.Repeat("x", (1<<20)+1)
					}
					if tc.scenario == "page-redirect" {
						w.Header().Set("Location", "/unexpected")
						w.WriteHeader(302)
					}
				case "/release.json":
					body = publicReleaseFixture
					if tc.scenario == "releasebad" {
						body = "private-public-probe-marker"
					}
					if tc.scenario == "releaseoversized" {
						body = strings.Repeat("x", (32<<10)+1)
					}
					if tc.scenario == "release-trailing" {
						body += "{}"
					}
					if tc.scenario == "releaseidentity" {
						body = strings.ReplaceAll(body, "abcdef1", "private-public-probe-marker")
					}
					if tc.scenario == "releasecommit" || tc.scenario == "bothpublicnew" {
						body = strings.ReplaceAll(body, "abcdef1", "abcdef2")
					}
					if tc.scenario == "releaseversion" {
						body = strings.ReplaceAll(body, "1.79.8", "1.79.9")
					}
				case "/healthz":
					body = publicHealthFixture
					if tc.scenario == "api404" {
						w.WriteHeader(503)
					}
					if tc.scenario == "api-redirect" {
						w.Header().Set("Location", "/unexpected")
						w.WriteHeader(302)
					}
					if tc.scenario == "apibad" {
						body = "private-public-probe-marker"
					}
					if tc.scenario == "apidatabase" {
						body = strings.ReplaceAll(body, "ready", "unavailable")
					}
					if tc.scenario == "apiidentity" {
						body = strings.ReplaceAll(body, "abcdef1", "private-public-probe-marker")
					}
					if tc.scenario == "apicommit" || tc.scenario == "bothpublicnew" {
						body = strings.ReplaceAll(body, "abcdef1", "abcdef2")
					}
					if tc.scenario == "apiversion" {
						body = strings.ReplaceAll(body, "1.79.8", "1.79.9")
					}
				default:
					t.Error("followed redirect or changed endpoint")
					w.WriteHeader(404)
				}
				io.WriteString(w, body)
			}))
			defer public.Close()
			public.Config.ErrorLog = log.New(io.Discard, "", 0)
			probe, err := NewProbe(local.URL+"/healthz", "", time.Second)
			if err != nil {
				t.Fatal(err)
			}
			if tc.scenario != "tls-untrusted" {
				redirectPolicy := probe.client.CheckRedirect
				probe.client = public.Client()
				probe.client.Timeout = time.Second
				probe.client.CheckRedirect = redirectPolicy
			}
			if err := probe.ConfigurePublicEndpoints(public.URL+"/release.json", public.URL+"/healthz"); err != nil {
				t.Fatal(err)
			}
			sample := probe.Check(context.Background())
			encoded, _ := json.Marshal(sample)
			if sample.Cause != tc.cause || sample.Ready != (tc.scenario == "ready") ||
				strings.Contains(string(encoded), "private-public-probe-marker") || strings.Contains(string(encoded), public.URL) {
				t.Fatalf("wrong or unsafe sample: %+v", sample)
			}
			if sample.Public == nil || !sample.Public.FrontendChecked {
				t.Fatal("missing public coverage flags")
			}
			if tc.scenario == "ready" && (!sample.Public.FrontendReady || !sample.Public.BackendReady || !sample.Public.IdentityMatch || requests.Load() != 3) {
				t.Fatal("healthy public surfaces were not all checked")
			}
			if !sample.Ready {
				detector, _ := NewDetector(3, 2, 30*time.Minute)
				for i := 0; i < 2; i++ {
					if detector.Observe(sample, time.Now()) != nil {
						t.Fatal("public failure bypassed debounce")
					}
				}
				notice := detector.Observe(sample, time.Now())
				if notice == nil || notice.Cause != tc.cause {
					t.Fatal("public cause lost in detector")
				}
				body, err := alertBody(Event{Notice: *notice, Sample: sample})
				if err != nil || strings.Contains(string(body), "private-public-probe-marker") {
					t.Fatal("unsafe public alert encoding")
				}
				healthy := Sample{Ready: true, Cause: "ready"}
				if detector.Observe(healthy, time.Now()) != nil || detector.Observe(healthy, time.Now()) == nil {
					t.Fatal("public outage recovery debounce changed")
				}
			}
		})
	}
}

func TestPublicMonitorConfigurationAndDefaultIsolation(t *testing.T) {
	probe, _ := NewProbe("http://127.0.0.1/healthz", "", time.Second)
	for _, invalid := range []string{"", "http://example.invalid/release.json", "https://user:private-marker@example.invalid/release.json",
		"https://example.invalid/other", "https://example.invalid/release.json?private-marker", "https://example.invalid/release.json?",
		"https://example.invalid/release.json#private-marker", "https://example.invalid/release.json#", "https://example.invalid/release%2Ejson",
		"https://example.invalid:0/release.json", "https://example.invalid:65536/release.json", "https:///release.json"} {
		if err := probe.ConfigurePublicEndpoints(invalid, "https://api.example.invalid/healthz"); err == nil || strings.Contains(err.Error(), "private-marker") {
			t.Fatal("accepted invalid public endpoint or copied private input")
		}
		if probe.public != nil {
			t.Fatal("partial configuration was installed")
		}
	}
	if err := probe.ConfigurePublicEndpoints("https://example.invalid/release.json", ""); err == nil {
		t.Fatal("missing API allowed")
	}
	var requests atomic.Int32
	var unavailable atomic.Bool
	local := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		if unavailable.Load() {
			w.WriteHeader(503)
			return
		}
		io.WriteString(w, publicHealthFixture)
	}))
	defer local.Close()
	ordinary, _ := NewProbe(local.URL+"/healthz", "", time.Second)
	if err := ordinary.ConfigurePublicEndpoints("", ""); err != nil {
		t.Fatal(err)
	}
	if sample := ordinary.Check(context.Background()); !sample.Ready || sample.Public != nil || requests.Load() != 1 {
		t.Fatal("default local-only behavior changed")
	}
	unavailable.Store(true)
	if err := ordinary.ConfigurePublicEndpoints("https://unreachable.example.invalid/release.json", "https://unreachable.example.invalid/healthz"); err != nil {
		t.Fatal(err)
	}
	if sample := ordinary.Check(context.Background()); sample.Cause != "http_unavailable" || sample.Public != nil {
		t.Fatal("local outage triggered extra public work")
	}
}

type publicRecordingTransport struct {
	base      http.RoundTripper
	mu        sync.Mutex
	deadlines []time.Time
}

func (r *publicRecordingTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.Scheme == "https" {
		deadline, ok := request.Context().Deadline()
		if !ok {
			return nil, context.DeadlineExceeded
		}
		r.mu.Lock()
		r.deadlines = append(r.deadlines, deadline)
		r.mu.Unlock()
	}
	return r.base.RoundTrip(request)
}

func TestPublicMonitorSharedDeadlineAndShutdown(t *testing.T) {
	for _, cancelDuringPage := range []bool{false, true} {
		t.Run(map[bool]string{false: "deadline", true: "shutdown"}[cancelDuringPage], func(t *testing.T) {
			entered := make(chan struct{})
			public := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/":
					if cancelDuringPage {
						close(entered)
						<-r.Context().Done()
						return
					}
					io.WriteString(w, publicPageFixture)
				case "/release.json":
					io.WriteString(w, publicReleaseFixture)
				case "/healthz":
					<-r.Context().Done()
				}
			}))
			defer public.Close()
			probe, _ := NewProbe("http://127.0.0.1/healthz", "", 500*time.Millisecond)
			probe.client = public.Client()
			probe.client.Timeout = 500 * time.Millisecond
			recorder := &publicRecordingTransport{base: probe.client.Transport}
			probe.client.Transport = recorder
			if err := probe.ConfigurePublicEndpoints(public.URL+"/release.json", public.URL+"/healthz"); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan string, 1)
			go func() { _, cause := probe.public.check(ctx, "abcdef1", "Alpha 1.79.8"); done <- cause }()
			if cancelDuringPage {
				select {
				case <-entered:
					cancel()
				case <-time.After(time.Second):
					t.Fatal("page never entered")
				}
			}
			select {
			case cause := <-done:
				expected := "public_probe_timeout"
				if cancelDuringPage {
					expected = "cancelled"
				}
				if cause != expected {
					t.Fatalf("wrong terminal cause %s", cause)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("public request did not stop")
			}
			recorder.mu.Lock()
			defer recorder.mu.Unlock()
			if !cancelDuringPage {
				if len(recorder.deadlines) != 3 || !recorder.deadlines[0].Equal(recorder.deadlines[1]) || !recorder.deadlines[0].Equal(recorder.deadlines[2]) {
					t.Fatal("public requests did not share one deadline")
				}
			}
		})
	}
}

func TestPublicMonitorLiveReadOnlyOptIn(t *testing.T) {
	if os.Getenv("EIDOLON_PUBLIC_MONITOR_QA") != "1" {
		t.Skip("requires explicit read-only live endpoint check")
	}
	probe, err := NewProbe("https://server.eidolonrealms.com/healthz", "", 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err := probe.ConfigurePublicEndpoints("https://play.eidolonrealms.com/release.json", "https://server.eidolonrealms.com/healthz"); err != nil {
		t.Fatal(err)
	}
	sample := probe.Check(context.Background())
	if !sample.Ready || sample.Public == nil || !sample.Public.IdentityMatch {
		t.Fatalf("live public readiness refused: %+v", sample)
	}
	t.Logf("read-only public URL readiness passed for %s / %s; same-host vantage, not off-machine/all-device coverage", sample.Version, sample.Commit)
}
