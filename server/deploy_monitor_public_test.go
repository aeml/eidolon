package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Parse actual Compose with only disposable synthetic configuration, then run
// its exact monitor arguments through a real binary in local-only check mode.
// No containers, service changes, database, production env or mail requests.
func TestManagedMonitorPublicConfiguration(t *testing.T) {
	docker, err := exec.LookPath("docker")
	if err != nil {
		t.Skip("Docker Compose parser is unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if exec.CommandContext(ctx, docker, "compose", "version").Run() != nil {
		t.Skip("Docker Compose plugin is unavailable")
	}
	compose, err := os.ReadFile("docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	binary := filepath.Join(root, "monitor")
	buildCtx, buildCancel := context.WithTimeout(context.Background(), time.Minute)
	defer buildCancel()
	if exec.CommandContext(buildCtx, "go", "build", "-o", binary, "./cmd/monitor").Run() != nil {
		t.Fatal("disposable monitor build failed")
	}
	for _, tc := range []struct {
		name, frontend, backend string
		valid                   bool
	}{
		{"local-unset", "", "", true},
		{"local-only", "", "", true},
		{"paired", "https://frontend.example.invalid/release.json", "https://backend.example.invalid/healthz", true},
		{"frontend-only", "https://frontend.example.invalid/release.json", "", false},
		{"backend-only", "", "https://backend.example.invalid/healthz", false},
		{"insecure", "http://frontend.example.invalid/release.json", "https://backend.example.invalid/healthz", false},
		{"credentials", "https://frontend.example.invalid/release.json", "https://synthetic-private-user:secret@backend.example.invalid/healthz", false},
		{"query", "https://frontend.example.invalid/release.json?synthetic-private-value", "https://backend.example.invalid/healthz", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fixture := t.TempDir()
			if err := os.WriteFile(filepath.Join(fixture, "docker-compose.yml"), compose, 0600); err != nil {
				t.Fatal(err)
			}
			env := "APP_HOST_PORT=1\nMONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://mongo:27017\nPOSTMARK_SERVER_TOKEN=synthetic-private-token\nPOSTMARK_FROM_EMAIL=monitor@example.invalid\nPOSTMARK_MESSAGE_STREAM=outbound\nADMIN_NOTIFICATION_EMAILS=owner@example.invalid\n"
			if tc.name != "local-unset" {
				env += "EIDOLON_MONITOR_PUBLIC_FRONTEND_URL=" + tc.frontend + "\nEIDOLON_MONITOR_PUBLIC_BACKEND_URL=" + tc.backend + "\n"
			}
			if err := os.WriteFile(filepath.Join(fixture, ".env"), []byte(env), 0600); err != nil {
				t.Fatal(err)
			}
			parseCtx, parseCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer parseCancel()
			command := exec.CommandContext(parseCtx, docker, "compose", "--profile", "operations", "config", "--format", "json")
			command.Dir = fixture
			command.Env = []string{"PATH=" + os.Getenv("PATH")}
			output, err := command.Output()
			if err != nil {
				t.Fatal("synthetic Compose parsing failed") // Never dump config.
			}
			var config struct {
				Services map[string]struct {
					Command     []string
					Environment map[string]string
				}
			}
			if json.Unmarshal(output, &config) != nil {
				t.Fatal("invalid synthetic Compose output")
			}
			monitor := config.Services["monitor"]
			args := strings.Join(monitor.Command, "\n")
			for _, required := range []string{"--health-url=http://127.0.0.1:1/healthz", "--public-frontend-url=" + tc.frontend,
				"--public-backend-url=" + tc.backend, "--poll-interval=30s", "--failure-threshold=3", "--recovery-threshold=2",
				"--notice-cooldown=30m", "--mail-timeout=10s", "--mail-min-interval=1m"} {
				if !strings.Contains(args, required+"\n") && !strings.HasSuffix(args, required) {
					t.Fatal("managed command omitted a configured endpoint or approved policy")
				}
			}
			checkCtx, checkCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer checkCancel()
			check := exec.CommandContext(checkCtx, binary, monitor.Command...)
			check.Env = []string{"EIDOLON_MONITOR_CHECK_CONFIG=true"}
			for key, value := range monitor.Environment {
				check.Env = append(check.Env, key+"="+value)
			}
			result, checkErr := check.CombinedOutput()
			if (checkErr == nil) != tc.valid || strings.Contains(string(result), "synthetic-private") || tc.valid && len(result) != 0 {
				t.Fatal("unsafe managed monitor configuration admission")
			}
			if !tc.valid && !strings.Contains(string(result), "invalid bounded public monitor configuration") {
				t.Fatal("configuration rejected for the wrong cause")
			}
		})
	}
}
