package main

import (
	"bytes"
	"compress/gzip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Execute the real helper with fake Docker/Mongo commands. No Docker socket,
// production credentials or database is used; this covers refusal and quoting,
// not the separate disposable Mongo round-trip integration check.
func TestRestoreArchiveRequiresExplicitStoppedTarget(t *testing.T) {
	script, err := os.ReadFile("deploy/restore_mongo_archive.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"success", "no-arguments", "no-confirmation", "no-privacy-plan", "unknown-privacy-plan", "unknown-replace-flag", "missing-archive", "bad-gzip", "missing-mongo", "mongo-lookup-failed", "running", "paused", "restarting", "created", "inspect-failed", "ambiguous-api", "api-lookup-failed", "missing-api", "missing-credentials", "probe-failed", "invalid-probe", "nonempty-target", "replace-target", "empty-dry-run-failed", "replace-dry-run-failed", "replace-drop-failed", "restore-failed", "verify-failed"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			for _, directory := range []string{"deploy", "bin"} {
				if err := os.Mkdir(filepath.Join(root, directory), 0700); err != nil {
					t.Fatal(err)
				}
			}
			files := map[string]string{
				"deploy/restore_mongo_archive.sh": string(script),
				".env":                            "touch env-executed\n", // Must be read by Compose, never sourced here.
				"bin/docker": `#!/bin/bash
set -eu
case "$*" in
  'compose ps --status running -q mongo')
    [ "$RESTORE_SCENARIO" != mongo-lookup-failed ] || exit 31
    [ "$RESTORE_SCENARIO" != missing-mongo ] || exit 0
    echo aaaaaaaaaaaa ;;
  'compose ps -a -q api')
    [ "$RESTORE_SCENARIO" != api-lookup-failed ] || exit 32
    [ "$RESTORE_SCENARIO" != missing-api ] || exit 0
    echo bbbbbbbbbbbb
    if [ "$RESTORE_SCENARIO" = ambiguous-api ]; then echo cccccccccccc; fi ;;
  'inspect --format {{.State.Status}} bbbbbbbbbbbb')
    [ "$RESTORE_SCENARIO" != inspect-failed ] || exit 33
    case "$RESTORE_SCENARIO" in
      running|paused|restarting|created) echo "$RESTORE_SCENARIO" ;;
      *) echo exited ;;
    esac ;;
  'compose exec -T mongo sh -c '*)
    if [ "$RESTORE_SCENARIO" = missing-credentials ]; then unset MONGO_INITDB_ROOT_PASSWORD; fi
    shift 4; exec "$@" ;;
  *) echo "unexpected Docker mutation/command: $*" >&2; exit 99 ;;
esac
`,
				"bin/mongorestore": `#!/bin/bash
case "$*" in
  *--dryRun*)
    printf '%s\n' "$@" > "$RESTORE_ROOT/dry-run-args"
    cat > "$RESTORE_ROOT/dry-run-bytes"
    case "$RESTORE_SCENARIO" in empty-dry-run-failed|replace-dry-run-failed) exit 22 ;; esac
    exit 0 ;;
esac
printf '%s\n' "$@" > "$RESTORE_ROOT/restore-args"
cat > "$RESTORE_ROOT/restored-bytes"
if [ "$RESTORE_SCENARIO" = restore-failed ]; then exit 23; fi
`,
				"bin/mongosh": `#!/bin/bash
case "$*" in
  *getCollectionInfos*)
    [ "$RESTORE_SCENARIO" != probe-failed ] || exit 21
    case "$RESTORE_SCENARIO" in
      invalid-probe) echo unknown ;;
      nonempty-target|replace-target|replace-dry-run-failed|replace-drop-failed) echo 2 ;;
      *) echo 0 ;;
    esac
    exit 0 ;;
  *dropDatabase*)
    touch "$RESTORE_ROOT/drop-attempted"
    [ "$RESTORE_SCENARIO" != replace-drop-failed ] || exit 27
    touch "$RESTORE_ROOT/dropped-eidolon"
    exit 0 ;;
esac
touch "$RESTORE_ROOT/verified"
if [ "$RESTORE_SCENARIO" = verify-failed ]; then exit 24; fi
`,
			}
			for name, content := range files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
					t.Fatal(err)
				}
			}
			// Spaces, quotes and shell metacharacters are archive data, not code.
			archive := filepath.Join(root, "snapshot ' ; touch filename-executed ; #.gz")
			var compressed bytes.Buffer
			writer := gzip.NewWriter(&compressed)
			if _, err := writer.Write([]byte("fixture archive bytes")); err != nil {
				t.Fatal(err)
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			payload := compressed.Bytes()
			if scenario == "bad-gzip" {
				payload = []byte("not gzip")
			}
			if scenario != "missing-archive" {
				if err := os.WriteFile(archive, payload, 0600); err != nil {
					t.Fatal(err)
				}
			}
			args := []string{filepath.Join(root, "deploy/restore_mongo_archive.sh"), archive, "--confirm-data-loss", "--confirm-privacy-and-journal-plan"}
			if scenario == "no-arguments" {
				args = args[:1]
			} else if scenario == "no-confirmation" {
				args = args[:2]
			} else if scenario == "no-privacy-plan" {
				args = args[:3]
			} else if scenario == "unknown-privacy-plan" {
				args[3] = "--skip-privacy-review"
			} else if strings.HasPrefix(scenario, "replace-") {
				args = append(args, "--replace-eidolon-database")
			} else if scenario == "unknown-replace-flag" {
				args = append(args, "--replace-any-database")
			}
			command := exec.Command("bash", args...)
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
				"RESTORE_ROOT="+root, "RESTORE_SCENARIO="+scenario,
				"MONGO_INITDB_ROOT_USERNAME=fixture", "MONGO_INITDB_ROOT_PASSWORD=not-a-live-secret")
			output, runErr := command.CombinedOutput()
			success := scenario == "success" || scenario == "missing-api" || scenario == "created" || scenario == "replace-target"
			if (runErr == nil) != success {
				t.Fatalf("unexpected result: %v\n%s", runErr, output)
			}
			for _, forbidden := range []string{"env-executed", "filename-executed"} {
				if _, err := os.Stat(filepath.Join(root, forbidden)); !os.IsNotExist(err) {
					t.Fatalf("executed untrusted file content/name: %s", forbidden)
				}
			}
			_, dropErr := os.Stat(filepath.Join(root, "drop-attempted"))
			shouldDrop := scenario == "replace-target" || scenario == "replace-drop-failed"
			if (dropErr == nil) != shouldDrop {
				t.Fatal("whole-database replacement bypassed explicit scope or dry-run refusal", scenario, dropErr)
			}
			restored, restoreErr := os.ReadFile(filepath.Join(root, "restored-bytes"))
			shouldRestore := success || scenario == "restore-failed" || scenario == "verify-failed"
			if !shouldRestore {
				if !os.IsNotExist(restoreErr) {
					t.Fatalf("refused preflight still reached restore: %v\n%s", restoreErr, output)
				}
				return
			}
			if restoreErr != nil || !bytes.Equal(restored, payload) {
				t.Fatalf("archive stream changed: %v\n%s", restoreErr, output)
			}
			dryRun, err := os.ReadFile(filepath.Join(root, "dry-run-bytes"))
			if err != nil || !bytes.Equal(dryRun, payload) {
				t.Fatal("accepted restore skipped unchanged archive preflight", err)
			}
			restoreArgs, err := os.ReadFile(filepath.Join(root, "restore-args"))
			if err != nil || !strings.Contains(string(restoreArgs), "--archive\n--nsInclude=eidolon.*\n--stopOnError\n") {
				t.Fatalf("missing stdin/namespace/error limits: %v %s", err, restoreArgs)
			}
			if scenario == "restore-failed" {
				if _, err := os.Stat(filepath.Join(root, "verified")); !os.IsNotExist(err) {
					t.Fatal("verification ran after failed restore")
				}
				if !strings.Contains(string(output), "may already have replaced or removed data") {
					t.Fatal("partial data-loss warning missing")
				}
			}
			if strings.Contains(string(output), "Mongo-only restore and verification complete") != success {
				t.Fatalf("incorrect success announcement: %s", output)
			}
		})
	}
}
