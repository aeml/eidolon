package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// This opts into an owned Compose project, never the production project. The
// API is a small writer stand-in: this proves backup/restore and failure ordering,
// not game shutdown or journal replay (covered by actual resource-session tests).
func TestDeployUpgradeBackupPreservesPrivateStateAndRestartsOnFailure(t *testing.T) {
	if os.Getenv("EIDOLON_DEPLOY_BACKUP_DISPOSABLE") != "1" {
		t.Skip("requires explicitly disposable Docker backup/restore verification")
	}
	script, err := os.ReadFile("deploy/backup_before_upgrade.sh")
	if err != nil {
		t.Fatal(err)
	}
	pinScript, err := os.ReadFile("deploy/pin_previous_image.sh")
	if err != nil {
		t.Fatal(err)
	}
	dockerPath, err := exec.LookPath("docker")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	project := fmt.Sprintf("eidolon-backup-proof-%d", time.Now().UnixNano())
	t.Logf("owned_backup_project=%s root=%s", project, root)
	for _, dir := range []string{"deploy", "logs", "logs/character-saves", "bin"} {
		if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	journal := []byte("private pending snapshot fixture: health=17 mana=0 gold=1184\n")
	files := map[string][]byte{
		"deploy/backup_before_upgrade.sh":   script,
		"deploy/pin_previous_image.sh":      pinScript,
		"logs/character-saves/pending.json": journal,
		"compose.yml": []byte(fmt.Sprintf(`name: %s
services:
  mongo:
    image: mongo:7.0.14
    environment:
      MONGO_INITDB_ROOT_USERNAME: backup_fixture
      MONGO_INITDB_ROOT_PASSWORD: disposable_backup_fixture
    volumes: [mongo_data:/data/db]
    healthcheck:
      test: [CMD-SHELL, "test \"$$(cat /proc/1/comm)\" = mongod && mongosh --quiet --eval 'db.runCommand({ping: 1}).ok'"]
      interval: 1s
      timeout: 5s
      retries: 40
  restore:
    image: mongo:7.0.14
    environment:
      MONGO_INITDB_ROOT_USERNAME: backup_fixture
      MONGO_INITDB_ROOT_PASSWORD: disposable_backup_fixture
    volumes: [restore_data:/data/db]
    healthcheck:
      test: [CMD-SHELL, "test \"$$(cat /proc/1/comm)\" = mongod && mongosh --quiet --eval 'db.runCommand({ping: 1}).ok'"]
      interval: 1s
      timeout: 5s
      retries: 40
  api:
    image: %s:current
    volumes: [./logs:/app/logs]
    command: [sh, -c, "trap 'exit 0' TERM; chown 65532:65532 /app/logs/character-saves/pending.json; while :; do sleep 1 & wait $$!; done"]
volumes:
  mongo_data:
  restore_data:
`, project, project)),
		"bin/docker": []byte(`#!/bin/sh
case "$*" in
  *mongodump*) if [ "$BACKUP_TEST_REJECT_DUMP" = 1 ]; then echo 'owned injected dump failure' >&2; exit 1; fi ;;
esac
exec "$BACKUP_TEST_REAL_DOCKER" "$@"
`),
	}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(root, name), data, 0700); err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	env := append(os.Environ(), "COMPOSE_PROJECT_NAME="+project, "COMPOSE_FILE="+filepath.Join(root, "compose.yml"))
	run := func(input io.Reader, args ...string) []byte {
		t.Helper()
		command := exec.CommandContext(ctx, dockerPath, args...)
		command.Dir, command.Env, command.Stdin = root, env, input
		output, err := command.CombinedOutput()
		if err != nil {
			t.Fatalf("owned Docker operation failed: %v\n%s", err, output)
		}
		return bytes.TrimSpace(output)
	}
	if existing := run(nil, "ps", "-a", "-q", "--filter", "label=com.docker.compose.project="+project); len(existing) != 0 {
		t.Fatal("refusing to reuse an existing Compose project")
	}
	// Exact unique project only; preserve backups as evidence until TempDir cleanup.
	rollbackTag := ""
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 30*time.Second)
		defer stop()
		command := exec.CommandContext(cleanupCtx, dockerPath, "compose", "down", "--volumes", "--remove-orphans")
		command.Dir, command.Env = root, env
		if output, err := command.CombinedOutput(); err != nil {
			t.Errorf("owned project cleanup failed: %v\n%s", err, output)
		}
		images := []string{project + ":current"}
		if rollbackTag != "" {
			images = append(images, rollbackTag)
		}
		command = exec.CommandContext(cleanupCtx, dockerPath, append([]string{"image", "rm"}, images...)...)
		if output, err := command.CombinedOutput(); err != nil {
			t.Errorf("owned fixture image cleanup failed: %v\n%s", err, output)
		}
	})
	buildFixture := func(version string) {
		t.Helper()
		// Only this unique test tag is replaced, never the shared base image tag.
		run(strings.NewReader(fmt.Sprintf("FROM alpine:3.22\nLABEL eidolon.backup.proof=%s-%s\n", project, version)), "build", "--tag", project+":current", "-")
	}
	buildFixture("previous")
	run(nil, "compose", "up", "-d", "--wait", "mongo", "api")
	apiID := string(run(nil, "compose", "ps", "-q", "api"))
	imageID := string(run(nil, "inspect", "--format", "{{.Image}}", apiID))
	rollbackTag = "eidolon-api:rollback-" + strings.TrimPrefix(imageID, "sha256:")
	pin := exec.CommandContext(ctx, "bash", filepath.Join(root, "deploy/pin_previous_image.sh"))
	pin.Dir, pin.Env = root, env
	if output, err := pin.CombinedOutput(); err != nil {
		t.Fatalf("pinning exact previous image failed: %v\n%s", err, output)
	}
	buildFixture("replacement")
	if string(run(nil, "image", "inspect", "--format", "{{.Id}}", rollbackTag)) != imageID {
		t.Fatal("replacing the build tag lost the pinned previous image")
	}
	if string(run(nil, "image", "inspect", "--format", "{{.Id}}", project+":current")) == imageID {
		t.Fatal("fixture did not actually replace the mutable build tag")
	}
	if _, err := os.ReadFile(filepath.Join(root, "logs/character-saves/pending.json")); err == nil && os.Geteuid() != 0 {
		t.Fatal("private journal fixture is unexpectedly readable by the host user")
	}
	const authJS = `mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval `
	run(nil, "compose", "exec", "-T", "mongo", "sh", "-c", authJS+`'const d=db.getSiblingDB("eidolon"); d.users.insertOne({_id:"backup-player",gold:1184,resources:{health:17,mana:0},receipts:{listing:-25}}); d.schema_migrations.insertOne({version:8,name:"auction_bid_operations"}); d.auction_bid_operations.insertOne({_id:"pending-listing",kind:"listing",amount:25}); d.users.createIndex({gold:1},{name:"backup_fixture_index"})'`)
	backup := func(reject bool) ([]byte, error) {
		command := exec.CommandContext(ctx, "bash", filepath.Join(root, "deploy/backup_before_upgrade.sh"))
		command.Dir = root
		command.Env = append(append([]string{}, env...), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
			"BACKUP_TEST_REAL_DOCKER="+dockerPath, "EIDOLON_BUILD_COMMIT=owned-backup-target", "BACKUP_TEST_REJECT_DUMP=0")
		if reject {
			command.Env = append(command.Env, "BACKUP_TEST_REJECT_DUMP=1")
		}
		return command.CombinedOutput()
	}
	if output, err := backup(true); err == nil || !bytes.Contains(output, []byte("restarting the unchanged previous API")) {
		t.Fatalf("dump failure did not fail closed: %v\n%s", err, output)
	}
	if string(run(nil, "inspect", "--format", "{{.State.Running}}", apiID)) != "true" {
		t.Fatal("failed backup did not restore the prior API's availability")
	}
	if output, err := backup(false); err != nil {
		t.Fatalf("owned consistent backup failed: %v\n%s", err, output)
	}
	if string(run(nil, "inspect", "--format", "{{.State.Running}}", apiID)) != "false" {
		t.Fatal("successful backup admitted a writer before target replacement")
	}
	entries, err := os.ReadDir(filepath.Join(root, "backups"))
	if err != nil || len(entries) != 2 {
		t.Fatal("expected one retained partial and one complete backup", entries, err)
	}
	completeDir := ""
	for _, entry := range entries {
		dir := filepath.Join(root, "backups", entry.Name())
		if _, err := os.Stat(filepath.Join(dir, "COMPLETE")); err == nil {
			if completeDir != "" {
				t.Fatal("failed backup was marked complete")
			}
			completeDir = dir
		}
	}
	if completeDir == "" {
		t.Fatal("no complete recovery point")
	}
	previousImage, err := os.ReadFile(filepath.Join(completeDir, "previous-image-id.txt"))
	if err != nil || strings.TrimSpace(string(previousImage)) != imageID {
		t.Fatal("backup lost the exact prior server image", err)
	}
	archive, err := os.Open(filepath.Join(completeDir, "logs.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	zip, err := gzip.NewReader(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer zip.Close()
	reader := tar.NewReader(zip)
	foundJournal := false
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		if header.Name == "./character-saves/pending.json" {
			data, err := io.ReadAll(reader)
			if err != nil || !bytes.Equal(data, journal) || header.Uid != 65532 {
				t.Fatal("private journal bytes/ownership not preserved", err, header)
			}
			foundJournal = true
		}
	}
	if !foundJournal {
		t.Fatal("private journal omitted from backup")
	}
	run(nil, "compose", "up", "-d", "--wait", "restore")
	dump, err := os.Open(filepath.Join(completeDir, "mongo.archive.gz"))
	if err != nil {
		t.Fatal(err)
	}
	defer dump.Close()
	run(dump, "compose", "exec", "-T", "restore", "sh", "-c", `exec mongorestore --archive --gzip --nsInclude='eidolon.*' --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin`)
	query := authJS + `'const d=db.getSiblingDB("eidolon"); const c=d.users.findOne({_id:"backup-player"}); if(!c||c.gold!==1184||c.resources.health!==17||c.resources.mana!==0||c.receipts.listing!==-25) quit(2); if(d.schema_migrations.countDocuments({version:8})!==1||d.auction_bid_operations.countDocuments({_id:"pending-listing",amount:25})!==1||!d.users.getIndexes().some(i=>i.name==="backup_fixture_index")) quit(3); print("owned restored resources, receipts, schema and indexes match")'`
	run(nil, "compose", "exec", "-T", "restore", "sh", "-c", query)
	run(nil, "compose", "exec", "-T", "mongo", "sh", "-c", query)
	// Also exercise an installation with data but no previous API container.
	// Remove only this test project's already-stopped placeholder, not its data.
	run(nil, "compose", "rm", "-f", "api")
	if output, err := backup(false); err != nil {
		t.Fatalf("backup without a previous API failed: %v\n%s", err, output)
	}
	entries, err = os.ReadDir(filepath.Join(root, "backups"))
	if err != nil || len(entries) != 3 {
		t.Fatal("missing no-previous-API recovery point", err)
	}
	foundNoAPI := false
	for _, entry := range entries {
		dir := filepath.Join(root, "backups", entry.Name())
		identity, err := os.ReadFile(filepath.Join(dir, "previous-image-id.txt"))
		if err == nil && bytes.Contains(identity, []byte("No prior API container")) {
			if _, err := os.Stat(filepath.Join(dir, "COMPLETE")); err != nil {
				t.Fatal("no-previous-API backup is incomplete", err)
			}
			foundNoAPI = true
		}
	}
	if !foundNoAPI {
		t.Fatal("missing explicit no-previous-image identity")
	}
	t.Log("owned backup restored zero mana, health, gold and receipts; private journal retained; failed dump restarted the exact previous API")
}

