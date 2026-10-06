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
