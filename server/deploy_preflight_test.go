package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Exercise the real deployment script with fake external commands. These tests
// prove sequencing and fail-closed behavior, not Docker or Mongo availability.
func TestDeploySchemaPreflightPrecedesLiveReplacement(t *testing.T) {
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"compatible", "future-schema", "database-unavailable"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			for _, dir := range []string{"deploy", "bin"} {
				if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			files := map[string]string{
				"deploy/deploy_linux.sh": string(script),
				".env":                   "MONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://fixture\n",
				"bin/git":                "#!/bin/sh\nexit 1\n",
				"bin/curl":               "#!/bin/sh\nprintf '%s' '{\"commit\":\"fixture-commit\",\"database\":\"ready\"}'\n",
				"bin/docker": `#!/bin/bash
printf '%s\n' "$*" >> "$PREFLIGHT_COMMANDS"
case "$*" in
  'compose up -d --no-recreate --wait mongo')
    if [ "$PREFLIGHT_SCENARIO" = database-unavailable ]; then exit 1; fi ;;
  'compose run --rm --no-deps -T api --check-schema --mongo-uri=mongodb://fixture')
    if [ "$PREFLIGHT_SCENARIO" = future-schema ]; then exit 1; fi ;;
  'compose up -d') printf '%s' replaced > "$PREFLIGHT_LIVE_STATE" ;;
esac
`,
				"live-state": "healthy-previous-release",
			}
			for name, content := range files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
					t.Fatal(err)
				}
			}
			commandsPath := filepath.Join(root, "commands")
			command := exec.Command("bash", filepath.Join(root, "deploy/deploy_linux.sh"))
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
				"PREFLIGHT_COMMANDS="+commandsPath, "PREFLIGHT_SCENARIO="+scenario,
				"PREFLIGHT_LIVE_STATE="+filepath.Join(root, "live-state"), "EIDOLON_BUILD_COMMIT=fixture-commit", "CLEAN_SERVER_TREE=false")
			output, runErr := command.CombinedOutput()
			commands, err := os.ReadFile(commandsPath)
			if err != nil {
				t.Fatal(err, string(output))
			}
			state, err := os.ReadFile(filepath.Join(root, "live-state"))
			if err != nil {
				t.Fatal(err)
			}
			if scenario != "compatible" {
				if runErr == nil || string(state) != "healthy-previous-release" || strings.Contains(string(commands), "compose up -d\n") {
					t.Fatalf("failed preflight replaced live API: %v\n%s\n%s", runErr, commands, output)
				}
				return
			}
			if runErr != nil || string(state) != "replaced" {
				t.Fatalf("compatible deployment failed: %v\n%s", runErr, output)
			}
			expected := "compose build api\ncompose up -d --no-recreate --wait mongo\ncompose run --rm --no-deps -T api --check-schema --mongo-uri=mongodb://fixture\ncompose up -d\n"
			if !strings.Contains(string(commands), expected) {
				t.Fatalf("deployment did not preflight before replacement:\n%s", commands)
			}
		})
	}
}
