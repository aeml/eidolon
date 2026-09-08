package database

import (
	"testing"
	"time"
)

func TestAuctionOperationKindValidation(t *testing.T) {
	op := AuctionBidOperation{ID: "op", AuctionID: "auction", PlayerID: "player-seller", CharacterName: "seller", Amount: 100, EndTime: time.Now()}
	if !op.Valid() {
		t.Fatal("legacy kindless bid should remain valid")
	}
	op.Kind, op.Fee = AuctionOperationSellerPayout, 5
	if !op.Valid() {
		t.Fatal("seller payout should be valid")
	}
	op.RefundID = "wrong-displaced-bid"
	if op.Valid() {
		t.Fatal("seller payout may not append a bidder refund")
	}
	op.RefundID, op.Kind = "", "future-operation"
	if op.Valid() {
		t.Fatal("unknown operation kind must fail closed")
	}
}
