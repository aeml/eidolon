package game

import (
	"errors"
	"math"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestSellerPayoutReservesWithoutPrematureClaimOrCredit(t *testing.T) {
	ts := NewTradingSystem(nil)
	seller := &Entity{ID: "player-seller", Name: "seller", Gold: 100}
	a := &Auction{ID: "payout", SellerID: seller.ID, SellerName: seller.Name,
		Status: AuctionSold, SalePrice: 100, Bid: 43, Deposit: 5, BuyerID: "player-buyer", EndTime: time.Now()}
	ts.Auctions[a.ID] = a
	op, err := ts.PrepareAuctionSellerPayout(a.ID, seller)
	if err != nil || op == nil || op.Amount != 100 || op.Fee != 5 || !op.Valid() || seller.Gold != 100 || a.SellerClaimed {
		t.Fatal("seller preparation changed funds/claim or calculated the wrong payout")
	}
	if _, err := ts.CollectAuction(a.ID, seller); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("claim bypassed durable reservation")
	}
	if _, err := ts.PrepareAuctionSellerPayout(a.ID, seller); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("second seller claim bypassed reservation")
	}
	if err := database.ApplyGoldCredit(&seller.Gold, &seller.GoldCreditReceipts, "seller-payout:"+op.ID, op.Amount); err != nil {
		t.Fatal(err)
	}
	if err := ts.CompleteAuctionBid(*op); err != nil {
		t.Fatal(err)
	}
	settled := ts.Auctions[a.ID]
	if !settled.SellerClaimed || settled.ItemClaimed || settled.Bid != 43 || settled.BuyerID != a.BuyerID || seller.Gold != 200 || len(settled.PendingRefunds) != 0 {
		t.Fatal("payout changed buyer escrow/item or lost payment")
	}
	if op, err := ts.PrepareAuctionSellerPayout(a.ID, seller); err != nil || op != nil {
		t.Fatal("already claimed seller payout was prepared again")
	}
	ts.CleanupExpired()
	if ts.Auctions[a.ID] == nil {
		t.Fatal("seller payout removed unclaimed buyer item")
	}
	settled.ItemClaimed = true
	ts.CleanupExpired()
	if ts.Auctions[a.ID] != nil {
		t.Fatal("fully settled auction did not become eligible for cleanup")
	}
}

func TestSellerPayoutRejectsOverflowAndPreservesOtherCollections(t *testing.T) {
	ts := NewTradingSystem(nil)
	seller := &Entity{ID: "player-seller", Name: "seller", Gold: math.MaxInt}
	a := &Auction{ID: "payout", SellerID: seller.ID, Status: AuctionSold, Bid: 100, Deposit: 5, EndTime: time.Now()}
	ts.Auctions[a.ID] = a
	if op, err := ts.PrepareAuctionSellerPayout(a.ID, seller); err == nil || op != nil || len(ts.PendingBidOperations("")) != 0 {
		t.Fatal("overflowing payout was reserved")
	}
	seller.Gold, a.Deposit = 0, math.MaxInt
	if _, err := ts.PrepareAuctionSellerPayout(a.ID, seller); err == nil {
		t.Fatal("overflowing price/deposit sum accepted")
	}
	a.Status = AuctionExpired
	if op, err := ts.PrepareAuctionSellerPayout(a.ID, seller); err != nil || op != nil {
		t.Fatal("item-return collection was mistaken for a gold payout")
	}
}

func TestSellerPayoutWaitsForConfirmedExpiryAndBuyoutCannotDiscardWinner(t *testing.T) {
	ts := NewTradingSystem(nil)
	seller := &Entity{ID: "player-seller", Name: "seller", Gold: 100}
	a := &Auction{ID: "expired-sale", SellerID: seller.ID, SellerName: seller.Name,
		Status: AuctionActive, Bid: 100, BidderID: "player-winner", BidderName: "winner",
		Deposit: 5, Buyout: 500, EndTime: time.Now().Add(-time.Minute)}
	ts.Auctions[a.ID] = a
	ts.cleanupExpiredWithPersistence(func(saved *database.Auction) error {
		if saved.Status != "SOLD" || saved.BuyerID != a.BidderID || saved.SalePrice != 100 {
			t.Fatal("expiry did not prepare the winning sale")
		}
		return errors.New("sale acknowledgement failed")
	})
	if a.Status != AuctionActive || a.SalePrice != 0 || a.BuyerID != "" {
		t.Fatal("unconfirmed expiry exposed seller payout/item eligibility")
	}
	if op, err := ts.PrepareAuctionSellerPayout(a.ID, seller); err != nil || op != nil {
		t.Fatal("unconfirmed sale reserved a payout")
	}
	if _, err := ts.BuyoutAuction(a.ID, &Entity{ID: "player-other", Gold: 500}, nil); err == nil || a.Status != AuctionActive {
		t.Fatal("expired buyout altered the pending winner/sale state")
	}
	ts.cleanupExpiredWithPersistence(func(*database.Auction) error { return nil })
	op, err := ts.PrepareAuctionSellerPayout(a.ID, seller)
	if err != nil || op == nil || op.Amount != 100 || a.Status != AuctionSold || a.BuyerID != a.BidderID {
		t.Fatal("confirmed winning sale did not enable exactly its seller payout")
	}
}
