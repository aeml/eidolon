package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPinPreviousImageFailsClosedWithoutStoppingAPI(t *testing.T) {
	script, err := os.ReadFile("deploy/pin_previous_image.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"fresh", "previous", "already-pinned", "missing", "multiple", "invalid-image", "tag-collision", "tag-failed"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			for _, dir := range []string{"deploy", "bin"} {
				if err := os.Mkdir(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			fake := `#!/bin/bash
printf '%s\n' "$*" >> "$PIN_COMMANDS"
case "$*" in
  'compose ps -a -q api')
    case "$PIN_SCENARIO" in
      fresh) exit 0;;
      multiple) printf 'aaaaaaaaaaaa\nbbbbbbbbbbbb\n';;
      *) echo aaaaaaaaaaaa;;
    esac;;
  'inspect --format {{.Image}} aaaaaaaaaaaa')
    if [ "$PIN_SCENARIO" = invalid-image ]; then echo 'mutable:latest'; else echo "sha256:$PIN_DIGEST"; fi;;
  "image inspect sha256:$PIN_DIGEST") if [ "$PIN_SCENARIO" = missing ]; then exit 1; fi;;
  "image inspect --format {{.Id}} eidolon-api:rollback-$PIN_DIGEST")
    if [ "$PIN_SCENARIO" = tag-collision ]; then echo "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    elif [ "$PIN_SCENARIO" = already-pinned ] || [ -f "$PIN_TAG_CREATED" ]; then echo "sha256:$PIN_DIGEST";
    else exit 1; fi;;
  "image tag sha256:$PIN_DIGEST eidolon-api:rollback-$PIN_DIGEST")
    if [ "$PIN_SCENARIO" = tag-failed ]; then exit 1; fi
    touch "$PIN_TAG_CREATED";;
  *) echo 'unexpected operation' >&2; exit 90;;
esac
`
			for name, data := range map[string][]byte{"deploy/pin_previous_image.sh": script, "bin/docker": []byte(fake)} {
				if err := os.WriteFile(filepath.Join(root, name), data, 0700); err != nil {
					t.Fatal(err)
				}
			}
			command := exec.Command("bash", filepath.Join(root, "deploy/pin_previous_image.sh"))
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"), "PIN_SCENARIO="+scenario,
				"PIN_COMMANDS="+filepath.Join(root, "commands"), "PIN_TAG_CREATED="+filepath.Join(root, "tag"), "PIN_DIGEST="+strings.Repeat("a", 64))
			output, runErr := command.CombinedOutput()
			shouldPass := scenario == "fresh" || scenario == "previous" || scenario == "already-pinned"
			if (runErr == nil) != shouldPass {
				t.Fatalf("unexpected pin result: %v\n%s", runErr, output)
			}
			commands, err := os.ReadFile(filepath.Join(root, "commands"))
			if err != nil {
				t.Fatal(err)
			}
			for _, forbidden := range []string{" stop", " start", " rm", " build"} {
				if strings.Contains(string(commands), forbidden) {
					t.Fatalf("pinning must not mutate availability: %s", commands)
				}
			}
			if scenario != "previous" && scenario != "tag-failed" && strings.Contains(string(commands), "image tag") {
				t.Fatalf("unexpected image-tag mutation: %s", commands)
			}
		})
	}
}
