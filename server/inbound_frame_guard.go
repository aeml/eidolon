package main

import "time"

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
