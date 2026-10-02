package main

import (
	"errors"
	"time"

	"github.com/gorilla/websocket"
)

var errInboundFrameLimit = errors.New("incoming message limit exceeded")

// Owned by one read pump, before JSON parsing. Message-specific permissions and
// rates still apply afterward. Excess traffic closes only that connection; no
// account ban or proxy/household IP key is created.
type inboundFrameGuard struct {
	frames    messageRateBucket
	malformed messageRateBucket
}

func newInboundFrameGuard(now time.Time) *inboundFrameGuard {
	return &inboundFrameGuard{
		frames:    messageRateBucket{tokens: 300, updated: now},
		malformed: messageRateBucket{tokens: 8, updated: now},
	}
}

func (g *inboundFrameGuard) acceptFrame(now time.Time) bool {
	return consumeRateBucket(&g.frames, messagePolicy{burst: 300, window: 1500 * time.Millisecond}, now)
}

func (g *inboundFrameGuard) acceptMalformed(now time.Time) bool {
	return consumeRateBucket(&g.malformed, messagePolicy{burst: 8, window: 10 * time.Second}, now)
}

func (g *inboundFrameGuard) rejectFrame(conn *websocket.Conn, now time.Time) error {
	_ = conn.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "Incoming message limit exceeded"),
		now.Add(writeWait))
	return errInboundFrameLimit
}

// Gorilla processes ping/pong frames inside ReadMessage, so the read loop's
// data-message check alone cannot bound them. Both handlers run on that same
// reader and consume its shared budget before responding or renewing a deadline.
// Preserve the existing handlers, including the default ping-to-pong response.
// The clock parameter lets socket checks exercise the burst without real sleeps.
func (g *inboundFrameGuard) installControlHandlers(conn *websocket.Conn, clock func() time.Time) {
	ping, pong := conn.PingHandler(), conn.PongHandler()
	protect := func(next func(string) error) func(string) error {
		return func(payload string) error {
			now := clock()
			if !g.acceptFrame(now) {
				return g.rejectFrame(conn, now)
			}
			return next(payload)
		}
	}
	conn.SetPingHandler(protect(ping))
	conn.SetPongHandler(protect(pong))
}
