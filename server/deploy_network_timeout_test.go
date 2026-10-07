package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestDeployHealthRealStalledResponseTimesOutAndRetries(t *testing.T) {
	realCurl, err := exec.LookPath("curl")
	if err != nil {
		t.Skip("curl required for loopback timeout check")
	}
	var calls atomic.Int32
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			// Safety fallback also bounds a regressed helper lacking curl timeouts.
			select {
			case <-r.Context().Done():
			case <-time.After(12 * time.Second):
				w.WriteHeader(http.StatusGatewayTimeout)
			}
			return
		}
		fmt.Fprint(w, `{"commit":"fixture-commit","database":"ready"}`)
	}))
	defer origin.Close()
	root := t.TempDir()
	for _, name := range []string{"deploy", "bin"} {
		if err := os.Mkdir(filepath.Join(root, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"deploy/deploy_linux.sh":       string(script),
		"deploy/pin_previous_image.sh": "#!/bin/sh\nexit 0\n",
		".env":                         "MONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://mongo:27017\nAPP_HOST_PORT=" + strings.TrimPrefix(origin.URL, "http://127.0.0.1:") + "\n",
		"bin/git":                      "#!/bin/sh\nexit 1\n", "bin/sleep": "#!/bin/sh\nexit 0\n",
		"bin/docker": `#!/bin/sh
case "$*" in
  *--check-schema*) echo 'Schema preflight passed: database=24 supported=24 commit=fixture-commit' ;;
esac
exit 0
`,
		"bin/curl": "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$NETWORK_COMMANDS\"\nexec \"$REAL_CURL\" \"$@\"\n",
	}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(root, name), []byte(data), 0700); err != nil {
			t.Fatal(err)
		}
	}
	installDeploymentStorageFixture(t, root)
	ctx, stop := context.WithTimeout(t.Context(), 20*time.Second)
	defer stop()
	cmd := exec.CommandContext(ctx, "bash", filepath.Join(root, "deploy/deploy_linux.sh"))
	cmd.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"), "EIDOLON_BUILD_COMMIT=fixture-commit",
		"REAL_CURL="+realCurl, "NETWORK_COMMANDS="+filepath.Join(root, "requests"), "CLEAN_SERVER_TREE=false")
	started := time.Now()
	output, err := cmd.CombinedOutput()
	elapsed := time.Since(started)
	if err != nil || calls.Load() != 2 || !strings.Contains(string(output), "Deployment complete.") || elapsed < 4*time.Second || elapsed > 10*time.Second {
		t.Fatalf("stalled real health request did not time out and recover: calls=%d elapsed=%s err=%v output=%s", calls.Load(), elapsed, err, output)
	}
	requests, err := os.ReadFile(filepath.Join(root, "requests"))
	if err != nil || strings.Count(string(requests), "--connect-timeout 2 --max-time 5") != 2 {
		t.Fatal("real health retries lost their connect/response deadlines", err)
	}
	t.Logf("real response stall timed out and second health request passed in %s", elapsed)
}

func TestLiveReleaseWorkflowBoundsEveryProbeAndRejectsMismatches(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("Node required for actual workflow JSON parsing")
	}
	workflow, err := os.ReadFile("../.github/workflows/ci.yml")
	if err != nil {
		t.Fatal(err)
	}
	_, section, found := strings.Cut(string(workflow), "      - name: Wait for matching live releases\n")
	if !found {
		t.Fatal("live release wait step missing")
	}
	section, _, _ = strings.Cut(section, "\n      - name:")
	_, body, found := strings.Cut(section, "        run: |\n")
	if !found || !strings.Contains(section, "timeout-minutes: 6") {
		t.Fatal("live release step lost its executable wait or outer time limit")
	}
	var shell strings.Builder
	for _, line := range strings.Split(body, "\n") {
		shell.WriteString(strings.TrimPrefix(line, "          ") + "\n")
	}
	for _, mode := range []string{"ready", "client", "runtime", "server", "malformed", "timeout"} {
		t.Run(mode, func(t *testing.T) {
			root := t.TempDir()
			fakeCurl := `#!/bin/bash
printf '%s\n' "$*" >> "$NETWORK_COMMANDS"
[[ "$*" = *'--connect-timeout 2 --max-time 5'* ]] || exit 99
if [ "$NETWORK_MODE" = timeout ]; then exit 28; fi
value=fixture-commit
case "${!#}" in
  *release.json*)
    if [ "$NETWORK_MODE" = client ]; then value=wrong-client; fi
    if [ "$NETWORK_MODE" = malformed ]; then echo '{'; exit 0; fi ;;
  *healthz*) if [ "$NETWORK_MODE" = server ]; then value=wrong-server; fi ;;
  *)
    if [ "$NETWORK_MODE" = runtime ]; then value=wrong-runtime; fi
    printf '<script src="./src/main.js?release=%s"></script>\n' "$value"
    exit 0 ;;
esac
printf '{"commit":"%s"}\n' "$value"
`
			if err := os.WriteFile(filepath.Join(root, "curl"), []byte(fakeCurl), 0700); err != nil {
				t.Fatal(err)
			}
			ctx, stop := context.WithTimeout(t.Context(), 10*time.Second)
			defer stop()
			// Advance Bash's own elapsed clock at the retry boundary. This models
			// deadline expiration, without making the test wait five minutes.
			cmd := exec.CommandContext(ctx, "bash", "-c", "set -euo pipefail\nsleep() { SECONDS=$((SECONDS + 301)); }\n"+shell.String())
			cmd.Env = append(os.Environ(), "PATH="+root+":"+os.Getenv("PATH"), "NETWORK_MODE="+mode, "NETWORK_COMMANDS="+filepath.Join(root, "requests"),
				"EXPECTED_COMMIT=fixture-commit", "EIDOLON_E2E_BASE_URL=https://fixture.invalid", "EIDOLON_E2E_HEALTH_URL=https://fixture.invalid/healthz")
			output, runErr := cmd.CombinedOutput()
			ready := mode == "ready"
			if (runErr == nil) != ready || !ready && !strings.Contains(string(output), "Live release mismatch:") {
				t.Fatalf("workflow readiness/deadline boundary failed: %v %s", runErr, output)
			}
			requests, err := os.ReadFile(filepath.Join(root, "requests"))
			want := 6 // Two batches before the advanced clock ends the wait.
			if ready {
				want = 3
			}
			if err != nil || strings.Count(string(requests), "--connect-timeout 2 --max-time 5") != want || strings.Count(string(requests), "Cache-Control: no-cache") != want {
				t.Fatal("workflow probe was unbounded or lost its cache-bypass contract", err, string(requests))
			}
		})
	}
}
