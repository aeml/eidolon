package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Real deployment script with isolated fake external commands. No Docker,
// database, production configuration, provider or service is changed here.
func TestDeployMonitorOptInAndValidationBeforeAPIReplacement(t *testing.T) {
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"disabled", "disabled-public-invalid", "enabled", "invalid-opt-in", "build-failed", "validation-failed", "start-failed"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			for _, dir := range []string{"bin", "deploy"} {
				if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			optIn := "true"
			if strings.HasPrefix(scenario, "disabled") {
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
			if scenario == "disabled-public-invalid" {
				files[".env"] += "EIDOLON_MONITOR_PUBLIC_FRONTEND_URL=synthetic-private-invalid\nEIDOLON_MONITOR_PUBLIC_BACKEND_URL=\n"
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
			if scenario == "enabled" || strings.HasPrefix(scenario, "disabled") {
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
			if strings.HasPrefix(scenario, "disabled") && strings.Contains(text, "operations") {
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
