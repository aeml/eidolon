package game

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

var ErrAuctionBidPending = errors.New("auction bid is still being saved; please retry shortly")

// A nil operation means this is not an unclaimed seller-gold collection; the
// caller must still use the ordinary authorization/item-collection path.
func (ts *TradingSystem) PrepareAuctionSellerPayout(auctionID string, seller *Entity) (*database.AuctionBidOperation, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.loadError != nil {
		return nil, ts.loadError
	}
	if _, reserved := ts.pendingBids[auctionID]; reserved {
		return nil, ErrAuctionBidPending
	}
	a := ts.Auctions[auctionID]
	if a == nil || seller == nil {
		return nil, errors.New("auction or seller not found")
	}
	seller.Mu.RLock()
	defer seller.Mu.RUnlock()
	if a.SellerID != seller.ID || a.Status != AuctionSold || a.SellerClaimed {
		return nil, nil
	}
	price := a.SalePrice
	if price <= 0 {
		price = a.Bid
	}
	fee := int(float64(price) * TradingSalesFeePercent)
	if price <= 0 || a.Deposit < 0 || fee < 0 || fee > price || a.Deposit > math.MaxInt-(price-fee) {
		return nil, errors.New("invalid auction payout")
	}
	amount := price - fee + a.Deposit
	if seller.Gold < 0 || seller.Gold > math.MaxInt-amount {
		return nil, errors.New("auction payout exceeds gold capacity")
	}
	op := database.AuctionBidOperation{Kind: database.AuctionOperationSellerPayout,
		ID: uuid.NewString(), AuctionID: auctionID, PlayerID: seller.ID, CharacterName: seller.Name,
		Amount: amount, Fee: fee, EndTime: a.EndTime.UTC().Truncate(time.Millisecond)}
	if !op.Valid() {
		return nil, errors.New("invalid auction seller identity")
	}
	ts.pendingBids[auctionID] = op
	return &op, nil
}

func (ts *TradingSystem) bidWithoutDatabase(auctionID string, bidder *Entity, amount int) error {
	if ts.db != nil {
		return errors.New("persistent bids require a journaled account operation")
	}
	op, err := ts.PrepareAuctionBid(auctionID, bidder, amount)
	if err != nil {
		return err
	}
	bidder.Mu.Lock()
	err = database.ApplyGoldDebit(&bidder.Gold, &bidder.GoldCreditReceipts, "bid:"+op.ID, amount)
	bidder.Mu.Unlock()
	if err != nil {
		ts.AbortUnfundedAuctionBid(op)
		return err
	}
	return ts.CompleteAuctionBid(op)
}

func (ts *TradingSystem) loadBidOperations() {
	ops, err := ts.db.LoadAuctionBidOperations()
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if err != nil {
		ts.loadError = err
		return
	}
	for _, op := range ops {
		if ts.Auctions[op.AuctionID] == nil {
			ts.loadError = errors.New("pending bid references a missing auction")
			return
		}
		ts.pendingBids[op.AuctionID] = op
	}
}

func (ts *TradingSystem) PendingBidOperations(playerID string) []database.AuctionBidOperation {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	var ops []database.AuctionBidOperation
	for _, op := range ts.pendingBids {
		if playerID == "" || op.PlayerID == playerID {
			ops = append(ops, op)
		}
	}
	sort.Slice(ops, func(i, j int) bool { return ops[i].ID < ops[j].ID })
	return ops
}

