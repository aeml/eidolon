package main

import (
	"bufio"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func startLimitedHTTPFixture(t *testing.T, handler http.Handler, configure func(*http.Server)) *httptest.Server {
	t.Helper()
	server := httptest.NewUnstartedServer(handler)
	server.Config = newGameHTTPServer("", handler, log.New(io.Discard, "", 0))
	if configure != nil {
		configure(server.Config)
	}
	server.Start()
	t.Cleanup(server.Close)
	return server
}

func TestHTTPServerProductionLimitsAreExplicit(t *testing.T) {
	handler := http.NewServeMux()
	errorLog := log.New(io.Discard, "", 0)
	server := newGameHTTPServer("127.0.0.1:8080", handler, errorLog)
	if server.Addr != "127.0.0.1:8080" || server.Handler != handler || server.ErrorLog != errorLog {
		t.Fatal("configured address, routes or logger replaced")
	}
	if server.ReadHeaderTimeout != 5*time.Second || server.ReadTimeout != 10*time.Second ||
		server.WriteTimeout != 10*time.Second || server.IdleTimeout != time.Minute || server.MaxHeaderBytes != 16*1024 {
		t.Fatal("HTTP resource defaults changed")
	}
	if upgrader.HandshakeTimeout != 5*time.Second || upgrader.EnableCompression {
		t.Fatal("WebSocket handshake window or existing compression policy changed")
	}
}

func TestHTTPServerActualOversizedHeaderRejectedBeforeHandler(t *testing.T) {
	var calls atomic.Int32
	server := startLimitedHTTPFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusOK)
	}), nil)
	conn, err := net.DialTimeout("tcp", server.Listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	// Exceeds the configured limit plus net/http's bounded reader slack.
	request := "GET / HTTP/1.1\r\nHost: localhost\r\nX-Probe: " + strings.Repeat("x", 32*1024) + "\r\n\r\n"
	if _, err := io.WriteString(conn, request); err != nil {
		t.Fatal(err)
	}
	response, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusRequestHeaderFieldsTooLarge || calls.Load() != 0 {
		t.Fatal("oversized headers reached the application handler")
	}
}

func TestHTTPServerActualIdleKeepaliveExpires(t *testing.T) {
	server := startLimitedHTTPFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}), func(server *http.Server) { server.IdleTimeout = 100 * time.Millisecond })
	conn, err := net.DialTimeout("tcp", server.Listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	if _, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
		t.Fatal(err)
	}
	reader := bufio.NewReader(conn)
	response, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || string(body) != "ok" || response.Close {
		t.Fatal("ordinary HTTP response or keepalive changed", err)
	}
	if _, err := reader.ReadByte(); !errors.Is(err, io.EOF) {
		t.Fatal("idle keepalive outlived its server deadline", err)
	}
}

func TestHTTPServerActualIncompleteHeaderAndBodyExpire(t *testing.T) {
	for _, body := range []bool{false, true} {
		t.Run(map[bool]string{false: "header", true: "body"}[body], func(t *testing.T) {
			observed := make(chan error, 1)
			server := startLimitedHTTPFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, err := io.ReadAll(r.Body)
				observed <- err
			}), func(server *http.Server) {
				server.ReadHeaderTimeout = 100 * time.Millisecond
				server.ReadTimeout = 100 * time.Millisecond
			})
			conn, err := net.DialTimeout("tcp", server.Listener.Addr().String(), time.Second)
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			conn.SetDeadline(time.Now().Add(2 * time.Second))
			request := "GET / HTTP/1.1\r\nHost: localhost\r\n"
			if body {
				request = "POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\n\r\nx"
			}
			if _, err := io.WriteString(conn, request); err != nil {
				t.Fatal(err)
			}
			if body {
				select {
				case err := <-observed:
					var timeout net.Error
					if !errors.As(err, &timeout) || !timeout.Timeout() {
						t.Fatal("incomplete request body escaped read timeout", err)
					}
				case <-time.After(2 * time.Second):
					t.Fatal("request body read did not finish")
				}
			} else {
				if _, err := bufio.NewReader(conn).ReadByte(); !errors.Is(err, io.EOF) {
					t.Fatal("incomplete header remained open", err)
				}
				select {
				case <-observed:
					t.Fatal("incomplete header reached application handler")
				default:
				}
			}
		})
	}
}

func TestHTTPServerActualUpgradeClearsOrdinaryHTTPDeadlines(t *testing.T) {
	done := make(chan error, 1)
	server := startLimitedHTTPFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		kind, payload, err := conn.ReadMessage()
		if err == nil {
			err = conn.WriteMessage(kind, payload)
		}
		done <- err
	}), func(server *http.Server) {
		server.ReadTimeout = 50 * time.Millisecond
		server.WriteTimeout = 50 * time.Millisecond
		server.IdleTimeout = 50 * time.Millisecond
	})
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(2 * time.Second))
	peer.SetWriteDeadline(time.Now().Add(2 * time.Second))
	time.Sleep(150 * time.Millisecond)
	if err := peer.WriteMessage(websocket.TextMessage, []byte("still connected")); err != nil {
		t.Fatal("ordinary HTTP deadline cut off the game transport", err)
	}
	_, payload, err := peer.ReadMessage()
	if err != nil || string(payload) != "still connected" {
		t.Fatal("upgraded WebSocket response failed", err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestHTTPServerActualUnreadResponseWriteExpires(t *testing.T) {
	done := make(chan error, 1)
	server := startLimitedHTTPFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.Copy(w, strings.NewReader(strings.Repeat("x", 8*1024*1024)))
		done <- err
	}), func(server *http.Server) { server.WriteTimeout = 200 * time.Millisecond })
	conn, err := net.DialTimeout("tcp", server.Listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := conn.(*net.TCPConn).SetReadBuffer(1024); err != nil {
		t.Fatal(err)
	}
	conn.SetWriteDeadline(time.Now().Add(time.Second))
	if _, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
		t.Fatal(err)
	}
	// Do not read the response: force the disposable server's send buffers to
	// fill so its deadline, rather than peer closure, must release the writer.
	select {
	case err := <-done:
		var timeout net.Error
		if !errors.As(err, &timeout) || !timeout.Timeout() {
			t.Fatal("unread response escaped its write timeout", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("blocked response writer did not finish")
	}
}
