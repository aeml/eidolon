package database

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
)

func AuctionFromListingOperation(op AuctionBidOperation) (*Auction, error) {
	if op.Kind != AuctionOperationListing || !op.Valid() {
		return nil, errors.New("invalid auction listing decision")
	}
	var item Item
	if err := json.Unmarshal([]byte(op.ItemPayload), &item); err != nil {
		return nil, err
	}
	return &Auction{ID: op.AuctionID, SellerID: op.PlayerID, SellerName: op.CharacterName, Item: item,
		Bid: op.ListingBid, Buyout: op.ListingBuyout, Duration: op.ListingHours, StartTime: op.ListingStart.UTC().Truncate(time.Millisecond),
		EndTime: op.EndTime.UTC().Truncate(time.Millisecond), Status: "ACTIVE", Deposit: op.Amount, LastBidOperationID: op.ID}, nil
}

// Publish only after full-character escrow committed. The unique auction ID
// and exact immutable listing let a retry recognize an acknowledged-lost insert.
func (db *DB) commitAuctionListing(op AuctionBidOperation) (*Auction, error) {
	expected, err := AuctionFromListingOperation(op)
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
	if !reflect.DeepEqual(existing, expected) {
		return nil, errors.New("listing identity already belongs to different auction state")
	}
	return existing, nil
}
