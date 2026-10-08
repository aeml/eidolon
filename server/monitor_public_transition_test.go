package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"eidolon-server/internal/operations"
)

// Exercise the compiled command, ordinary certificate verification, release
// turnover and a fresh process. All services/data are local synthetic fixtures;
// Postmark is not enabled, and no production configuration is read or changed.
func TestMonitorPublicReleaseTransitionAndRestart(t *testing.T) {
	root := t.TempDir()
	binary := filepath.Join(root, "monitor")
	buildCtx, buildCancel := context.WithTimeout(context.Background(), time.Minute)
	defer buildCancel()
	if exec.CommandContext(buildCtx, "go", "build", "-o", binary, "./cmd/monitor").Run() != nil {
		t.Fatal("disposable monitor build failed")
	}
	identities := []struct{ commit, version string }{
		{"abcdef1", "Alpha 1.79.12"}, {"abcdef2", "Alpha 1.79.13"}, {"abcdef3", "Alpha 1.79.14"},
	}
	var phase, generation, failedPolls, recoveredPolls atomic.Int32
	identity := func(next bool) (string, string) {
		index := int(generation.Load())
		if next {
			index++
		}
		return identities[index].commit, identities[index].version
	}
	fixtureHealth := func(w http.ResponseWriter, local bool) {
		current := phase.Load()
		if local && current == 1 {
			failedPolls.Add(1)
		}
		if local && current == 2 {
			recoveredPolls.Add(1)
		}
		commit, version := identity(current == 2)
		fmt.Fprintf(w, `{"status":"ok","database":"ready","commit":%q,"version":%q,"private":"synthetic-private-body"}`, commit, version)
	}
	local := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { fixtureHealth(w, true) }))
	defer local.Close()
	public := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			fmt.Fprint(w, `<div id="start-screen"><button id="btn-login">Login</button></div>`)
		case "/release.json":
			commit, version := identity(phase.Load() != 0)
			fmt.Fprintf(w, `{"commit":%q,"version":%q,"private":"synthetic-private-body"}`, commit, version)
		case "/healthz":
			fixtureHealth(w, false)
		default:
			http.NotFound(w, r)
		}
	}))
	defer public.Close()
	trust := filepath.Join(root, "fixture-ca.pem")
	if os.WriteFile(trust, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: public.Certificate().Raw}), 0600) != nil {
		t.Fatal("local trust fixture unavailable")
	}
	args := []string{"--health-url=" + local.URL + "/healthz", "--public-frontend-url=" + public.URL + "/release.json",
		"--public-backend-url=" + public.URL + "/healthz", "--request-timeout=1s", "--poll-interval=1s",
		"--failure-threshold=3", "--recovery-threshold=2", "--notice-cooldown=30m"}
	for run := 0; run < 2; run++ {
		t.Run(fmt.Sprintf("process-%d", run), func(t *testing.T) {
			previous, nextRelease := identities[run], identities[run+1]
			generation.Store(int32(run))
			failedPolls.Store(0)
			recoveredPolls.Store(0)
			phase.Store(1) // Frontend published first; API still serves old release.
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			command := exec.CommandContext(ctx, binary, args...)
			// Isolate trust/config: retain normal TLS verification, no insecure
			// client, proxy, credentials, private env or mail opt-in.
			command.Env = []string{"PATH=" + os.Getenv("PATH"), "SSL_CERT_FILE=" + trust, "SSL_CERT_DIR=" + root}
			var stderr bytes.Buffer
			command.Stderr = &stderr
			stdout, err := command.StdoutPipe()
			if err != nil || command.Start() != nil {
				t.Fatal("disposable monitor start failed")
			}
			events := make(chan operations.Event, 3)
			scanned := make(chan error, 1)
			go func() {
				scanner := bufio.NewScanner(stdout)
				for scanner.Scan() {
					var event operations.Event
					if strings.Contains(scanner.Text(), "synthetic-private") || json.Unmarshal(scanner.Bytes(), &event) != nil {
						scanned <- fmt.Errorf("monitor emitted invalid or private output")
						return
					}
					events <- event
				}
				scanned <- scanner.Err()
			}()
			// Always reap this test-owned child, including assertion failures.
			defer func() {
				_ = command.Process.Signal(syscall.SIGTERM)
				select {
				case err := <-scanned:
					if err != nil {
						t.Error("monitor output scan failed")
					}
				case <-ctx.Done():
					t.Error("monitor did not shut down within the test deadline")
				}
				if command.Wait() != nil || stderr.Len() != 0 {
					t.Error("monitor did not exit cleanly and silently")
				}
			}()
			next := func() operations.Event {
				select {
				case event := <-events:
					return event
				case <-ctx.Done():
					t.Fatal("monitor incident transition timed out")
					return operations.Event{}
				}
			}
			outage := next()
			if outage.Notice.Kind != "outage" || outage.Sample.Cause != "public_release_mismatch" ||
				outage.Sample.Ready || outage.Sample.Commit != previous.commit || failedPolls.Load() != 3 ||
				outage.Sample.Public == nil || !outage.Sample.Public.FrontendReady || !outage.Sample.Public.BackendReady || outage.Sample.Public.IdentityMatch {
				t.Fatal("release turnover did not produce one correctly debounced mismatch incident")
			}
			phase.Store(2) // API replacement completes; all three identities agree.
			recovery := next()
			if recovery.Notice.Kind != "recovered" || !recovery.Sample.Ready ||
				recovery.Sample.Commit != nextRelease.commit || recovery.Sample.Version != nextRelease.version || recoveredPolls.Load() != 2 ||
				recovery.Sample.Public == nil || !recovery.Sample.Public.IdentityMatch {
				t.Fatal("release recovery did not follow two matching public/local samples")
			}
			if outage.Delivery != "" || recovery.Delivery != "" || len(events) != 0 {
				t.Fatal("unexpected notification or duplicate incident")
			}
		})
	}
}
