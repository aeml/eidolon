package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestInboundByteGuardActualReadPumpClosesPaddedDataFlood(t *testing.T) {
	previousUnregister := unregister
	unregister = make(chan *Client, 1)
	t.Cleanup(func() { unregister = previousUnregister })
	done := make(chan *Client, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			t.Error(err)
			done <- nil
			return
		}
		client := &Client{conn: conn, send: make(chan []byte, 256), prioritySend: make(chan []byte, 256)}
		client.readPump() // The real byte gate, envelope parser and policy path.
		done <- client
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(5 * time.Second))
	peer.SetWriteDeadline(time.Now().Add(5 * time.Second))
	base := `{"type":"unknown_byte_probe","payload":{}}`
	frame := []byte(base + strings.Repeat(" ", inboundByteTestChunk-len(base)))
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		//96 valid padded messages are below the300-frame initial allowance,
		//but exceed byte burst plus even5 seconds of sustained byte refill.
		for i := 0; i < 96; i++ {
			if err := peer.WriteMessage(websocket.TextMessage, frame); err != nil {
				return // The expected policy close may interrupt the writer.
			}
		}
	}()
	if _, _, err := peer.ReadMessage(); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatal("padded data flood bypassed real read-pump byte admission", err)
	}
	peer.Close()
	select {
	case <-writerDone:
	case <-time.After(5 * time.Second):
		t.Fatal("probe writer did not stop")
	}
	select {
	case client := <-done:
		if client == nil || !client.transportClosed.Load() {
			t.Fatal("read pump did not publish transport closure")
		}
		if retired := <-unregister; retired != client {
			t.Fatal("read-pump retirement handoff changed")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("real read pump did not finish")
	}
}
