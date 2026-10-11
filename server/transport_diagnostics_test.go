package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestTransportFailureClassification(t *testing.T) {
	for _, test := range []struct {
		name        string
		err         error
		read, write transportCloseReason
	}{
		{"nil", nil, transportCloseNone, transportCloseNone},
		{"frame limit", fmt.Errorf("wrapped: %w", errInboundFrameLimit), transportInboundLimit, transportWriteOther},
		{"read size limit", fmt.Errorf("wrapped: %w", websocket.ErrReadLimit), transportInboundLimit, transportWriteOther},
		{"timeout", &net.DNSError{IsTimeout: true}, transportReadTimeout, transportWriteTimeout},
		{"network", &net.OpError{Op: "read", Err: errors.New("private endpoint")}, transportReadNetwork, transportWriteNetwork},
		{"EOF", io.EOF, transportPeerAbnormal, transportWriteOther},
		{"truncated", fmt.Errorf("wrapped: %w", io.ErrUnexpectedEOF), transportPeerAbnormal, transportWriteOther},
		{"other", errors.New("private account/token/body"), transportReadOther, transportWriteOther},
	} {
		t.Run(test.name, func(t *testing.T) {
			if transportReadFailure(test.err) != test.read || transportWriteFailure(test.err) != test.write {
				t.Fatal("unexpected bounded failure category")
			}
		})
	}
	for code, expected := range map[int]transportCloseReason{
		1000: transportPeerNormal, 1001: transportPeerGoingAway, 1006: transportPeerAbnormal,
		1008: transportPeerPolicy, 1002: transportPeerProtocol, 1003: transportPeerProtocol,
		1007: transportPeerProtocol, 1009: transportPeerProtocol, 1010: transportPeerProtocol,
		1011: transportPeerServer, 4999: transportReadOther,
	} {
		if transportReadFailure(fmt.Errorf("wrapped: %w", &websocket.CloseError{Code: code, Text: "private peer text"})) != expected {
			t.Fatalf("close code %d classification", code)
		}
	}
}

func TestTransportClosureFirstObservationIsAtomicAndDoesNotRetireClient(t *testing.T) {
	before := transportClosureMetrics()
	c := &Client{conn: &websocket.Conn{}}
	var workers sync.WaitGroup
	for i := 0; i < 100; i++ {
		workers.Add(1)
		go func(i int) {
			defer workers.Done()
			c.recordTransportClosure([]transportCloseReason{transportReadTimeout, transportPriorityOverflow, transportQueuesClosed}[i%3])
		}(i)
	}
	workers.Wait()
	var delta uint64
	for key, count := range transportClosureMetrics() {
		delta += count - before[key]
	}
	if delta != 1 || c.transportCloseReason.Load() == 0 {
		t.Fatal("concurrent reader/writer/cleanup counted more than one closure")
	}
	if c.transportClosed.Load() || c.transportClosedAt.Load() != nil || c.retired.Load() {
		t.Fatal("diagnostics changed connection or resume policy")
	}
	after := transportClosureMetrics()
	for _, client := range []*Client{nil, {}, c} {
		for _, reason := range []transportCloseReason{transportCloseNone, transportCloseReasonCount, ^transportCloseReason(0), transportWriteNetwork} {
			client.recordTransportClosure(reason)
		}
	}
	if !reflect.DeepEqual(after, transportClosureMetrics()) {
		t.Fatal("invalid, in-process or already counted client changed totals")
	}
}

func TestTransportHealthHasOnlyFixedAggregateLabels(t *testing.T) {
	c := &Client{conn: &websocket.Conn{}, username: "private-account"}
	c.recordTransportClosure(transportReadFailure(errors.New("private account/token/body")))
	recorder := httptest.NewRecorder()
	healthHandler(func(context.Context) error { return nil })(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	var response healthResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	labels := strings.Fields("peerNormal peerGoingAway peerAbnormal peerPolicy peerProtocol peerServer readTimeout readNetwork readOther writeTimeout writeNetwork writeOther priorityOverflow inboundLimit accessDenied hubShutdown sessionReplaced accountRecovery adminStorage adminAdmission qaDisconnect queuesClosed")
	if recorder.Code != http.StatusOK || len(response.WebsocketClosures) != len(labels) {
		t.Fatal("health response missing fixed aggregate counters")
	}
	for _, label := range labels {
		if _, ok := response.WebsocketClosures[label]; !ok {
			t.Fatalf("missing fixed category %s", label)
		}
	}
	if response.WebsocketClosures["readOther"] == 0 || strings.Contains(recorder.Body.String(), "private") {
		t.Fatal("health lost the count or exposed private input")
	}
	response.WebsocketClosures["injected"] = 1
	if _, ok := transportClosureMetrics()["injected"]; ok {
		t.Fatal("health snapshot mutated process counters")
	}
}

// A real socket exercises the producer/writer close paths without a running
// hub, database, accounts or time-based load. Every fixture owns both endpoints.
func transportDiagnosticSocket(t *testing.T) (*Client, *websocket.Conn) {
	t.Helper()
	clients := make(chan *Client, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			t.Error("fixture upgrade failed")
			return
		}
		clients <- &Client{conn: conn, send: make(chan []byte, 1), prioritySend: make(chan []byte, 1)}
	}))
	t.Cleanup(server.Close)
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	c := <-clients
	t.Cleanup(func() { peer.Close(); c.conn.Close(); c.closeSendQueues() })
	return c, peer
}

