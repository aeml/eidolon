package database

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownerMarketItemSource struct {
	ID        primitive.ObjectID `bson:"_id" json:"-"`
	AuctionID string             `bson:"id" json:"-"`
	Seller    bool               `bson:"owner_seller" json:"-"`
	Bidder    bool               `bson:"owner_bidder" json:"-"`
	Buyer     bool               `bson:"owner_buyer" json:"-"`
	Refund    bool               `bson:"owner_refund" json:"-"`
	Item      *Item              `bson:"item" json:"-"`
}

type ownerMarketItemEntry struct {
	ID        primitive.ObjectID `json:"id"`
	AuctionID string             `json:"auction_id"`
	Seller    bool               `json:"is_seller"`
	Bidder    bool               `json:"is_current_bidder"`
	Buyer     bool               `json:"is_buyer"`
	Refund    bool               `json:"has_own_pending_refund"`
	Item      ownerItemSnapshot  `json:"item"`
}

func ownerMarketItemPagePipeline(owner, before string) mongo.Pipeline {
	playerID := "player-" + owner
	projection := bson.M{"_id": 1, "id": 1,
		"owner_seller": bson.M{"$eq": bson.A{"$seller_id", playerID}}, "owner_bidder": bson.M{"$eq": bson.A{"$bidder_id", playerID}}, "owner_buyer": bson.M{"$eq": bson.A{"$buyer_id", playerID}},
		"owner_refund": bson.M{"$gt": bson.A{bson.M{"$size": bson.M{"$filter": bson.M{"input": bson.M{"$ifNull": bson.A{"$pending_refunds", bson.A{}}}, "as": "refund", "cond": bson.M{"$eq": bson.A{"$$refund.player_id", playerID}}}}}, 0}},
	}
	for _, field := range []string{"id", "name", "type", "slot", "rarity", "level", "stats", "value", "description", "stack", "max_stack", "potency", "sockets", "set_id", "unique_effect", "gem_type", "gem_quality", "gems.type", "gems.quality", "gems.stats"} {
		projection["item."+field] = 1
	}
	return ownerDataPagePipeline(ownerMarketFilter(owner), projection, before, 80<<10)
}

func (db *DB) readOwnerMarketItemPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	valid := func(row ownerMarketItemSource) bool {
		return boundedActivityText(row.AuctionID, 256, true) && row.Item != nil && boundedActivityText(row.Item.ID, 256, true) && (row.Seller || row.Bidder || row.Buyer || row.Refund)
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.auctions, ownerMarketItemPagePipeline(owner, before), before, func(row ownerMarketItemSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerMarketItemEntry, 0, len(sources))
	for _, row := range sources {
		entries = append(entries, ownerMarketItemEntry{row.ID, row.AuctionID, row.Seller, row.Bidder, row.Buyer, row.Refund, snapshotOwnerItem(*row.Item)})
	}
	return encodeOwnerDataPage(OwnerExportFormat("market-items"), "market-items", at, entries, next, maxBytes)
}
