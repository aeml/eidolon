package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const AuctionRecoveryPageSize = 50

// Both auction collections already have unique ascending id indexes. These
// pages retain complete private claims/refunds/intents; do not filter away an
// outstanding entitlement merely because a listing is no longer active.
func (db *DB) LoadAuctionsPage(afterID string, limit int) ([]*Auction, error) {
	if limit < 1 || limit > AuctionRecoveryPageSize {
		return nil, errors.New("invalid auction recovery page size")
	}
	if db == nil || db.auctions == nil {
		return nil, errors.New("auction collection unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{}
	if afterID != "" {
		filter["id"] = bson.M{"$gt": afterID}
	}
	cursor, err := db.auctions.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "id", Value: 1}}).SetLimit(int64(limit)).SetBatchSize(int32(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var auctions []*Auction
	if err := cursor.All(ctx, &auctions); err != nil {
		return nil, err
	}
	previous := afterID
	for _, auction := range auctions {
		if auction == nil || auction.ID <= previous {
			return nil, errors.New("invalid auction recovery page identity/order")
		}
		previous = auction.ID
	}
	return auctions, nil
}

func (db *DB) LoadAuctionBidOperationsPage(afterID string, limit int) ([]AuctionBidOperation, error) {
	if limit < 1 || limit > AuctionRecoveryPageSize {
		return nil, errors.New("invalid auction decision recovery page size")
	}
	if db == nil || db.auctionBids == nil {
		return nil, errors.New("auction decision collection unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{}
	if afterID != "" {
		filter["id"] = bson.M{"$gt": afterID}
	}
	cursor, err := db.auctionBids.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "id", Value: 1}}).SetLimit(int64(limit)).SetBatchSize(int32(limit)))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var operations []AuctionBidOperation
	if err := cursor.All(ctx, &operations); err != nil {
		return nil, err
	}
	previous := afterID
	for _, op := range operations {
		if !op.Valid() || op.ID <= previous {
			return nil, errors.New("invalid durable auction decision page")
		}
		previous = op.ID
	}
	return operations, nil
}
