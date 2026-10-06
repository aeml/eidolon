package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Source only the pure argument validator. Never run an installer, certificate
// request, nginx reload or privileged command, even when CI itself runs as root.
func TestTLSSetupArgumentSafety(t *testing.T) {
	script, err := filepath.Abs("deploy/setup_nginx_tls.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name string
		args []string
		want string
		ok   bool
	}{
		{"default", []string{"api.example.com"}, "api.example.com 18082\n", true},
		{"normalize", []string{"API.Example.com.", "08080"}, "api.example.com 8080\n", true},
		{"max port", []string{"api.example.com", "65535"}, "api.example.com 65535\n", true},
		{"missing", nil, "Usage:", false},
		{"extra", []string{"api.example.com", "8080", "extra"}, "Usage:", false},
		{"play", []string{"play.eidolonrealms.com"}, "additive dual-host", false},
		{"server", []string{"server.eidolonrealms.com"}, "additive dual-host", false},
		{"canonical variant", []string{"PLAY.EIDOLONREALMS.COM."}, "additive dual-host", false},
		{"url", []string{"https://api.example.com"}, "Invalid DNS", false},
		{"path", []string{"api.example.com/../../etc"}, "Invalid DNS", false},
		{"option", []string{"--nginx"}, "Invalid DNS", false},
		{"shell", []string{"api.example.com;touch /tmp/unwanted"}, "Invalid DNS", false},
		{"control", []string{"api.example.com\nother.example.com"}, "Invalid DNS", false},
		{"empty label", []string{"api..example.com"}, "Invalid DNS", false},
		{"long label", []string{strings.Repeat("a", 64) + ".example.com"}, "Invalid DNS", false},
		{"zero", []string{"api.example.com", "0"}, "Invalid upstream port", false},
		{"overflow", []string{"api.example.com", "65536"}, "Invalid upstream port", false},
		{"port injection", []string{"api.example.com", "80/extra"}, "Invalid upstream port", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			args := append([]string{"-c", `source "$1"; validate_tls_setup_arguments "${@:2}"`, "tls-validation", script}, tc.args...)
			output, err := exec.Command("bash", args...).CombinedOutput()
			if tc.ok {
				if err != nil || string(output) != tc.want {
					t.Fatalf("valid argument contract failed: %v %q", err, output)
				}
			} else if err == nil || !strings.Contains(string(output), tc.want) {
				t.Fatalf("unsafe argument accepted or misleading failure: %v %q", err, output)
			}
		})
	}
	source, err := os.ReadFile(script)
	if err != nil {
		t.Fatal(err)
	}
	validation := strings.Index(string(source), `tls_arguments="$(validate_tls_setup_arguments "$@")" || exit 1`)
	privilege := strings.Index(string(source), `if [ "${EUID}" -ne 0 ]`)
	if validation < 0 || privilege <= validation {
		t.Fatal("installer must validate arguments before privilege checks and any effects")
	}
}

func TestTLSSetupExistingTargetsArePreservedBeforeEffects(t *testing.T) {
	script, err := filepath.Abs("deploy/setup_nginx_tls.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, position := range []string{"configuration", "enabled-link"} {
		for _, kind := range []string{"file", "directory", "linked-file", "dangling-link"} {
			t.Run(position+"/"+kind, func(t *testing.T) {
				dir := t.TempDir()
				config, enabled := filepath.Join(dir, "eidolon.conf"), filepath.Join(dir, "enabled.conf")
				target := config
				if position == "enabled-link" {
					target = enabled
				}
				sentinel := filepath.Join(dir, "sentinel")
				if err := os.WriteFile(sentinel, []byte("preserve unrelated site"), 0600); err != nil {
					t.Fatal(err)
				}
				switch kind {
				case "file":
					err = os.WriteFile(target, []byte("existing configuration"), 0600)
				case "directory":
					err = os.Mkdir(target, 0700)
				case "linked-file":
					err = os.Symlink(sentinel, target)
				case "dangling-link":
					err = os.Symlink(filepath.Join(dir, "missing"), target)
				}
				if err != nil {
					t.Fatal(err)
				}
				output, runErr := exec.Command("bash", "-c", `source "$1"; validate_tls_setup_targets "$2" "$3"`, "tls-target-validation", script, config, enabled).CombinedOutput()
				if runErr == nil || !strings.Contains(string(output), "Existing nginx target") {
					t.Fatalf("existing target admitted: %v %q", runErr, output)
				}
				if data, err := os.ReadFile(sentinel); err != nil || string(data) != "preserve unrelated site" {
					t.Fatal("unrelated sentinel changed", err)
				}
				if _, err := os.Lstat(target); err != nil {
					t.Fatal("existing target disappeared", err)
				}
				if kind == "file" {
					if data, err := os.ReadFile(target); err != nil || string(data) != "existing configuration" {
						t.Fatal("existing configuration bytes changed", err)
					}
				} else if kind == "directory" {
					if entries, err := os.ReadDir(target); err != nil || len(entries) != 0 {
						t.Fatal("existing directory changed", err)
					}
				} else {
					want := sentinel
					if kind == "dangling-link" {
						want = filepath.Join(dir, "missing")
					}
					if link, err := os.Readlink(target); err != nil || link != want {
						t.Fatal("existing link target changed", err)
					}
				}
				other := enabled
				if position == "enabled-link" {
					other = config
				}
				if _, err := os.Lstat(other); !os.IsNotExist(err) {
					t.Fatal("validation created another target", err)
				}
			})
		}
	}
	dir := t.TempDir()
	output, err := exec.Command("bash", "-c", `source "$1"; validate_tls_setup_targets "$2" "$3"`, "tls-target-validation", script, filepath.Join(dir, "fresh.conf"), filepath.Join(dir, "fresh-link.conf")).CombinedOutput()
	if err != nil || len(output) != 0 {
		t.Fatalf("fresh targets refused: %v %q", err, output)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 0 {
		t.Fatal("fresh validation wrote filesystem state", err)
	}
	source, err := os.ReadFile(script)
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	guard := strings.Index(text, `validate_tls_setup_targets "${NGINX_CONF}" "${ENABLED_LINK}" || exit 1`)
	dependency := strings.Index(text, "if ! command -v certbot")
	firstWrite := strings.Index(text, "\nmkdir -p /var/www/certbot")
	if guard < 0 || dependency <= guard || firstWrite <= dependency {
		t.Fatal("target/dependency guards must precede installer effects")
	}
	if !strings.Contains(text, `certbot --nginx --cert-name "${DOMAIN}" -d "${DOMAIN}"`) || !strings.Contains(text, `certbot renew --dry-run --cert-name "${DOMAIN}"`) {
		t.Fatal("certificate actions must stay scoped to requested custom host")
	}
}
