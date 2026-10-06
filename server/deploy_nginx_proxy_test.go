package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// Run the committed canonical backend block, not a separately reimplemented
// proxy. Only its listen/upstream addresses change. Never load installed nginx
// configuration, use public listeners, signal a system service or run Certbot.
func TestCanonicalNginxProxyPreservesHTTPAndWebsocketContracts(t *testing.T) {
	nginx, err := exec.LookPath("nginx")
	if err != nil {
		t.Skip("native nginx required for isolated proxy check")
	}
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" {
			conn, err := upgrader.Upgrade(w, r, nil) // Actual production Origin policy.
			if err != nil {
				return
			}
			defer conn.Close()
			conn.SetReadDeadline(time.Now().Add(5 * time.Second))
			kind, payload, err := conn.ReadMessage()
			if err == nil {
				conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				_ = conn.WriteMessage(kind, payload)
				// Read the client's normal close and let Gorilla send its reply.
				_, _, _ = conn.ReadMessage()
			}
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"uri": r.RequestURI, "host": r.Host, "protocol": r.Proto,
			"realIP": r.Header.Get("X-Real-IP"), "forwardedFor": r.Header.Get("X-Forwarded-For"),
			"forwardedProto": r.Header.Get("X-Forwarded-Proto"),
		})
	}))
	defer origin.Close()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	_ = listener.Close()
	template, err := os.ReadFile("deploy/nginx/eidolonrealms-http.conf")
	if err != nil {
		t.Fatal(err)
	}
	// Require the actual canonical backend block and its explicit server name.
	_, block, found := strings.Cut(string(template), "\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name server.eidolonrealms.com;")
	if !found {
		t.Fatal("canonical backend block changed; review fixture extraction")
	}
	block = "server {\nlisten " + address + ";\nserver_name server.eidolonrealms.com;" + block
	block = strings.ReplaceAll(block, "http://127.0.0.1:18082", origin.URL)
	root := t.TempDir()
	config := "daemon off; master_process off; pid " + filepath.Join(root, "nginx.pid") + "; error_log stderr; events {} http { access_log off; " + block + " }"
	configPath := filepath.Join(root, "nginx.conf")
	if err := os.WriteFile(configPath, []byte(config), 0600); err != nil {
		t.Fatal(err)
	}
	logPath := filepath.Join(root, "nginx.log")
	log, err := os.Create(logPath)
	if err != nil {
		t.Fatal(err)
	}
	defer log.Close()
	cmd := exec.Command(nginx, "-p", root+"/", "-c", configPath)
	cmd.Stdout, cmd.Stderr = log, log
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
		close(done)
	}()
	t.Cleanup(func() {
		_ = cmd.Process.Signal(syscall.SIGTERM)
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			_ = cmd.Process.Kill()
			<-done
		}
	})
	client := &http.Client{Timeout: time.Second}
	defer client.CloseIdleConnections()
	var response *http.Response
	requestURI := "/healthz?release=fixture-commit&encoded=a%2Fb"
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); {
		request, err := http.NewRequest(http.MethodGet, "http://"+address+requestURI, nil)
		if err != nil {
			t.Fatal(err)
		}
		request.Host = "server.eidolonrealms.com"
		response, err = client.Do(request)
		if err == nil {
			break
		}
		select {
		case err := <-done:
			data, _ := os.ReadFile(logPath)
			t.Fatalf("isolated nginx exited: %v %s", err, data)
		case <-time.After(20 * time.Millisecond):
		}
	}
	if response == nil {
		t.Fatal("isolated nginx did not become reachable")
	}
	var headers map[string]string
	err = json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&headers)
	_ = response.Body.Close()
	if err != nil || response.StatusCode != http.StatusOK || headers["uri"] != requestURI ||
		headers["host"] != "server.eidolonrealms.com" || headers["protocol"] != "HTTP/1.1" ||
		headers["realIP"] != "127.0.0.1" || headers["forwardedFor"] != "127.0.0.1" || headers["forwardedProto"] != "http" {
		t.Fatalf("actual proxy changed HTTP path/query/headers: %v %v", err, headers)
	}
	dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
	for _, allowed := range []bool{false, true} {
		origin := "https://foreign.example.invalid"
		if allowed {
			origin = "https://play.eidolonrealms.com"
		}
		conn, response, err := dialer.Dial("ws://"+address+"/ws?release=fixture-commit", http.Header{"Origin": {origin}, "Host": {"server.eidolonrealms.com"}})
		if !allowed {
			if conn != nil {
				_ = conn.Close()
			}
			if response != nil {
				_ = response.Body.Close()
			}
			if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
				t.Fatalf("proxy bypassed production Origin refusal: %v", err)
			}
			continue
		}
		if err != nil {
			t.Fatal("canonical websocket upgrade failed", err)
		}
		func() {
			defer conn.Close()
			payload := bytes.Repeat([]byte{0, 1, 127, 255}, 16384)
			_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
			if err := conn.WriteMessage(websocket.BinaryMessage, payload); err != nil {
				t.Fatal(err)
			}
			_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
			kind, actual, err := conn.ReadMessage()
			if err != nil || kind != websocket.BinaryMessage || !bytes.Equal(actual, payload) {
				t.Fatalf("binary frame changed through real proxy: %v", err)
			}
			if err := conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "fixture complete"), time.Now().Add(time.Second)); err != nil {
				t.Fatal(err)
			}
			_, _, err = conn.ReadMessage()
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				t.Fatal("proxy lost normal close handshake", err)
			}
		}()
	}
	t.Logf("actual canonical nginx HTTP/path/header and 64KiB binary websocket/Origin/normal-close checks passed; loopback fixture %s, no TLS renewal or public IPv6 claim", address)
}
