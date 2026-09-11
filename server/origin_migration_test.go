package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestMigrationOriginsAtWebsocketHandshake(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err == nil {
			conn.Close()
		}
	}))
	defer server.Close()
	for _, tc := range []struct {
		origin  string
		allowed bool
	}{
		{"https://play.eidolonrealms.com", true},
		{"https://eidolon.mendola.tech", true},
		{"https://server.eidolonrealms.com", true},
		{"http://127.0.0.1:4173", true},
		{"https://play.eidolonrealms.com.attacker.example", false},
		{"https://untrusted.eidolonrealms.com", false},
	} {
		t.Run(tc.origin, func(t *testing.T) {
			conn, response, err := websocket.DefaultDialer.Dial(
				"ws"+strings.TrimPrefix(server.URL, "http"), http.Header{"Origin": []string{tc.origin}})
			if conn != nil {
				defer conn.Close()
			}
			if tc.allowed {
				if err != nil || response.StatusCode != http.StatusSwitchingProtocols {
					t.Fatalf("expected successful upgrade: %v", err)
				}
			} else {
				if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
					t.Fatalf("expected rejected origin: %v", err)
				}
				response.Body.Close()
			}
		})
	}
}
