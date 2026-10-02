package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestInboundFrameGuardActualControlFramesShareDataBudget(t *testing.T) {
	for _, control := range []int{websocket.PingMessage, websocket.PongMessage} {
		t.Run(map[int]string{websocket.PingMessage: "ping", websocket.PongMessage: "pong"}[control], func(t *testing.T) {
			done := make(chan error, 1)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
				if err != nil {
					done <- err
					return
				}
				defer conn.Close()
				conn.SetReadDeadline(time.Now().Add(5 * time.Second))
				now := time.Now()
				guard := newInboundFrameGuard(now)
				guard.installControlHandlers(conn, func() time.Time { return now })
				// Drive the same shared budget with real data messages first. A
				// fixed clock removes scheduling/refill sensitivity from the test.
				for i := 0; i < 300; i++ {
					if _, _, err := conn.ReadMessage(); err != nil {
						done <- err
						return
					}
					if !guard.acceptFrame(now) {
						done <- errors.New("declared data burst rejected")
						return
					}
				}
				if err := conn.WriteMessage(websocket.TextMessage, []byte("budget spent")); err != nil {
					done <- err
					return
				}
				_, _, err = conn.ReadMessage()
				done <- err
			}))
			defer server.Close()
			conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			conn.SetReadDeadline(time.Now().Add(5 * time.Second))
			for i := 0; i < 300; i++ {
				if err := conn.WriteMessage(websocket.TextMessage, []byte("{}")); err != nil {
					t.Fatal(err)
				}
			}
			if _, reply, err := conn.ReadMessage(); err != nil || string(reply) != "budget spent" {
				t.Fatal("server did not consume the data burst", err)
			}
			if err := conn.WriteControl(control, []byte("untrusted control payload"), time.Now().Add(time.Second)); err != nil {
				t.Fatal(err)
			}
			if _, _, err := conn.ReadMessage(); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
				t.Fatal("control traffic bypassed shared budget", err)
			}
			select {
			case err := <-done:
				if !errors.Is(err, errInboundFrameLimit) {
					t.Fatal("server did not terminate the read on its local policy error", err)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("server control handler did not finish")
			}
		})
	}
}

func TestInboundFrameGuardActualKeepalivesPreserveHandlers(t *testing.T) {
	done := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		pongSeen := false
		conn.SetPongHandler(func(payload string) error {
			pongSeen = payload == "client keepalive"
			return conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		})
		now := time.Now()
		guard := newInboundFrameGuard(now)
		guard.installControlHandlers(conn, func() time.Time { return now })
		_, payload, err := conn.ReadMessage()
		if err != nil {
			done <- err
			return
		}
		if !pongSeen || string(payload) != "ordinary data" || !guard.acceptFrame(now) || guard.frames.tokens != 297 {
			done <- errors.New("keepalive bypassed accounting or discarded its original handler")
			return
		}
		done <- conn.WriteMessage(websocket.TextMessage, []byte("ordinary response"))
	}))
	defer server.Close()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	pingReply := ""
	conn.SetPongHandler(func(payload string) error { pingReply = payload; return nil })
	for _, frame := range []struct {
		kind    int
		payload string
	}{{websocket.PingMessage, "server should echo"}, {websocket.PongMessage, "client keepalive"}} {
		if err := conn.WriteControl(frame.kind, []byte(frame.payload), time.Now().Add(time.Second)); err != nil {
			t.Fatal(err)
		}
	}
	if err := conn.WriteMessage(websocket.TextMessage, []byte("ordinary data")); err != nil {
		t.Fatal(err)
	}
	if _, reply, err := conn.ReadMessage(); err != nil || string(reply) != "ordinary response" || pingReply != "server should echo" {
		t.Fatal("normal ping/pong or data response changed", err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("normal keepalive check did not finish")
	}
}
