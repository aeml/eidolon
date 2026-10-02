package main

import (
	"testing"
	"time"
)

func TestInboundFrameGuardBoundsBeforeParsingAndRefills(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	for i := 0; i < 300; i++ {
		if !guard.acceptFrame(now) {
			t.Fatal("declared initial frame burst rejected")
		}
	}
	if guard.acceptFrame(now) || guard.acceptFrame(now.Add(-time.Hour)) {
		t.Fatal("frame flood or clock rewind bypassed guard")
	}
	if !guard.acceptFrame(now.Add(5*time.Millisecond)) || guard.acceptFrame(now.Add(5*time.Millisecond)) {
		t.Fatal("frame refill is not 200/second")
	}
}

func TestInboundFrameGuardMalformedBudgetIsSeparateAndConnectionLocal(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	for i := 0; i < 8; i++ {
		if !guard.acceptMalformed(now) {
			t.Fatal("declared malformed allowance rejected")
		}
	}
	if guard.acceptMalformed(now) || !guard.acceptFrame(now) {
		t.Fatal("malformed flood admitted or spent ordinary frame budget")
	}
	other := newInboundFrameGuard(now)
	if !other.acceptMalformed(now) || !other.acceptFrame(now) {
		t.Fatal("one connection exhausted another's budget")
	}
	if !guard.acceptMalformed(now.Add(1250*time.Millisecond)) || guard.acceptMalformed(now.Add(1250*time.Millisecond)) {
		t.Fatal("malformed refill changed")
	}
}

func TestInboundFrameGuardAllowsSustainedOrdinaryMixedTraffic(t *testing.T) {
	now := time.Unix(1000, 0)
	guard := newInboundFrameGuard(now)
	// Ninety moves/second plus sixty other actions/second remain inside the
	// aggregate guard. The per-message rules still decide actual admission.
	for i := 0; i < 1500; i++ {
		if !guard.acceptFrame(now.Add(time.Duration(i) * time.Second / 150)) {
			t.Fatalf("ordinary mixed stream rejected at sample %d", i)
		}
	}
}