func TestDeployBuildContextExcludesPrivateRecoveryFiles(t *testing.T) {
	if os.Getenv("EIDOLON_DEPLOY_BACKUP_DISPOSABLE") != "1" {
		t.Skip("requires explicitly disposable Docker build-context verification")
	}
	ignore, err := os.ReadFile(".dockerignore")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	for _, directory := range []string{"backups", "logs"} {
		if err := os.Mkdir(filepath.Join(root, directory), 0700); err != nil {
			t.Fatal(err)
		}
	}
	files := map[string][]byte{
		".dockerignore":               ignore,
		".env":                        []byte("owned private environment fixture"),
		"backups/previous-api.tar.gz": []byte("owned private archive fixture"),
		"logs/pending.json":           []byte("owned private journal fixture"),
		"Dockerfile":                  []byte("FROM alpine:3.22\nCOPY . /context\nRUN test ! -e /context/backups && test ! -e /context/logs && test ! -e /context/.env && test -f /context/Dockerfile\n"),
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(root, name), content, 0600); err != nil {
			t.Fatal(err)
		}
	}
	tag := fmt.Sprintf("eidolon-backup-context-proof:%d", time.Now().UnixNano())
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, "docker", "build", "--tag", tag, root)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("private files entered the build context: %v\n%s", err, output)
	}
	t.Cleanup(func() {
		cleanupCtx, stop := context.WithTimeout(context.Background(), 15*time.Second)
		defer stop()
		if output, err := exec.CommandContext(cleanupCtx, "docker", "image", "rm", tag).CombinedOutput(); err != nil {
			t.Errorf("owned context image cleanup: %v\n%s", err, output)
		}
	})
	t.Log("actual Docker COPY excludes private archives, journals and environment")
}
