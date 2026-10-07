package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Existing deployment contract tests own fake Docker commands. Give those
// fixtures deterministic storage too, never the shared test host's free space.
func installDeploymentStorageFixture(t *testing.T, root string) {
	t.Helper()
	if err := os.Mkdir(filepath.Join(root, "docker-store"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(filepath.Join(root, "bin/docker"), filepath.Join(root, "bin/docker-fixture")); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{
		"bin/docker": `#!/bin/sh
if [ "$*" = 'info --format {{.DockerRootDir}}' ]; then
  printf '%s\n' "$(dirname "$0")/../docker-store"
  exit 0
fi
exec "$(dirname "$0")/docker-fixture" "$@"
`,
		"bin/df": "#!/bin/sh\nprintf 'Avail\\n7340032\\n'\n",
	} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
			t.Fatal(err)
		}
	}
}

func TestDeployStorageRefusesBuildAndReplacementBeforeCleanup(t *testing.T) {
	script, err := os.ReadFile("deploy/deploy_linux.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"enough", "exact-floor", "low-source", "low-docker", "df-failed", "invalid-df", "extra-df-row", "unknown-docker-root", "invalid-floor", "overflow-floor", "zero-floor", "leading-zero-floor", "configured-floor"} {
		t.Run(scenario, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "project with spaces")
			for _, dir := range []string{"deploy", "bin", "docker-store"} {
				if err := os.MkdirAll(filepath.Join(root, dir), 0700); err != nil {
					t.Fatal(err)
				}
			}
			floor := ""
			switch scenario {
			case "invalid-floor":
				floor = "private-invalid-floor"
			case "overflow-floor":
				floor = "999999999999999999999999999"
			case "zero-floor":
				floor = "0"
			case "leading-zero-floor":
				floor = "02048"
			case "configured-floor":
				floor = "4096"
			}
			files := map[string]string{
				"deploy/deploy_linux.sh":       string(script),
				"deploy/pin_previous_image.sh": "#!/bin/sh\necho pin >> \"$STORAGE_COMMANDS\"\n",
				".env":                         "MONGO_INITDB_ROOT_USERNAME=fixture\nMONGO_INITDB_ROOT_PASSWORD=fixture\nMONGO_URI=mongodb://mongo:27017\nEIDOLON_DEPLOY_MIN_FREE_MIB=" + floor + "\n",
				"bin/git": `#!/bin/sh
case "$*" in
  'rev-parse --show-toplevel') echo "$STORAGE_ROOT" ;;
  *clean*) echo clean >> "$STORAGE_COMMANDS" ;;
esac
`,
				"bin/curl": "#!/bin/sh\necho '{\"commit\":\"fixture-commit\",\"database\":\"ready\"}'\n",
				"bin/docker": `#!/bin/sh
echo "$*" >> "$STORAGE_COMMANDS"
case "$*" in
  'info --format {{.DockerRootDir}}')
    [ "$STORAGE_SCENARIO" != unknown-docker-root ] && echo "$STORAGE_ROOT/docker-store" ;;
  *--check-schema*) echo 'Schema preflight passed: database=25 supported=25 commit=fixture-commit' ;;
esac
exit 0
`,
				"bin/df": `#!/bin/sh
echo "storage $*" >> "$STORAGE_COMMANDS"
[ "$1" = --output=avail ] && [ "$2" = --block-size=1024 ] && [ "$3" = -- ] || exit 91
case "$STORAGE_SCENARIO" in
  df-failed) echo private-storage-error >&2; exit 1 ;;
  invalid-df) printf 'Avail\nprivate-invalid-number\n'; exit 0 ;;
  extra-df-row) printf 'Avail\n7340032\n7340032\n'; exit 0 ;;
  exact-floor) printf 'Avail\n2097152\n'; exit 0 ;;
  low-source) [ "$4" != "$STORAGE_ROOT" ] || { printf 'Avail\n2097151\n'; exit 0; } ;;
  low-docker) [ "$4" != "$STORAGE_ROOT/docker-store" ] || { printf 'Avail\n2097151\n'; exit 0; } ;;
  configured-floor) printf 'Avail\n3145728\n'; exit 0 ;;
esac
printf 'Avail\n7340032\n'
`,
			}
			for name, content := range files {
				if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0700); err != nil {
					t.Fatal(err)
				}
			}
			commandsPath := filepath.Join(root, "commands")
			command := exec.Command("bash", filepath.Join(root, "deploy/deploy_linux.sh"))
			command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "bin")+":"+os.Getenv("PATH"),
				"STORAGE_ROOT="+root, "STORAGE_COMMANDS="+commandsPath, "STORAGE_SCENARIO="+scenario,
				"EIDOLON_BUILD_COMMIT=fixture-commit", "CLEAN_SERVER_TREE=true")
			output, runErr := command.CombinedOutput()
			commands, err := os.ReadFile(commandsPath)
			if err != nil {
				t.Fatal(err)
			}
			valid := scenario == "enough" || scenario == "exact-floor"
			if (runErr == nil) != valid {
				t.Fatalf("storage decision %s: err=%v output=%s", scenario, runErr, output)
			}
			text := string(commands)
			if !valid {
				for _, mutation := range []string{"clean\n", "pin\n", "compose build", "compose up", "--check-schema"} {
					if strings.Contains(text, mutation) {
						t.Fatalf("storage refusal performed %s: %s", mutation, text)
					}
				}
				if strings.Contains(string(output), "private-") {
					t.Fatal("unvalidated storage/configuration text leaked")
				}
			} else if !strings.Contains(text, "compose up -d\n") || !strings.Contains(text, "storage --output=avail --block-size=1024 -- "+root+"/docker-store\n") {
				t.Fatal("valid deployment did not check both filesystems and complete", text)
			}
		})
	}
}
