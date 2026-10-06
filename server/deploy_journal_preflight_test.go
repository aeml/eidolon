package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeployJournalUpgradeChecksDrainedVolumeAndRestartsPreviousOnRefusal(t *testing.T) {
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"valid", "legacy", "noisy", "wrong-build", "wrong-format", "already-stopped", "fresh", "bad-container"} {
		t.Run(kind, func(t *testing.T) {
			root := t.TempDir()
			for _, name := range []string{"deploy", "bin"} {
				if err := os.Mkdir(filepath.Join(root, name), 0700); err != nil {
					t.Fatal(err)
				}
			}
			files := map[string]string{
				"deploy/deploy_linux.sh":       string(script),
				"deploy/pin_previous_image.sh": "#!/bin/sh\nexit 0\n",
				"deploy/backup_before_upgrade.sh": `#!/bin/sh
echo backup >> "$JOURNAL_COMMANDS"
echo stopped > "$JOURNAL_LIVE"
echo preserved-backup > "$JOURNAL_BACKUP"
`,
				".env":     "MONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://mongo:27017\n",
				"bin/git":  "#!/bin/sh\nexit 1\n",
				"bin/curl": "#!/bin/sh\necho '{\"commit\":\"fixture-commit\",\"database\":\"ready\"}'\n",
				"bin/docker": `#!/bin/bash
echo "$*" >> "$JOURNAL_COMMANDS"
case "$*" in
  *--check-schema*) echo 'Schema preflight passed: database=22 supported=23 commit=fixture-commit' ;;
  'compose ps -a -q api')
    case "$JOURNAL_KIND" in
      fresh) ;;
      bad-container) echo 'ambiguous container' ;;
      *) echo aaaaaaaaaaaa ;;
    esac ;;
  "inspect --format {{.State.Running}} aaaaaaaaaaaa")
    if [ "$JOURNAL_KIND" = already-stopped ]; then echo false; else echo true; fi ;;
  *--check-save-journal*)
    [[ "$*" = *"/logs:/app/logs:ro"* ]] || exit 91
    [[ "$*" = *"--save-journal-dir=/app/logs/character-saves"* ]] || exit 92
    case "$JOURNAL_KIND" in
      legacy|already-stopped) exit 1 ;;
      noisy) echo noise; echo 'Character journal preflight passed: supported=2 commit=fixture-commit' ;;
      wrong-build) echo 'Character journal preflight passed: supported=2 commit=foreign-commit' ;;
      wrong-format) echo 'Character journal preflight passed: supported=1 commit=fixture-commit' ;;
      *) echo 'Character journal preflight passed: supported=2 commit=fixture-commit' ;;
    esac ;;
  'start aaaaaaaaaaaa') echo healthy-previous > "$JOURNAL_LIVE" ;;
  'compose up -d') echo replaced > "$JOURNAL_LIVE" ;;
esac
`,
				"live": "healthy-previous\n",
			}
			if kind == "already-stopped" {
				files["live"] = "stopped\n"
			}
			for name, content := range files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
					t.Fatal(err)
				}
			}
			command := exec.Command("bash", filepath.Join(root, "deploy/deploy_linux.sh"))
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
				"JOURNAL_KIND="+kind, "JOURNAL_COMMANDS="+filepath.Join(root, "commands"),
				"JOURNAL_LIVE="+filepath.Join(root, "live"), "JOURNAL_BACKUP="+filepath.Join(root, "backup"),
				"EIDOLON_BUILD_COMMIT=fixture-commit", "CLEAN_SERVER_TREE=false")
			output, runErr := command.CombinedOutput()
			commands, _ := os.ReadFile(filepath.Join(root, "commands"))
			state, _ := os.ReadFile(filepath.Join(root, "live"))
			valid := kind == "valid" || kind == "fresh"
			if (runErr == nil) != valid {
				t.Fatalf("upgrade %s: %v %s", kind, runErr, output)
			}
			if valid {
				if string(state) != "replaced\n" {
					t.Fatal("valid target was not started")
				}
			} else if strings.Contains(string(commands), "compose up -d\n") {
				t.Fatal("rejected journal replaced old writer", string(commands))
			} else if kind == "already-stopped" {
				if string(state) != "stopped\n" || strings.Contains(string(commands), "start aaaaaaaaaaaa") {
					t.Fatal("started a previously stopped service")
				}
			} else if string(state) != "healthy-previous\n" {
				t.Fatal("unchanged previous release not recovered", string(commands), string(output))
			}
			if kind == "bad-container" {
				if strings.Contains(string(commands), "backup\n") {
					t.Fatal("ambiguous previous container was stopped")
				}
				return
			}
			backup, err := os.ReadFile(filepath.Join(root, "backup"))
			if err != nil || string(backup) != "preserved-backup\n" {
				t.Fatal("transition did not preserve backup", err)
			}
			backupAt, checkAt := strings.Index(string(commands), "backup\n"), strings.Index(string(commands), "--check-save-journal")
			if backupAt < 0 || checkAt <= backupAt {
				t.Fatal("journal check ran before old-writer drain", string(commands))
			}
		})
	}
}
