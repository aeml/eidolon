package main

import (
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestReadFailureClassificationNeverRetainsRemoteDetails(t *testing.T) {
	for _, sample := range []struct {
		code int
		want readFailureStage
	}{
		{1000, readFailureNormal}, {1001, readFailureGoingAway}, {1002, readFailureProtocol},
		{1003, readFailureProtocol}, {1006, readFailureAbnormal}, {1008, readFailurePolicy},
		{1009, readFailureTooBig}, {1011, readFailureServer}, {4001, readFailureUnknown},
	} {
		err := fmt.Errorf("opaque wrapper: %w", &websocket.CloseError{Code: sample.code, Text: "private-account/provider/token"})
		if classifyReadFailure(err) != sample.want {
			t.Fatal("closed wire category changed")
		}
	}
	for _, sample := range []struct {
		err  error
		want readFailureStage
	}{
		{&net.DNSError{Err: "private-host", IsTimeout: true}, readFailureTimeout},
		{fmt.Errorf("opaque: %w", io.EOF), readFailureEOF}, {io.ErrUnexpectedEOF, readFailureEOF},
		{errors.New("private-network-address"), readFailureUnknown}, {nil, readFailureUnknown},
	} {
		if classifyReadFailure(sample.err) != sample.want {
			t.Fatal("transport classification changed")
		}
	}
	observations := []loadObservation{{}, {readFailure: readFailurePolicy}, {readFailure: readFailurePolicy}, {readFailure: readFailureTimeout}, {readFailure: 255}}
	counts := summarizeReadFailures(observations)
	if counts[readFailurePolicy] != 2 || counts[readFailureTimeout] != 1 || counts[readFailureUnknown] != 1 || counts[readFailureNone] != 0 {
		t.Fatal("missing or unbounded read category count")
	}
}

func TestReadFailureActualPolicyCloseIsNotAssumedTimeout(t *testing.T) {
	exited := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(exited)
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			t.Error("socket fixture upgrade failed")
			return
		}
		defer conn.Close()
		if conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "private-test-detail"), time.Now().Add(time.Second)) != nil {
			t.Error("socket fixture close failed")
		}
	}))
	defer server.Close()
	peer, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal("socket fixture dial failed")
	}
	defer peer.Close()
	peer.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = peer.ReadMessage()
	if classifyReadFailure(err) != readFailurePolicy {
		t.Fatal("actual policy close mislabeled")
	}
	select {
	case <-exited:
	case <-time.After(time.Second):
		t.Fatal("socket fixture did not exit")
	}
}
