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
		{"http://localhost:8080", true},
		{"https://PLAY.EIDOLONREALMS.COM:443", true},
		{"https://play.eidolonrealms.com.attacker.example", false},
		{"https://untrusted.eidolonrealms.com", false},
		{"ftp://play.eidolonrealms.com", false},
		{"//play.eidolonrealms.com", false},
		{"https://someone:secret@play.eidolonrealms.com", false},
		{"https://play.eidolonrealms.com/", false},
		{"https://play.eidolonrealms.com/path", false},
		{"https://play.eidolonrealms.com?query=1", false},
		{"https://play.eidolonrealms.com?", false},
		{"https://play.eidolonrealms.com#fragment", false},
		{"https://play.eidolonrealms.com#", false},
		{"https://play.eidolonrealms.com:", false},
		{"https://play.eidolonrealms.com:0", false},
		{"https://play.eidolonrealms.com:65536", false},
		{"null", false},
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

func TestWebsocketOriginHeaderCardinality(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err == nil {
			conn.Close()
		}
	}))
	defer server.Close()
	for _, tc := range []struct {
		name    string
		origins []string
		allowed bool
	}{
		{"native-without-origin", nil, true},
		{"blank-header", []string{""}, false},
		{"whitespace-header", []string{" "}, false},
		{"duplicate-trusted", []string{"https://play.eidolonrealms.com", "https://play.eidolonrealms.com"}, false},
		{"trusted-before-untrusted", []string{"https://play.eidolonrealms.com", "https://attacker.example"}, false},
		{"untrusted-before-trusted", []string{"https://attacker.example", "https://play.eidolonrealms.com"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			header := http.Header{}
			if tc.origins != nil {
				header["Origin"] = tc.origins
			}
			conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), header)
			if conn != nil {
				conn.Close()
			}
			if tc.allowed {
				if err != nil || response == nil || response.StatusCode != http.StatusSwitchingProtocols {
					t.Fatalf("expected native transport upgrade: %v", err)
				}
			} else {
				if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
					t.Fatalf("expected rejected malformed origin header: %v", err)
				}
				response.Body.Close()
			}
		})
	}
}
