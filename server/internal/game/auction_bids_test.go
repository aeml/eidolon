package game

import (
	"errors"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestPendingBidReservesAuctionWithoutDebitingAndBlocksOtherMutations(t *testing.T) {
	ts := NewTradingSystem(nil)
	a := refundAuction()
	ts.Auctions[a.ID] = a
	bidder := &Entity{ID: "player-new", Name: "new", Gold: 100}
	op, err := ts.PrepareAuctionBid(a.ID, bidder, 50)
	if err != nil || bidder.Gold != 100 || a.Bid != 43 || len(a.PendingRefunds) != 0 {
		t.Fatal("preparation mutated funds/current bid")
	}
	if _, err := ts.PrepareAuctionBid(a.ID, bidder, 60); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("second bid bypassed reservation")
	}
	if _, err := ts.BuyoutAuction(a.ID, bidder, nil); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("buyout bypassed reservation")
	}
	seller := &Entity{ID: a.SellerID}
	if _, err := ts.CollectAuction(a.ID, seller); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("collection bypassed reservation")
	}
	if err := ts.CancelAuction(a.ID, seller, nil); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("cancellation bypassed reservation")
	}
	a.EndTime = time.Now().Add(-time.Minute)
	ts.CleanupExpired()
	ts.RemoveAuction(a.ID)
	if ts.Auctions[a.ID] == nil || a.Status != AuctionActive {
		t.Fatal("expiry/removal bypassed reservation")
	}
	if err := ts.EnsureBidDecision(op); err != nil {
		t.Fatal(err)
	}
	if err := database.ApplyGoldDebit(&bidder.Gold, &bidder.GoldCreditReceipts, "bid:"+op.ID, 50); err != nil {
		t.Fatal(err)
	}
	if err := ts.CompleteAuctionBid(op); err != nil {
		t.Fatal(err)
	}
	finished := ts.Auctions[a.ID]
	if finished.Bid != 50 || finished.LastBidOperationID != op.ID || len(finished.PendingRefunds) != 1 || finished.PendingRefunds[0].ID != op.RefundID || bidder.Gold != 50 {
		t.Fatal("final bid/refund/debit mismatch")
	}
}

func TestConcurrentPendingBidHasOneReservationAndNoPrematureDebits(t *testing.T) {
	ts := NewTradingSystem(nil)
	a := refundAuction()
	ts.Auctions[a.ID] = a
	var wg sync.WaitGroup
	results := make(chan error, 2)
	players := []*Entity{{ID: "player-one", Name: "one", Gold: 100}, {ID: "player-two", Name: "two", Gold: 100}}
	for _, player := range players {
		wg.Add(1)
		go func(p *Entity) { defer wg.Done(); _, err := ts.PrepareAuctionBid(a.ID, p, 50); results <- err }(player)
	}
	wg.Wait()
	close(results)
	accepted := 0
	for err := range results {
		if err == nil {
			accepted++
		} else if !errors.Is(err, ErrAuctionBidPending) {
			t.Fatal(err)
		}
	}
	if accepted != 1 || len(ts.PendingBidOperations("")) != 1 || players[0].Gold != 100 || players[1].Gold != 100 {
		t.Fatal("competing bids reserved/charged more than once")
	}
}
