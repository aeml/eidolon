package main

import (
	"testing"
	"time"
)

func TestCasinoTableClockIndependentOfWagers(t *testing.T) {
	now := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	deadline := nextCasinoBettingDeadline(time.Time{}, now)
	if !deadline.Equal(now.Add(30 * time.Second)) {
		t.Fatal("missing first window")
	}
	if nextCasinoBettingDeadline(deadline, now.Add(time.Second)) != deadline {
		t.Fatal("window reset")
	}
	if !nextCasinoBettingDeadline(deadline, deadline).Equal(deadline.Add(30 * time.Second)) {
		t.Fatal("empty window stopped")
	}
	if !nextCasinoBettingDeadline(deadline, now.Add(5*time.Minute)).Equal(now.Add(330 * time.Second)) {
		t.Fatal("downtime catch-up failed")
	}
	bj, err := newBlackjackLobby()
	if err != nil {
		t.Fatal(err)
	}
	poker, err := newPokerLobby(-1)
	if err != nil {
		t.Fatal(err)
	}
	if bj.DealAt.IsZero() || poker.DealAt.IsZero() || len(bj.Players) != 0 || len(poker.Players) != 0 {
		t.Fatal("empty lobbies lack deadlines")
	}
}
