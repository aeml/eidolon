package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeploymentPreservesActivityStorageAndCleanup(t *testing.T) {
	compose, err := os.ReadFile("docker-compose.yml")
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{"name: eidolon", "- mongo_data:/data/db", "- ./logs:/app/logs", "- --save-journal-dir=/app/logs/character-saves"} {
		if !strings.Contains(string(compose), required) {
			t.Fatal("deployment lost its stable database or activity journal mount", required)
		}
	}
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil || !strings.Contains(string(script), `git -C "${SERVER_DIR}" clean -fd -e logs/ -e .env`) || strings.Count(string(script), " clean ") != 1 {
		t.Fatal("deployment cleanup does not explicitly preserve persistent logs and environment", err)
	}
	root := t.TempDir()
	if output, err := exec.Command("git", "init", "--quiet", root).CombinedOutput(); err != nil {
		t.Fatal("could not create isolated cleanup fixture", err, string(output))
	}
	server := filepath.Join(root, "server")
	journal := filepath.Join(server, "logs", "character-saves", "admin-activity")
	if err := os.MkdirAll(journal, 0700); err != nil {
		t.Fatal(err)
	}
	// Deliberately no .gitignore: exclusion must survive a future ignore change.
	files := map[string]string{
		filepath.Join(journal, "pending.json"):      "synthetic pending activity",
		filepath.Join(server, "logs", "server.log"): "synthetic historical service log",
		filepath.Join(server, ".env"):               "synthetic environment",
	}
	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	stale := filepath.Join(server, "stale-build-fixture")
	if err := os.WriteFile(stale, []byte("untracked disposable build file"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := exec.Command("git", "-C", server, "clean", "-fd", "-e", "logs/", "-e", ".env").CombinedOutput(); err != nil {
		t.Fatal("isolated deployment cleanup failed", err)
	}
	for path, expected := range files {
		actual, err := os.ReadFile(path)
		if err != nil || string(actual) != expected {
			t.Fatal("deployment cleanup removed or changed durable activity/log/environment data", err)
		}
	}
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Fatal("disposable untracked build artifact was not cleaned")
	}
}