// Caller owns the actor's account lock. Reserve memory before any IO, but never
// hold the trading lock while saving a character or acquiring account locks.
func (ts *TradingSystem) PrepareAuctionBid(auctionID string, bidder *Entity, amount int) (database.AuctionBidOperation, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	var empty database.AuctionBidOperation
	a := ts.Auctions[auctionID]
	if ts.loadError != nil {
		return empty, ts.loadError
	}
	if a == nil {
		return empty, errors.New("auction not found")
	}
	if _, pending := ts.pendingBids[auctionID]; pending {
		return empty, ErrAuctionBidPending
	}
	if a.Status != AuctionActive || time.Now().After(a.EndTime) {
		return empty, errors.New("auction is not active")
	}
	if bidder == nil {
		return empty, errors.New("bidder not found")
	}
	bidder.Mu.RLock()
	defer bidder.Mu.RUnlock()
	if bidder.ID == a.SellerID {
		return empty, errors.New("cannot bid on your own auction")
	}
	minimum := a.Bid + int(float64(a.Bid)*0.05)
	if minimum < a.Bid+1 {
		minimum = a.Bid + 1
	}
	if a.BidderID == "" {
		minimum = a.Bid
	}
	if amount <= 0 || amount < minimum {
		return empty, fmt.Errorf("bid too low (minimum: %d)", minimum)
	}
	if a.Buyout > 0 && amount >= a.Buyout {
		return empty, errors.New("bid exceeds buyout, use buyout instead")
	}
	if bidder.Gold < amount {
		return empty, database.ErrInsufficientGold
	}
	end := a.EndTime.UTC().Truncate(time.Millisecond)
	if time.Until(end) < 5*time.Minute {
		end = end.Add(5 * time.Minute)
	}
	op := database.AuctionBidOperation{ID: uuid.NewString(), AuctionID: auctionID,
		PlayerID: bidder.ID, CharacterName: bidder.Name, Amount: amount, PreviousBid: a.Bid,
		PreviousBidderID: a.BidderID, PreviousBidderName: a.BidderName,
		EndTime: end, RefundID: uuid.NewString()}
	if !op.Valid() {
		return empty, errors.New("invalid auction bid identity")
	}
	ts.pendingBids[auctionID] = op
	return op, nil
}

func (ts *TradingSystem) ownsBidOperation(op database.AuctionBidOperation) bool {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	return ts.pendingBids[op.AuctionID] == op
}

func (ts *TradingSystem) EnsureBidDecision(op database.AuctionBidOperation) error {
	if !ts.ownsBidOperation(op) {
		return ErrAuctionBidPending
	}
	if ts.db == nil {
		return nil
	}
	// Ambiguous insert? Keep the reservation and replay this immutable ID.
	return ts.db.EnsureAuctionBidOperation(op)
}

// Debit+receipt must already be committed by the account owner. While this
// reservation exists, other mutations/expiry/refund acknowledgements skip it.
func (ts *TradingSystem) CompleteAuctionBid(op database.AuctionBidOperation) error {
	if !ts.ownsBidOperation(op) {
		return ErrAuctionBidPending
	}
	var saved *Auction
	if ts.db != nil {
		value, err := ts.db.CommitAuctionBidOperation(op)
		if err != nil {
			return err
		}
		saved = ts.fromDBAuction(value)
	} else {
		ts.mu.RLock()
		original := *ts.Auctions[op.AuctionID]
		original.PendingRefunds = append([]database.AuctionRefund(nil), original.PendingRefunds...)
		ts.mu.RUnlock()
		saved = &original
		if op.Kind == database.AuctionOperationSellerPayout {
			saved.SellerClaimed, saved.LastBidOperationID = true, op.ID
		} else if saved.LastBidOperationID != op.ID {
			saved.Bid, saved.BidderID, saved.BidderName, saved.EndTime, saved.LastBidOperationID = op.Amount, op.PlayerID, op.CharacterName, op.EndTime, op.ID
			if op.PreviousBidderID != "" && op.PreviousBid > 0 {
				saved.PendingRefunds = append(saved.PendingRefunds, database.AuctionRefund{ID: op.RefundID, PlayerID: op.PreviousBidderID, CharacterName: op.PreviousBidderName, Amount: op.PreviousBid})
			}
		}
	}
	if ts.db != nil {
		if err := ts.db.DeleteAuctionBidOperation(op); err != nil {
			return err
		}
	}
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.pendingBids[op.AuctionID] != op {
		return ErrAuctionBidPending
	}
	ts.Auctions[op.AuctionID] = saved
	delete(ts.pendingBids, op.AuctionID)
	if op.Kind == database.AuctionOperationSellerPayout && ts.economy != nil {
		ts.economy.RecordSink("trading_house_fee", op.Fee)
	}
	ts.scheduleRefundDeliveryLocked()
	return nil
}

// Only call when a missing debit receipt and insufficient funds are proven.
func (ts *TradingSystem) AbortUnfundedAuctionBid(op database.AuctionBidOperation) error {
	if !ts.ownsBidOperation(op) {
		return ErrAuctionBidPending
	}
	if ts.db != nil {
		if err := ts.db.DeleteAuctionBidOperation(op); err != nil {
			return err
		}
	}
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.pendingBids[op.AuctionID] == op {
		delete(ts.pendingBids, op.AuctionID)
	}
	return nil
}
