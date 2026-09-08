package game

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func backlogTradingSystem(count int) *TradingSystem {
	ts := NewTradingSystem(nil)
	for i := 0; i < count; i++ {
		id := fmt.Sprintf("auction-%04d", i)
		ts.Auctions[id] = &Auction{ID: id, PendingRefunds: []database.AuctionRefund{{
			ID: fmt.Sprintf("refund-%04d", i), PlayerID: "player-test", CharacterName: "test", Amount: 1,
		}}}
	}
	return ts
}

func pendingRefundCount(ts *TradingSystem) int {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	count := 0
	for _, auction := range ts.Auctions {
		count += len(auction.PendingRefunds)
	}
	return count
}

func TestRefundBacklogStopsAtFirstFailureAndRotatesFairly(t *testing.T) {
	ts := backlogTradingSystem(1000)
	var attempted []string
	ts.SetRefundDelivery(func(refund database.AuctionRefund) error {
		attempted = append(attempted, refund.ID)
		return errors.New("database unavailable")
	})
	for i := 0; i < 3; i++ {
		if err := ts.RetryPendingRefunds(); err == nil || len(attempted) != i+1 {
			t.Fatal("one outage multiplied attempts across backlog")
		}
	}
	if attempted[0] == attempted[1] || attempted[1] == attempted[2] || pendingRefundCount(ts) != 1000 {
		t.Fatal("failure starved later recipients or dropped intent")
	}
	if !time.Now().Before(ts.refundRetryAfter) {
		t.Fatal("failed attempt did not back off automatic work")
	}
	for i := 0; i < 100; i++ {
		ts.ScheduleRefundDelivery()
	}
	ts.backgroundWork.SealWhenIdle()
	if len(attempted) != 3 {
		t.Fatal("automatic scheduling ignored outage backoff")
	}
}

func TestRefundRetryIsBoundedAndEventuallyDrainsHealthyBacklog(t *testing.T) {
	ts := backlogTradingSystem(100)
	seen := make(map[string]bool)
	ts.SetRefundDelivery(func(refund database.AuctionRefund) error {
		if seen[refund.ID] {
			t.Fatal("already acknowledged credit repeated")
		}
		seen[refund.ID] = true
		return nil
	})
	if err := ts.RetryPendingRefunds(); err != nil {
		t.Fatal(err)
	}
	if len(seen) == 0 || len(seen) > refundBatchLimit || pendingRefundCount(ts) == 0 {
		t.Fatal("retry pass did not respect finite batch")
	}
	for pass := 0; pass < 100 && pendingRefundCount(ts) != 0; pass++ {
		if err := ts.RetryPendingRefunds(); err != nil {
			t.Fatal(err)
		}
	}
	if len(seen) != 100 || pendingRefundCount(ts) != 0 {
		t.Fatal("bounded passes lost/starved refunds")
	}
}

func TestRefundWorkerCoalescesConcurrentRequestsAndStopsAfterInflightSave(t *testing.T) {
	ts := backlogTradingSystem(1000)
	entered, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	ts.SetRefundDelivery(func(database.AuctionRefund) error {
		if calls.Add(1) == 1 {
			close(entered)
		}
		<-release
		return nil
	})
	ts.ScheduleRefundDelivery()
	<-entered
	var requests sync.WaitGroup
	for i := 0; i < 100; i++ {
		requests.Add(1)
		go func() { defer requests.Done(); ts.ScheduleRefundDelivery(); ts.RetryPendingRefunds() }()
	}
	requests.Wait() // Requests must not block behind the in-flight delivery.
	ts.StopRefundDelivery()
	finished := make(chan struct{})
	go func() { ts.backgroundWork.SealWhenIdle(); close(finished) }()
	select {
	case <-finished:
		t.Fatal("shutdown did not wait for in-flight durable delivery")
	default:
	}
	close(release)
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("shutdown drained the backlog instead of just the in-flight credit")
	}
	for i := 0; i < 100; i++ {
		ts.ScheduleRefundDelivery()
		ts.RetryPendingRefunds()
	}
	if calls.Load() != 1 || pendingRefundCount(ts) != 999 {
		t.Fatal("shutdown admitted more credits or dropped pending intents")
	}
}

func TestAuctionLoadFailureCannotLookLikeReadyEmptyMarket(t *testing.T) {
	ts := NewTradingSystem(nil)
	unavailable := errors.New("auction collection unavailable")
	ts.loadAuctionSnapshot(func() ([]*database.Auction, error) { return nil, unavailable })
	if !errors.Is(ts.ReadinessError(), unavailable) || !errors.Is(ts.RetryPendingRefunds(), unavailable) {
		t.Fatal("failed load reported a ready empty outbox")
	}
	ts.loadAuctionSnapshot(func() ([]*database.Auction, error) {
		return []*database.Auction{{ID: "durable", PendingRefunds: []database.AuctionRefund{{ID: "unpaid", Amount: 43}}}}, nil
	})
	if ts.ReadinessError() != nil || pendingRefundCount(ts) != 1 {
		t.Fatal("successful load lost the durable refund")
	}
}
