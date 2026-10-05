package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestWritePumpDueKeepalivePrecedesQueuedPriorityTraffic(t *testing.T) {
	writePumpSocketOrder(t, true)
}

func TestWritePumpControlStillPrecedesStateWithoutDueKeepalive(t *testing.T) {
	writePumpSocketOrder(t, false)
}

func writePumpSocketOrder(t *testing.T, due bool) {
	t.Helper()
	exited := make(chan struct{})
	clients := make(chan *Client, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(exited)
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			t.Error("socket fixture upgrade failed")
			return
		}
		c := &Client{conn: conn, send: make(chan []byte, 1), prioritySend: make(chan []byte, 8)}
		clients <- c
		for i := 0; i < cap(c.prioritySend); i++ {
			c.prioritySend <- []byte("control")
		}
		c.send <- []byte("state")
		pings := make(chan time.Time, 1)
		if due {
			pings <- time.Now()
		}
		c.writePumpWithTicks(pings)
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal("socket fixture dial failed")
	}
	t.Cleanup(func() {
		peer.Close()
		select {
		case c := <-clients:
			c.closeSendQueues()
		case <-exited:
		case <-time.After(2 * time.Second):
			t.Error("socket fixture did not publish its writer")
		}
		select {
		case <-exited:
		case <-time.After(2 * time.Second):
			t.Error("writer fixture survived cleanup")
		}
	})
	peer.SetReadDeadline(time.Now().Add(2 * time.Second))
	pingSeen := false
	peer.SetPingHandler(func(string) error { pingSeen = true; return nil })
	_, message, err := peer.ReadMessage()
	if err != nil || string(message) != "control" {
		t.Fatal("queued control lost precedence over state")
	}
	if pingSeen != due {
		t.Fatal("queued priority traffic deferred an already due keepalive")
	}
}
