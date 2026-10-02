package main

import (
	"bufio"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func dialHTTPConnectionFixture(t *testing.T, server *httptest.Server) net.Conn {
	t.Helper()
	conn, err := net.DialTimeout("tcp", server.Listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	if _, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
		t.Fatal(err)
	}
	return conn
}

func requireHTTPConnectionResponse(t *testing.T, reader *bufio.Reader) {
	t.Helper()
	response, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || response.StatusCode != http.StatusOK || string(body) != "ok" {
		t.Fatal("admitted connection failed", err)
	}
}

func TestHTTPConnectionLimitValidation(t *testing.T) {
	for _, limit := range []int{0, -1, maxHTTPConnections + 1} {
		if _, err := newBoundedHTTPListener(nil, limit); err == nil {
			t.Fatalf("invalid connection limit%d accepted", limit)
		}
	}
	for _, limit := range []int{1, defaultHTTPConnections, maxHTTPConnections} {
		listener, err := newBoundedHTTPListener(nil, limit)
		if err != nil || cap(listener.slots) != limit {
			t.Fatal("valid connection limit changed", limit, err)
		}
	}
}

func TestHTTPConnectionActualPoolWaitsAndReusesClosedSlot(t *testing.T) {
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	listener, err := newBoundedHTTPListener(server.Listener, 2)
	if err != nil {
		t.Fatal(err)
	}
	server.Listener = listener
	server.Start()
	t.Cleanup(server.Close)
	first := dialHTTPConnectionFixture(t, server)
	requireHTTPConnectionResponse(t, bufio.NewReader(first))
	second := dialHTTPConnectionFixture(t, server)
	requireHTTPConnectionResponse(t, bufio.NewReader(second))
	third := dialHTTPConnectionFixture(t, server)
	third.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	var one [1]byte
	_, err = third.Read(one[:])
	var timeout net.Error
	if !errors.As(err, &timeout) || !timeout.Timeout() || len(listener.slots) != 2 {
		t.Fatal("HTTP connection pool exceeded its two slots", err)
	}
	first.Close()
	first.Close() // Duplicate closes must not release somebody else's slot.
	third.SetReadDeadline(time.Now().Add(2 * time.Second))
	requireHTTPConnectionResponse(t, bufio.NewReader(third))
	if len(listener.slots) != 2 {
		t.Fatal("pool capacity changed after duplicate close")
	}
}

func TestHTTPConnectionActualCloseUnblocksSaturatedAccept(t *testing.T) {
	base, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	listener, err := newBoundedHTTPListener(base, 1)
	if err != nil {
		base.Close()
		t.Fatal(err)
	}
	defer listener.Close()
	peer, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	admitted, err := listener.Accept()
	if err != nil {
		t.Fatal(err)
	}
	defer admitted.Close()
	done := make(chan error, 1)
	go func() { _, err := listener.Accept(); done <- err }()
	listener.Close()
	listener.Close()
	select {
	case err := <-done:
		if !errors.Is(err, net.ErrClosed) {
			t.Fatal("blocked accept did not receive listener closure", err)
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown left a saturated accept blocked")
	}
	admitted.Close()
	admitted.Close()
	if len(listener.slots) != 0 {
		t.Fatal("admitted connection retained or double-released its slot")
	}
}

func TestHTTPConnectionActualHijackedSocketKeepsPoolSlot(t *testing.T) {
	readerDone := make(chan struct{})
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				t.Error(err)
				return
			}
			go func() {
				defer close(readerDone)
				defer conn.Close()
				conn.SetReadDeadline(time.Now().Add(3 * time.Second))
				for {
					kind, payload, err := conn.ReadMessage()
					if err != nil || conn.WriteMessage(kind, payload) != nil {
						return
					}
				}
			}()
			return // HTTP handler completion must not release a hijacked socket.
		}
		_, _ = io.WriteString(w, "ok")
	}))
	listener, err := newBoundedHTTPListener(server.Listener, 1)
	if err != nil {
		t.Fatal(err)
	}
	server.Listener = listener
	server.Start()
	t.Cleanup(server.Close)
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(2 * time.Second))
	peer.SetWriteDeadline(time.Now().Add(2 * time.Second))
	if err := peer.WriteMessage(websocket.TextMessage, []byte("owned socket")); err != nil {
		t.Fatal(err)
	}
	_, echo, err := peer.ReadMessage()
	if err != nil || string(echo) != "owned socket" {
		t.Fatal("admitted game transport failed", err)
	}
	waiting := dialHTTPConnectionFixture(t, server)
	waiting.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	var one [1]byte
	_, err = waiting.Read(one[:])
	var timeout net.Error
	if !errors.As(err, &timeout) || !timeout.Timeout() || len(listener.slots) != 1 {
		t.Fatal("HTTP completion released an active hijacked connection", err)
	}
	peer.Close()
	select {
	case <-readerDone:
	case <-time.After(time.Second):
		t.Fatal("hijacked reader did not retire")
	}
	waiting.SetReadDeadline(time.Now().Add(2 * time.Second))
	requireHTTPConnectionResponse(t, bufio.NewReader(waiting))
}

func TestHTTPConnectionActualTLSHandshakeUsesSamePool(t *testing.T) {
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	}))
	listener, err := newBoundedHTTPListener(server.Listener, 1)
	if err != nil {
		t.Fatal(err)
	}
	server.Listener = listener
	server.StartTLS()
	t.Cleanup(server.Close)
	tlsConfig := server.Client().Transport.(*http.Transport).TLSClientConfig.Clone()
	dial := func() (*tls.Conn, error) {
		return tls.DialWithDialer(&net.Dialer{Timeout: 2 * time.Second}, "tcp", server.Listener.Addr().String(), tlsConfig)
	}
	first, err := dial()
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	first.SetDeadline(time.Now().Add(3 * time.Second))
	if _, err := io.WriteString(first, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
		t.Fatal(err)
	}
	requireHTTPConnectionResponse(t, bufio.NewReader(first))
	type dialResult struct {
		conn *tls.Conn
		err  error
	}
	done := make(chan dialResult, 1)
	go func() { conn, err := dial(); done <- dialResult{conn, err} }()
	select {
	case result := <-done:
		if result.conn != nil {
			result.conn.Close()
		}
		t.Fatal("TLS connection did not wait for the occupied pool slot", result.err)
	case <-time.After(100 * time.Millisecond):
	}
	first.Close()
	select {
	case result := <-done:
		if result.err != nil {
			t.Fatal("TLS handshake failed after a pool slot became available", result.err)
		}
		defer result.conn.Close()
		result.conn.SetDeadline(time.Now().Add(2 * time.Second))
		if _, err := io.WriteString(result.conn, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
			t.Fatal(err)
		}
		requireHTTPConnectionResponse(t, bufio.NewReader(result.conn))
	case <-time.After(3 * time.Second):
		t.Fatal("released TLS pool slot was not reusable")
	}
}
