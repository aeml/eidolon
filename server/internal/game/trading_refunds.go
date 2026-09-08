package game

import (
	"errors"
	"log"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

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
	if ts.deliverRefund != nil {
		ts.backgroundWork.Go(func() {
			if err := ts.RetryPendingRefunds(); err != nil {
				log.Printf("Auction refunds remain pending: %v", err)
			}
		})
	}
}

// No trading/world lock is held during account persistence. Serialize workers,
// retain failures, and acknowledge only after gold and its receipt are durable.
// Startup and the existing periodic save loop also retry this durable outbox.
func (ts *TradingSystem) RetryPendingRefunds() error {
	ts.refundMu.Lock()
	defer ts.refundMu.Unlock()
	type delivery struct {
		auctionID string
		refund    database.AuctionRefund
	}
	ts.mu.RLock()
	deliver := ts.deliverRefund
	var pending []delivery
	for id, auction := range ts.Auctions {
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
	var failures []error
	for _, task := range pending {
		if err := deliver(task.refund); err != nil {
			failures = append(failures, err)
			continue
		}
		ts.mu.Lock()
		auction := ts.Auctions[task.auctionID]
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
				failures = append(failures, err)
			}
		}
		ts.mu.Unlock()
	}
	return errors.Join(failures...)
}