func TestTransportPriorityOverflowClosesSocketAndRetainsFirstCause(t *testing.T) {
	c, peer := transportDiagnosticSocket(t)
	if !c.sendSafe([]byte("first")) || c.sendSafe([]byte("overflow")) {
		t.Fatal("lossless queue overflow behavior changed")
	}
	peer.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, _, err := peer.ReadMessage(); err == nil {
		t.Fatal("overflow did not close transport")
	}
	c.closeSendQueues()
	c.recordTransportClosure(transportReadNetwork)
	if transportCloseReason(c.transportCloseReason.Load()) != transportPriorityOverflow {
		t.Fatal("cleanup obscured priority overflow")
	}
}

func TestTransportDroppedStateDoesNotRecordClosure(t *testing.T) {
	c, peer := transportDiagnosticSocket(t)
	if !c.sendState([]byte("first")) || c.sendState([]byte("drop")) {
		t.Fatal("lossy state queue behavior changed")
	}
	if c.transportCloseReason.Load() != 0 {
		t.Fatal("ordinary dropped state counted as closure")
	}
	if err := c.conn.WriteMessage(websocket.TextMessage, []byte("still open")); err != nil {
		t.Fatal(err)
	}
	peer.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, message, err := peer.ReadMessage(); err != nil || string(message) != "still open" {
		t.Fatal("dropped state closed socket")
	}
}

func TestTransportWriterFailureAndFlushedDenial(t *testing.T) {
	for _, denial := range []bool{false, true} {
		t.Run(fmt.Sprint("denial=", denial), func(t *testing.T) {
			c, peer := transportDiagnosticSocket(t)
			message := []byte(`{"type":"world_access_denied","payload":{}}`)
			if !denial {
				c.conn.Close()
			}
			c.prioritySend <- message
			exited := make(chan struct{})
			go func() { defer close(exited); c.writePumpWithTicks(make(chan time.Time)) }()
			peer.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, got, err := peer.ReadMessage()
			if denial && (err != nil || string(got) != string(message)) {
				t.Error("world-access denial was not flushed")
			}
			select {
			case <-exited:
			case <-time.After(2 * time.Second):
				c.closeSendQueues()
				c.conn.Close()
				<-exited
				t.Fatal("writer survived its terminal path")
			}
			expected := transportWriteNetwork
			if denial {
				expected = transportAccessDenied
			}
			if transportCloseReason(c.transportCloseReason.Load()) != expected {
				t.Fatal("writer failure or denial misclassified")
			}
		})
	}
}

func TestTransportReadPumpClassifiesPeerCloseAndMalformedLimit(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		t.Run(fmt.Sprint("malformed=", malformed), func(t *testing.T) {
			c, peer := transportDiagnosticSocket(t)
			originalUnregister := unregister
			unregister = make(chan *Client, 1)
			exited := make(chan struct{})
			go func() { defer close(exited); c.readPump() }()
			t.Cleanup(func() {
				c.conn.Close()
				select {
				case <-exited:
				case <-time.After(2 * time.Second):
					t.Error("reader survived cleanup")
					return // Do not replace a channel still owned by a reader.
				}
				unregister = originalUnregister
			})
			expected := transportPeerNormal
			if malformed {
				expected = transportInboundLimit
				for i := 0; i < 9; i++ {
					if err := peer.WriteMessage(websocket.TextMessage, []byte("{")); err != nil {
						t.Fatal(err)
					}
				}
			} else if err := peer.WriteControl(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseNormalClosure, "private peer text"), time.Now().Add(time.Second)); err != nil {
				t.Fatal(err)
			}
			peer.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, _, err := peer.ReadMessage()
			code := websocket.CloseNormalClosure
			if malformed {
				code = websocket.ClosePolicyViolation
			}
			if !websocket.IsCloseError(err, code) {
				t.Error("peer close behavior changed")
			}
			select {
			case <-exited:
			case <-time.After(2 * time.Second):
				t.Fatal("reader did not terminate")
			}
			if transportCloseReason(c.transportCloseReason.Load()) != expected || !c.transportClosed.Load() || len(unregister) != 1 {
				t.Fatal("read closure was misclassified or lost normal retirement")
			}
		})
	}
}
