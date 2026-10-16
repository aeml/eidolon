package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

// Parse the real merged Compose files without creating containers or reading a
// deployment environment. Command replacement must retain every ordinary flag
// and must never alter Mongo's command, ports or persistence.
func TestInvitationGuardComposePreservesServiceConfiguration(t *testing.T) {
	docker, err := exec.LookPath("docker")
	if err != nil {
		t.Skip("Docker Compose parser unavailable")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
	defer cancel()
	if exec.CommandContext(ctx, docker, "compose", "version").Run() != nil {
		t.Skip("Docker Compose plugin unavailable")
	}
	root := t.TempDir()
	for _, dir := range []string{"logs", "deploy"} {
		if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"docker-compose.yml", "deploy/invitation-guard.compose.yml"} {
		data, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		dest := name
		if name != "docker-compose.yml" {
			dest = "logs/invitation-guard.compose.yml"
		}
		if err := os.WriteFile(filepath.Join(root, dest), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	names, _ := json.Marshal([]string{"O'Brien ${NOT_A_VARIABLE} `literal` 雨"})
	roster := base64.RawURLEncoding.EncodeToString(names)
	env := "MONGO_URI=mongodb://mongo:27017\nMONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nEIDOLON_INVITATION_ROSTER_BASE64=" + roster + "\n"
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte(env), 0600); err != nil {
		t.Fatal(err)
	}
	parse := func(files string) map[string]map[string]any {
		t.Helper()
		cmd := exec.CommandContext(ctx, docker, "compose", "config", "--format", "json")
		cmd.Dir = root
		cmd.Env = []string{"PATH=" + os.Getenv("PATH"), "COMPOSE_FILE=" + files}
		out, err := cmd.Output()
		if err != nil {
			t.Fatal("synthetic Compose parsing failed")
		}
		var cfg struct{ Services map[string]map[string]any }
		if json.Unmarshal(out, &cfg) != nil {
			t.Fatal("invalid Compose result")
		}
		return cfg.Services
	}
	ordinary := parse("docker-compose.yml")
	guarded := parse("docker-compose.yml:logs/invitation-guard.compose.yml")
	apiEnv := guarded["api"]["environment"].(map[string]any)
	if apiEnv["EIDOLON_INVITATION_ROSTER_BASE64"] != roster {
		t.Fatal("Compose changed encoded account names")
	}
	shell := exec.CommandContext(ctx, "bash", "-c", "source .env; printf '%s' \"$EIDOLON_INVITATION_ROSTER_BASE64\"")
	shell.Dir = root
	shell.Env = []string{"PATH=" + os.Getenv("PATH")}
	sourced, err := shell.Output()
	if err != nil || string(sourced) != roster {
		t.Fatal("shell changed encoded account names")
	}
	command, ok := guarded["api"]["command"].([]any)
	if !ok || len(command) == 0 || command[0] != "--require-invitation-admission" {
		t.Fatal("missing persistent admission flag")
	}
	if !reflect.DeepEqual(command[1:], ordinary["api"]["command"]) {
		t.Fatal("invitation guard drifted from ordinary API flags")
	}
	guarded["api"]["command"] = ordinary["api"]["command"]
	if !reflect.DeepEqual(ordinary, guarded) {
		t.Fatal("invitation guard altered unrelated service configuration")
	}
}
