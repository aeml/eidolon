package main

import (
	"errors"
	"fmt"
	"log"
	"net"
	"time"

	"github.com/gorilla/websocket"
)

// Close reasons are arbitrary peer text, not trusted diagnostic records. Retain
// only error category/code/timeout and share the bounded noisy-traffic budget.
// Structured account/admin audits and ordinary application errors are separate.
func logWebsocketReadError(err error, now time.Time) {
	if err == nil {
		return
	}
	suppressed, allowed := suspiciousLogBudget.allowAt(now)
	if !allowed {
		return
	}
	code := 0
	var closeError *websocket.CloseError
	if errors.As(err, &closeError) {
		code = closeError.Code
	}
	var networkError net.Error
	timeout := errors.As(err, &networkError) && networkError.Timeout()
	log.Printf("websocket_read error_type=%q close_code=%d timeout=%t suppressed_diagnostics=%d",
		fmt.Sprintf("%T", err), code, timeout, suppressed)
}
