package main

import (
	"bytes"
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

func TestInboundMessageDeadlineNeverLetsAssemblyExtendIdle(t *testing.T) {
	now := time.Unix(100, 0)
	r := &inboundMessageReader{idleDeadline: now.Add(time.Minute)}
	if !r.deadline().Equal(r.idleDeadline) {
		t.Fatal("idle deadline changed without a started message")
	}
	r.assemblyDeadline = now.Add(inboundMessageAssemblyWait)
	if !r.deadline().Equal(r.assemblyDeadline) {
		t.Fatal("started message did not receive a fixed assembly deadline")
	}
	r.idleDeadline = now.Add(time.Second)
	if !r.deadline().Equal(r.idleDeadline) {
		t.Fatal("assembly granted extra time to an already expiring idle connection")
	}
}

// Construct short masked wire frames so empty continuation frames and control
// frames genuinely interleave inside one unfinished data message.
func writeInboundTestFragment(conn net.Conn, kind byte, final bool, payload []byte) error {
	if len(payload) > 125 {
		return errors.New("fragment fixture only supports short payloads")
	}
	if final {
		kind |= 0x80
	}
	mask := [4]byte{1, 2, 3, 4}
	wire := []byte{kind, 0x80 | byte(len(payload)), mask[0], mask[1], mask[2], mask[3]}
	for i, b := range payload {
		wire = append(wire, b^mask[i%len(mask)])
	}
	for len(wire) > 0 {
		n, err := conn.Write(wire)
		if err != nil {
			return err
		}
		if n == 0 {
			return io.ErrShortWrite
		}
		wire = wire[n:]
	}
	return nil
}

func TestInboundMessageActualFragmentsKeepalivesAndNextIdleRead(t *testing.T) {
	done := make(chan error, 1)
	firstRead := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, request, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		reader := newInboundMessageReader(conn, time.Now, 2*time.Second, 200*time.Millisecond)
		guard := newInboundFrameGuard(time.Now())
		guard.installControlHandlers(conn, time.Now)
		kind, message, err := reader.readMessage()
		if err == nil && (kind != websocket.TextMessage || string(message) != `{"type":"unknown"}` || !reader.assemblyDeadline.IsZero()) {
			err = errors.New("completed fragmented payload or deadline restoration changed")
		}
		if err != nil {
			done <- err
			return
		}
		close(firstRead)
		_, message, err = reader.readMessage()
		if err == nil && string(message) != "next" {
			err = errors.New("next ordinary message changed")
		}
		done <- err
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetWriteDeadline(time.Now().Add(3 * time.Second))
	for _, fragment := range []struct {
		kind byte
		fin  bool
		data string
	}{{websocket.TextMessage, false, "{\"type\":"}, {websocket.PingMessage, true, "ping"},
		{websocket.PongMessage, true, "pong"}, {0, false, ""}, {0, true, "\"unknown\"}"}} {
		if err := writeInboundTestFragment(peer.UnderlyingConn(), fragment.kind, fragment.fin, []byte(fragment.data)); err != nil {
			t.Fatal(err)
		}
	}
	peer.SetReadDeadline(time.Now().Add(3 * time.Second))
	pong := make(chan string, 1)
	peer.SetPongHandler(func(data string) error { pong <- data; return nil })
	readDone := make(chan struct{})
	go func() { defer close(readDone); _, _, _ = peer.ReadMessage() }()
	select {
	case data := <-pong:
		if data != "ping" {
			t.Fatal("default Ping response changed")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("fragmented message lost its Ping response")
	}
	select {
	case <-firstRead:
	case err := <-done:
		t.Fatal("fragmented message was rejected", err)
	case <-time.After(3 * time.Second):
		t.Fatal("fragmented message did not complete")
	}
	// Longer than assembly wait, shorter than idle wait. The completed message
	// must not leave its short assembly deadline on the next idle read.
	time.Sleep(300 * time.Millisecond)
	if err := peer.WriteMessage(websocket.TextMessage, []byte("next")); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("next idle read did not complete")
	}
	peer.Close()
	<-readDone
}

func TestInboundMessageActualFragmentedSizeLimitIsRetained(t *testing.T) {
	done := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, request, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		reader := newInboundMessageReader(conn, time.Now, time.Second, time.Second)
		_, _, err = reader.readMessage()
		done <- err
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetWriteDeadline(time.Now().Add(3 * time.Second))
	for index := 0; index < maxMessageSize/125+2; index++ {
		kind := byte(0)
		if index == 0 {
			kind = websocket.TextMessage
		}
		if err := writeInboundTestFragment(peer.UnderlyingConn(), kind, false, bytes.Repeat([]byte("x"), 125)); err != nil {
			break // Rejection may close the socket before all fragments are sent.
		}
	}
	select {
	case err := <-done:
		if !errors.Is(err, websocket.ErrReadLimit) {
			t.Fatal("fragmentation bypassed the existing logical size limit", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("oversized fragmented message was not rejected")
	}
}

func TestInboundMessageActualReadPumpTimesOutDespitePongsAndEmptyFragments(t *testing.T) {
	previousUnregister := unregister
	unregister = make(chan *Client, 1)
	t.Cleanup(func() { unregister = previousUnregister })
	done := make(chan *Client, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, request, nil)
		if err != nil {
			t.Error(err)
			done <- nil
			return
		}
		client := &Client{conn: conn, send: make(chan []byte, 256), prioritySend: make(chan []byte, 256)}
		client.readPump() // Exact production assembly window, no fake clock.
		done <- client
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(inboundMessageAssemblyWait + 3*time.Second))
	peer.SetWriteDeadline(time.Now().Add(inboundMessageAssemblyWait + 3*time.Second))
	if err := writeInboundTestFragment(peer.UnderlyingConn(), websocket.TextMessage, false, nil); err != nil {
		t.Fatal(err)
	}
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			if writeInboundTestFragment(peer.UnderlyingConn(), websocket.PongMessage, true, nil) != nil ||
				writeInboundTestFragment(peer.UnderlyingConn(), 0, false, nil) != nil {
				return
			}
		}
	}()
	started := time.Now()
	if _, _, err := peer.ReadMessage(); !websocket.IsCloseError(err, websocket.CloseAbnormalClosure) {
		t.Fatal("unfinished data with harmless-rate Pongs did not close at its assembly deadline", err)
	}
	if time.Since(started) < inboundMessageAssemblyWait-time.Second {
		t.Fatal("connection closed before its assembly window")
	}
	peer.Close()
	select {
	case <-writerDone:
	case <-time.After(2 * time.Second):
		t.Fatal("fragment probe writer did not stop")
	}
	select {
	case client := <-done:
		if client == nil || !client.transportClosed.Load() {
			t.Fatal("real read pump did not record transport closure")
		}
		if retired := <-unregister; retired != client {
			t.Fatal("retirement handoff changed")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("real read pump did not retire")
	}
}
