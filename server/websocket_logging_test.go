package main

import (
	"bytes"
	"fmt"
	"log"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestWebsocketReadDiagnosticsExcludePeerTextAndShareBudget(t *testing.T) {
	previousBudget, previousOutput := suspiciousLogBudget, log.Writer()
	suspiciousLogBudget = newSuspiciousTrafficBudget()
	var output bytes.Buffer
	log.SetOutput(&output)
	t.Cleanup(func() {
		log.SetOutput(previousOutput)
		suspiciousLogBudget = previousBudget
	})
	now := time.Unix(1000, 0)
	logWebsocketReadError(nil, now)
	if output.Len() != 0 {
		t.Fatal("nil diagnostic produced a record")
	}
	peerText := "\nFORGED ADMIN RECORD\r\npassword=do-not-log\t" + strings.Repeat("large", 5000)
	for i := 0; i < 30; i++ {
		logWebsocketReadError(fmt.Errorf("wrapped: %w", &websocket.CloseError{Code: websocket.ClosePolicyViolation, Text: peerText}), now)
	}
	if strings.Count(output.String(), "\n") != 20 || strings.Contains(output.String(), "FORGED") ||
		strings.Contains(output.String(), "password") || strings.Contains(output.String(), "large") || output.Len() > 6000 {
		t.Fatal("peer text entered logs or noisy traffic escaped the diagnostic budget")
	}
	if !strings.Contains(output.String(), "close_code=1008") {
		t.Fatal("useful close category was lost")
	}
	// The HTTP diagnostic path consumes this same budget, not a separate
	// allowance an attacker can alternate between.
	if _, allowed := suspiciousLogBudget.allowAt(now); allowed {
		t.Fatal("diagnostic routes do not share their budget")
	}
	logWebsocketReadError(&net.DNSError{Err: "private-error-text", IsTimeout: true}, now.Add(time.Second))
	if strings.Count(output.String(), "\n") != 21 || !strings.Contains(output.String(), "timeout=true") ||
		!strings.Contains(output.String(), "suppressed_diagnostics=11") || strings.Contains(output.String(), "private-error-text") {
		t.Fatal("refill, suppressed count, timeout classification or redaction changed")
	}
}
