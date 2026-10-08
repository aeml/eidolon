package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeployMonitorPublicProbeComposeConfiguration(t *testing.T) {
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("Docker Compose parser unavailable")
	}
	composeSource, err := os.ReadFile("docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []struct{ name, port, health, frontend, expectedHealth string }{
		{name: "default", expectedHealth: "http://127.0.0.1:18082/healthz"},
		{name: "custom-loopback", port: "18884", expectedHealth: "http://127.0.0.1:18884/healthz"},
		{name: "public", port: "18884", health: "https://server.eidolonrealms.com/healthz", frontend: "https://play.eidolonrealms.com/release.json", expectedHealth: "https://server.eidolonrealms.com/healthz"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			root := t.TempDir()
			composePath := filepath.Join(root, "docker-compose.yml")
			if err := os.WriteFile(composePath, composeSource, 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, ".env"), nil, 0600); err != nil {
				t.Fatal(err)
			}
			command := exec.Command("docker", "compose", "--profile", "operations", "--env-file", "/dev/null", "-f", composePath, "config", "--format", "json")
			// Parse only; no daemon/service call or production .env/credentials.
			command.Env = []string{"PATH=" + os.Getenv("PATH"), "DOCKER_CONFIG=" + t.TempDir(), "COMPOSE_DISABLE_ENV_FILE=true", "MONGO_URI=mongodb://mongo:27017", "MONGO_INITDB_ROOT_USERNAME=fixture", "MONGO_INITDB_ROOT_PASSWORD=fixture", "APP_HOST_PORT=" + scenario.port, "EIDOLON_MONITOR_HEALTH_URL=" + scenario.health, "EIDOLON_MONITOR_FRONTEND_RELEASE_URL=" + scenario.frontend}
			output, err := command.Output()
			if err != nil {
				t.Fatal("Compose configuration parsing failed", err)
			}
			var config struct {
				Services map[string]struct{ Command []string }
			}
			if json.Unmarshal(output, &config) != nil {
				t.Fatal("invalid Compose JSON")
			}
			args := config.Services["monitor"].Command
			contains := func(value string) bool {
				for _, arg := range args {
					if arg == value {
						return true
					}
				}
				return false
			}
			if !contains("--health-url="+scenario.expectedHealth) || !contains("--frontend-release-url="+scenario.frontend) {
				t.Fatal("monitor public opt-in/default configuration differs", args)
			}
			for _, setting := range []string{"--poll-interval=30s", "--failure-threshold=3", "--recovery-threshold=2", "--notice-cooldown=30m"} {
				if !contains(setting) {
					t.Fatal("owner-approved alert thresholds changed")
				}
			}
		})
	}
}

// Real deployment script with isolated fake external commands. No Docker,
// database, production configuration, provider or service is changed here.
func TestDeployMonitorOptInAndValidationBeforeAPIReplacement(t *testing.T) {
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"disabled", "enabled", "invalid-opt-in", "build-failed", "validation-failed", "start-failed"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			for _, dir := range []string{"bin", "deploy"} {
				if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			optIn := "true"
			if scenario == "disabled" {
				optIn = "false"
			}
			if scenario == "invalid-opt-in" {
				optIn = "synthetic-private-invalid"
			}
			files := map[string]string{
				"deploy/deploy_linux.sh":       string(script),
				"deploy/pin_previous_image.sh": "#!/bin/sh\nexit 0\n",
				".env":                         "MONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://mongo:27017\nEIDOLON_MONITOR_ENABLED=" + optIn + "\n",
				"bin/git":                      "#!/bin/sh\nexit 1\n",
				"bin/curl":                     "#!/bin/sh\nprintf '%s' '{\"commit\":\"fixture-commit\",\"database\":\"ready\"}'\n",
				"bin/docker": `#!/bin/sh
printf '%s\n' "$*" >> "$MONITOR_COMMANDS"
case "$*" in
  'compose --profile operations build monitor') [ "$MONITOR_SCENARIO" != build-failed ] || exit 1 ;;
  'compose --profile operations run --rm --no-deps -T -e EIDOLON_MONITOR_CHECK_CONFIG=true monitor') [ "$MONITOR_SCENARIO" != validation-failed ] || exit 1 ;;
  'compose --profile operations up -d --no-deps monitor') [ "$MONITOR_SCENARIO" != start-failed ] || exit 1 ;;
  'compose run --rm --no-deps -T api --check-schema --mongo-uri=mongodb://mongo:27017') echo 'Schema preflight passed: database=25 supported=25 commit=fixture-commit' ;;
esac
exit 0
`,
			}
			for name, content := range files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
					t.Fatal(err)
				}
			}
			installDeploymentStorageFixture(t, root)
			commandsPath := filepath.Join(root, "commands")
			command := exec.Command("bash", filepath.Join(root, "deploy/deploy_linux.sh"))
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"), "MONITOR_COMMANDS="+commandsPath, "MONITOR_SCENARIO="+scenario, "EIDOLON_BUILD_COMMIT=fixture-commit", "CLEAN_SERVER_TREE=false")
			output, runErr := command.CombinedOutput()
			commands, readErr := os.ReadFile(commandsPath)
			if readErr != nil {
				t.Fatal(readErr)
			}
			text := string(commands)
			replaced := strings.Contains(text, "compose up -d\n")
			started := strings.Contains(text, "compose --profile operations up -d --no-deps monitor\n")
			if scenario == "enabled" || scenario == "disabled" {
				if runErr != nil || !replaced {
					t.Fatalf("valid deployment failed: %v\n%s", runErr, output)
				}
			} else if runErr == nil {
				t.Fatal("invalid deployment succeeded")
			}
			if scenario == "invalid-opt-in" || scenario == "build-failed" || scenario == "validation-failed" {
				if replaced || started {
					t.Fatal("failed monitor preflight changed live services")
				}
			}
			if scenario == "disabled" && strings.Contains(text, "operations") {
				t.Fatal("disabled monitoring had side effects")
			}
			if scenario == "enabled" || scenario == "start-failed" {
				validation := strings.Index(text, "-e EIDOLON_MONITOR_CHECK_CONFIG=true monitor\n")
				apiStart := strings.Index(text, "compose up -d\n")
				monitorStart := strings.Index(text, "compose --profile operations up -d --no-deps monitor\n")
				if validation < 0 || apiStart <= validation || monitorStart <= apiStart {
					t.Fatal("monitor validation/start order is unsafe")
				}
			}
		})
	}
}
