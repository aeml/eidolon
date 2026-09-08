package database

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
)

// ListingStart/EndTime on the operation describe request preparation. The paid
// auction window starts at first publication, after escrow has been committed.
func AuctionFromListingOperation(op AuctionBidOperation, publishedAt time.Time) (*Auction, error) {
	if op.Kind != AuctionOperationListing || !op.Valid() || publishedAt.IsZero() {
		return nil, errors.New("invalid auction listing decision")
	}
	var item Item
	if err := json.Unmarshal([]byte(op.ItemPayload), &item); err != nil {
		return nil, err
	}
	start := publishedAt.UTC().Truncate(time.Millisecond)
	if prepared := op.ListingStart.UTC().Truncate(time.Millisecond); start.Before(prepared) {
		start = prepared // A backwards clock cannot publish before the request.
	}
	return &Auction{ID: op.AuctionID, SellerID: op.PlayerID, SellerName: op.CharacterName, Item: item,
		Bid: op.ListingBid, Buyout: op.ListingBuyout, Duration: op.ListingHours, StartTime: start,
		EndTime: start.Add(time.Duration(op.ListingHours) * time.Hour), Status: "ACTIVE", Deposit: op.Amount, LastBidOperationID: op.ID}, nil
}

func matchesPublishedListing(op AuctionBidOperation, existing *Auction) bool {
	if existing == nil {
		return false
	}
	// Recognize the first successful insert, including an acknowledgement-lost
	// insert. Reuse its timestamp; retries must never extend an existing auction.
	expected, err := AuctionFromListingOperation(op, existing.StartTime)
	return err == nil && reflect.DeepEqual(existing, expected)
}

// Publish only after full-character escrow committed. The unique auction ID
// and exact immutable listing let a retry recognize an acknowledged-lost insert.
func (db *DB) commitAuctionListing(op AuctionBidOperation) (*Auction, error) {
	expected, err := AuctionFromListingOperation(op, time.Now())
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.auctions.InsertOne(ctx, expected); err != nil && !mongo.IsDuplicateKeyError(err) {
		return nil, err
	}
	existing, err := db.GetAuction(op.AuctionID)
	if err != nil {
		return nil, err
	}
	if !matchesPublishedListing(op, existing) {
		return nil, errors.New("listing identity already belongs to different auction state")
	}
	return existing, nil
}
