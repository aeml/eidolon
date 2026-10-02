package main

import (
	"testing"
	"time"
)

func TestInboundByteGuardBoundsLargeFramesBeforeFrameCount(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	for i := 0; i < inboundByteBurst/maxMessageSize; i++ {
		if !guard.acceptPayload(maxMessageSize, now) {
			t.Fatal("declared byte burst rejected")
		}
	}
	if guard.acceptPayload(1, now) || guard.acceptPayload(1, now.Add(-time.Hour)) {
		t.Fatal("payload flood or clock rewind bypassed byte guard")
	}
	if guard.frames.tokens <= 200 {
		t.Fatal("test must exhaust bytes, not the old frame-count limit")
	}
	if !guard.acceptPayload(maxMessageSize, now.Add(125*time.Millisecond)) || guard.acceptPayload(1, now.Add(125*time.Millisecond)) {
		t.Fatal("byte refill changed from64KiB/second")
	}
	for i := 0; i < inboundByteBurst/maxMessageSize; i++ {
		if !guard.acceptPayload(maxMessageSize, now.Add(time.Hour)) {
			t.Fatal("long-idle burst did not refill")
		}
	}
	if guard.acceptPayload(1, now.Add(time.Hour)) {
		t.Fatal("idle bank exceeded its declared cap")
	}
}

func TestInboundByteGuardPreservesMixedTrafficAndConnectionIsolation(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	//90 movement samples at256B plus60 other actions at512B per second:
	//53,760B/s, below the sustained budget, including100 seconds after burst.
	for i := 0; i < inboundByteBurst/maxMessageSize; i++ {
		if !guard.acceptPayload(maxMessageSize, now) {
			t.Fatal("initial heavy request burst rejected")
		}
	}
	for i := 0; i < 15000; i++ {
		size := 256
		if i%5 >= 3 {
			size = 512
		}
		if !guard.acceptPayload(size, now.Add(time.Duration(i+1)*time.Second/150)) {
			t.Fatalf("ordinary mixed input rejected at%d", i)
		}
	}
	other := newInboundFrameGuard(now)
	for i := 0; i < inboundByteBurst/maxMessageSize; i++ {
		if !other.acceptPayload(maxMessageSize, now) {
			t.Fatal("one connection spent another's budget")
		}
	}
	if other.acceptPayload(1, now) || !newInboundFrameGuard(now).acceptPayload(1, now) {
		t.Fatal("byte admission is not connection-local")
	}
}

func TestInboundByteGuardRejectsInvalidSizesWithoutSpendingBudget(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	for _, size := range []int{-1, maxMessageSize + 1} {
		if guard.acceptPayload(size, now) {
			t.Fatal("invalid payload size admitted")
		}
	}
	if guard.bytes.tokens != inboundByteBurst || guard.frames.tokens != 300 {
		t.Fatal("invalid size mutated admission state")
	}
	if !guard.acceptPayload(0, now) || guard.frames.tokens != 299 || guard.bytes.tokens != inboundByteBurst {
		t.Fatal("empty payload bypassed frame-count accounting")
	}
}
