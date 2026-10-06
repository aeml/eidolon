package main

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpgradeBackupVerificationReadOnlyAndRefusesUnsafeManifests(t *testing.T) {
	script, err := filepath.Abs("deploy/verify_upgrade_backup.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"complete", "fresh-no-image", "no-marker", "empty-marker", "no-sums", "missing-required-sum", "duplicate", "foreign", "traversal", "absolute", "escaped", "checksum-mismatch", "corrupt-gzip", "missing-artifact", "image-not-covered", "missing-image-and-sum", "invalid-image-id", "unexpected-fresh-image", "artifact-link", "manifest-link", "directory-link"} {
		t.Run(scenario, func(t *testing.T) {
			dir := t.TempDir()
			var zipped bytes.Buffer
			writer := gzip.NewWriter(&zipped)
			_, _ = writer.Write([]byte("synthetic fixture, not a Mongo restore proof"))
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			files := map[string][]byte{
				"mongo.archive.gz": zipped.Bytes(), "logs.tar.gz": zipped.Bytes(),
				"previous-api.tar.gz": zipped.Bytes(), "previous-image-id.txt": []byte("sha256:" + strings.Repeat("a", 64) + "\n"),
				"COMPLETE": []byte("target_commit=fixture-commit\ncreated_utc=2026-10-06T00:00:00Z\n"),
			}
			if scenario == "fresh-no-image" {
				delete(files, "previous-api.tar.gz")
				files["previous-image-id.txt"] = []byte("No prior API container; no previous server image is available.\n")
			}
			if scenario == "invalid-image-id" {
				files["previous-image-id.txt"] = []byte("not-an-image-identity\n")
			}
			if scenario == "unexpected-fresh-image" {
				files["previous-image-id.txt"] = []byte("No prior API container; no previous server image is available.\n")
			}
			var manifest strings.Builder
			for _, name := range []string{"mongo.archive.gz", "logs.tar.gz", "previous-image-id.txt", "previous-api.tar.gz"} {
				if data, exists := files[name]; exists {
					fmt.Fprintf(&manifest, "%x  %s\n", sha256.Sum256(data), name)
				}
			}
			sums := manifest.String()
			switch scenario {
			case "no-marker":
				delete(files, "COMPLETE")
			case "empty-marker":
				files["COMPLETE"] = nil
			case "missing-required-sum":
				sums = strings.Join(strings.Split(sums, "\n")[1:], "\n")
			case "duplicate":
				sums += strings.Split(sums, "\n")[0] + "\n"
			case "foreign":
				sums += strings.Repeat("a", 64) + "  owner-private.json\n"
			case "traversal":
				sums += strings.Repeat("a", 64) + "  ../owner-private.json\n"
			case "absolute":
				sums += strings.Repeat("a", 64) + "  /etc/passwd\n"
			case "escaped":
				sums = "\\" + sums
			case "checksum-mismatch":
				files["logs.tar.gz"] = []byte("changed")
			case "corrupt-gzip":
				files["logs.tar.gz"] = []byte("not gzip")
				lines := strings.Split(sums, "\n")
				lines[1] = fmt.Sprintf("%x  logs.tar.gz", sha256.Sum256(files["logs.tar.gz"]))
				sums = strings.Join(lines, "\n")
			case "missing-artifact":
				delete(files, "logs.tar.gz")
			case "image-not-covered":
				sums = strings.Join(strings.Split(sums, "\n")[:3], "\n") + "\n"
			case "missing-image-and-sum":
				delete(files, "previous-api.tar.gz")
				sums = strings.Join(strings.Split(sums, "\n")[:3], "\n") + "\n"
			}
			if scenario != "no-sums" {
				files["SHA256SUMS"] = []byte(sums)
			}
			for name, data := range files {
				if err := os.WriteFile(filepath.Join(dir, name), data, 0600); err != nil {
					t.Fatal(err)
				}
			}
			selected := dir
			switch scenario {
			case "artifact-link", "manifest-link":
				name := "logs.tar.gz"
				if scenario == "manifest-link" {
					name = "SHA256SUMS"
				}
				if err := os.Rename(filepath.Join(dir, name), filepath.Join(dir, "original")); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink("original", filepath.Join(dir, name)); err != nil {
					t.Fatal(err)
				}
			case "directory-link":
				selected = filepath.Join(t.TempDir(), "selected-link")
				if err := os.Symlink(dir, selected); err != nil {
					t.Fatal(err)
				}
			}
			before := map[string][]byte{}
			entries, err := os.ReadDir(dir)
			if err != nil {
				t.Fatal(err)
			}
			for _, entry := range entries {
				before[entry.Name()], err = os.ReadFile(filepath.Join(dir, entry.Name()))
				if err != nil {
					t.Fatal(err)
				}
			}
			output, runErr := exec.Command("bash", script, selected).CombinedOutput()
			pass := scenario == "complete" || scenario == "fresh-no-image"
			if (runErr == nil) != pass || pass && !strings.Contains(string(output), "integrity verified (read-only)") {
				t.Fatalf("unexpected integrity result: %v %s", runErr, output)
			}
			after, err := os.ReadDir(dir)
			if err != nil || len(after) != len(entries) {
				t.Fatal("verifier changed directory", err)
			}
			for name, data := range before {
				got, err := os.ReadFile(filepath.Join(dir, name))
				if err != nil || !bytes.Equal(data, got) {
					t.Fatal("verifier changed backup bytes", name, err)
				}
			}
		})
	}
}

