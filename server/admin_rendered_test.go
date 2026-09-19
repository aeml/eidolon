package main

import (
	"context"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Called only inside the explicitly disposable Mongo/production-binary fixture.
// Credentials are generated for this run, never loaded from a production env.
func runAdminRenderedControls(t *testing.T, address, operator, member string) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	command := exec.CommandContext(ctx, "node", "node_modules/@playwright/test/cli.js", "test", "tests/e2e/admin-console-gameplay.spec.js", "--reporter=line", "--retries=0")
	command.Dir = ".."
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, "EIDOLON_E2E_") {
			command.Env = append(command.Env, entry)
		}
	}
	command.Env = append(command.Env,
		"EIDOLON_E2E_ADMIN_DISPOSABLE=1", "EIDOLON_E2E_REUSE_SERVER=0", "EIDOLON_E2E_WEB_PORT="+strconv.Itoa(port),
		"EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_USERNAME="+operator, "EIDOLON_E2E_PASSWORD="+operator+"-test-password",
		"EIDOLON_E2E_USERNAME_SECONDARY="+member, "EIDOLON_E2E_PASSWORD_SECONDARY="+member+"-test-password")
	output, err := command.CombinedOutput()
	t.Logf("disposable rendered panel check:\n%s", output)
	if err != nil {
		t.Fatal("rendered administration check failed", err)
	}
}
