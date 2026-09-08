package game

import (
	"errors"
	"log"
	"sort"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

const RefundRetryInterval = 10 * time.Second
const refundBatchLimit = 32
const refundPassBudget = 2 * time.Second // Soft budget checked between bounded IO calls.

func (ts *TradingSystem) SetRefundDelivery(deliver func(database.AuctionRefund) error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	ts.deliverRefund = deliver
}

// Caller holds trading lock. The pending intent is persisted in the very same
// auction document update that replaces/cancels the previous escrowed bid.
func (ts *TradingSystem) appendBidRefundLocked(auction *Auction) {
	if auction.BidderID != "" && auction.Bid > 0 {
		auction.PendingRefunds = append(auction.PendingRefunds, database.AuctionRefund{
			ID: uuid.NewString(), PlayerID: auction.BidderID,
			CharacterName: auction.BidderName, Amount: auction.Bid,
		})
	}
}

func (ts *TradingSystem) scheduleRefundDeliveryLocked() {
	if ts.deliverRefund == nil || ts.refundScheduled || ts.refundStopping.Load() || time.Now().Before(ts.refundRetryAfter) {
		return
	}
	ts.refundScheduled = true
	if !ts.backgroundWork.Go(func() {
		if err := ts.RetryPendingRefunds(); err != nil {
			log.Printf("Auction refunds remain pending: %v", err)
		}
		ts.mu.Lock()
		ts.refundScheduled = false
		ts.mu.Unlock()
	}) {
		ts.refundScheduled = false
	}
}

// Seal retry admission before waiting for command/tick shutdown. An in-flight
// delivery finishes its durable save, but remaining intents stay for restart.
func (ts *TradingSystem) StopRefundDelivery() { ts.refundStopping.Store(true) }

func (ts *TradingSystem) ScheduleRefundDelivery() {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	ts.scheduleRefundDeliveryLocked()
}

// No trading/world lock is held during account persistence. Serialize workers,
// retain failures, and acknowledge only after gold and its receipt are durable.
// Startup explicitly attempts one pass. Automatic periodic work uses
// ScheduleRefundDelivery to honor backoff and coalesce concurrent requests.
func (ts *TradingSystem) RetryPendingRefunds() (result error) {
	// A periodic tick must not queue behind the same work already running.
	if ts.refundStopping.Load() || !ts.refundMu.TryLock() {
		return nil
	}
	defer ts.refundMu.Unlock()
	if ts.refundStopping.Load() {
		return nil
	}
	defer func() {
		if result != nil {
			ts.mu.Lock()
			ts.refundRetryAfter = time.Now().Add(RefundRetryInterval)
			ts.mu.Unlock()
		}
	}()
	type delivery struct {
		auctionID string
		refund    database.AuctionRefund
	}
	ts.mu.RLock()
	if ts.loadError != nil {
		err := ts.loadError
		ts.mu.RUnlock()
		return err
	}
	deliver := ts.deliverRefund
	cursor := ts.refundCursor
	var pending []delivery
	for id, auction := range ts.Auctions {
		if _, reserved := ts.pendingBids[id]; reserved {
			continue
		}
		for _, refund := range auction.PendingRefunds {
			pending = append(pending, delivery{id, refund})
		}
	}
	ts.mu.RUnlock()
	if len(pending) == 0 {
		return nil
	}
	if deliver == nil {
		return errors.New("auction refund delivery is not configured")
	}
	key := func(task delivery) string { return task.auctionID + "/" + task.refund.ID }
	sort.Slice(pending, func(i, j int) bool { return key(pending[i]) < key(pending[j]) })
	start := sort.Search(len(pending), func(i int) bool { return key(pending[i]) > cursor }) % len(pending)
	deadline := time.Now().Add(refundPassBudget)
	for i := 0; i < len(pending) && i < refundBatchLimit; i++ {
		if ts.refundStopping.Load() || time.Now().After(deadline) {
			break
		}
		task := pending[(start+i)%len(pending)]
		// Advance even after failure so one invalid recipient cannot starve all
		// later accounts on subsequent periodic passes.
		ts.mu.Lock()
		ts.refundCursor = key(task)
		ts.mu.Unlock()
		if err := deliver(task.refund); err != nil {
			return err // Do not multiply an outage timeout by the entire backlog.
		}
		ts.mu.Lock()
		auction := ts.Auctions[task.auctionID]
		if _, reserved := ts.pendingBids[task.auctionID]; reserved {
			ts.mu.Unlock()
			continue
		}
		if auction != nil {
			previous := auction.PendingRefunds
			remaining := make([]database.AuctionRefund, 0, len(previous))
			for _, refund := range previous {
				if refund.ID != task.refund.ID {
					remaining = append(remaining, refund)
				}
			}
			auction.PendingRefunds = remaining
			if err := ts.persistOrDeleteClaimedAuction(task.auctionID, auction); err != nil {
				auction.PendingRefunds = previous
				ts.mu.Unlock()
				return err
			}
		}
		ts.mu.Unlock()
	}
	return nil
}