func TestRestoreCoordinatedPointIntegrityBeforeDockerAccess(t *testing.T) {
	for _, scenario := range []string{"valid", "corrupt", "missing-markers", "alternate-archive", "linked-archive"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			point := filepath.Join(root, "save-upgrade-fixture")
			for _, dir := range []string{"deploy", "bin", "save-upgrade-fixture"} {
				if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			for _, name := range []string{"restore_mongo_archive.sh", "verify_upgrade_backup.sh"} {
				data, err := os.ReadFile(filepath.Join("deploy", name))
				if err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(root, "deploy", name), data, 0700); err != nil {
					t.Fatal(err)
				}
			}
			var compressed bytes.Buffer
			writer := gzip.NewWriter(&compressed)
			_, _ = writer.Write([]byte("synthetic, not a Mongo restore proof"))
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			var sums strings.Builder
			for _, name := range []string{"mongo.archive.gz", "logs.tar.gz", "previous-image-id.txt"} {
				data := compressed.Bytes()
				if name == "previous-image-id.txt" {
					data = []byte("No prior API container; no previous server image is available.\n")
				}
				if err := os.WriteFile(filepath.Join(point, name), data, 0600); err != nil {
					t.Fatal(err)
				}
				fmt.Fprintf(&sums, "%x  %s\n", sha256.Sum256(data), name)
			}
			if scenario != "missing-markers" {
				for name, data := range map[string]string{"COMPLETE": "synthetic completion\n", "SHA256SUMS": sums.String()} {
					if err := os.WriteFile(filepath.Join(point, name), []byte(data), 0600); err != nil {
						t.Fatal(err)
					}
				}
			}
			archive := filepath.Join(point, "mongo.archive.gz")
			switch scenario {
			case "corrupt":
				if err := os.WriteFile(archive, []byte("changed"), 0600); err != nil {
					t.Fatal(err)
				}
			case "alternate-archive":
				archive = filepath.Join(point, "other.archive.gz")
				if err := os.WriteFile(archive, compressed.Bytes(), 0600); err != nil {
					t.Fatal(err)
				}
			case "linked-archive":
				if err := os.Rename(archive, filepath.Join(point, "original.archive.gz")); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink("original.archive.gz", archive); err != nil {
					t.Fatal(err)
				}
			}
			probe := filepath.Join(root, "docker-attempted")
			if err := os.WriteFile(filepath.Join(root, ".env"), []byte("# synthetic fixture only\n"), 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, "bin", "docker"), []byte("#!/bin/sh\n: > \"$RESTORE_DOCKER_PROBE\"\nexit 55\n"), 0700); err != nil {
				t.Fatal(err)
			}
			command := exec.Command("bash", filepath.Join(root, "deploy", "restore_mongo_archive.sh"), archive, "--confirm-data-loss", "--confirm-privacy-and-journal-plan")
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"), "RESTORE_DOCKER_PROBE="+probe)
			output, err := command.CombinedOutput()
			if err == nil {
				t.Fatal("mock never permits a real database restore")
			}
			_, probeErr := os.Stat(probe)
			if scenario == "valid" {
				if probeErr != nil || !strings.Contains(string(output), "integrity verified (read-only)") {
					t.Fatal("verified point never reached stopped-writer inspection", string(output))
				}
			} else if !os.IsNotExist(probeErr) {
				t.Fatal("unsafe point reached Docker before integrity refusal", string(output))
			}
		})
	}
}
