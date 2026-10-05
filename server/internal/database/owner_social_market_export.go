package database

import (
	"context"
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const ownerDataPageSize = 10

// Closed projected rows, a bounded failure sentinel, and immutable-ID keyset.
// A bad row fails the page; no source is silently omitted to make it pass.
func ownerDataPagePipeline(filter, projection bson.M, before string, inputBytes int) mongo.Pipeline {
	if before != "" {
		id, _ := primitive.ObjectIDFromHex(before)
		filter["_id"] = bson.M{"$lt": id}
	}
	within := bson.M{"$lte": bson.A{bson.M{"$bsonSize": "$$ROOT"}, inputBytes}}
	return mongo.Pipeline{
		bson.D{{Key: "$match", Value: filter}}, bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: -1}}}}, bson.D{{Key: "$limit", Value: ownerDataPageSize + 1}},
		bson.D{{Key: "$project", Value: projection}}, bson.D{{Key: "$project", Value: bson.M{"_id": 0, "within_bound": within, "entry": bson.M{"$cond": bson.A{within, "$$ROOT", nil}}}}},
	}
}

func readOwnerProjectedPage[T any](ctx context.Context, collection *mongo.Collection, pipeline mongo.Pipeline, before string, identity func(T) primitive.ObjectID, valid func(T) bool) ([]T, string, error) {
	if collection == nil {
		return nil, "", errOwnerExportSection
	}
	cursor, err := collection.Aggregate(ctx, pipeline, options.Aggregate().SetMaxTime(3*time.Second).SetBatchSize(ownerDataPageSize+1))
	if err != nil {
		return nil, "", errOwnerExportSection
	}
	defer cursor.Close(ctx)
	entries := make([]T, 0, ownerDataPageSize+1)
	previous := before
	for cursor.Next(ctx) {
		var source struct {
			Within bool `bson:"within_bound"`
			Entry  *T   `bson:"entry"`
		}
		if len(entries) >= ownerDataPageSize+1 || cursor.Decode(&source) != nil || !source.Within || source.Entry == nil {
			return nil, "", errOwnerExportSection
		}
		entry := *source.Entry
		id := identity(entry)
		if id.IsZero() || previous != "" && id.Hex() >= previous || !valid(entry) {
			return nil, "", errOwnerExportSection
		}
		previous = id.Hex()
		entries = append(entries, entry)
	}
	if cursor.Err() != nil || ctx.Err() != nil {
		return nil, "", errOwnerExportSection
	}
	next := ""
	if len(entries) > ownerDataPageSize {
		entries = entries[:ownerDataPageSize]
		next = identity(entries[len(entries)-1]).Hex()
	}
	return entries, next, nil
}

type ownerFriendSource struct {
	ID          primitive.ObjectID `bson:"_id" json:"-"`
	RequesterID string             `bson:"requester_id" json:"-"`
	AddresseeID string             `bson:"addressee_id" json:"-"`
	Status      string             `bson:"status" json:"-"`
	CreatedAt   time.Time          `bson:"created_at" json:"-"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"-"`
}

type ownerFriendEntry struct {
	ID          primitive.ObjectID `json:"id"`
	Counterpart string             `json:"counterpart_player_id"`
	Direction   string             `json:"direction"`
	Status      string             `json:"status"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

func ownerFriendPagePipeline(owner, before string) mongo.Pipeline {
	playerID := "player-" + owner
	filter := bson.M{"$or": bson.A{bson.M{"requester_id": playerID}, bson.M{"addressee_id": playerID, "status": bson.M{"$in": bson.A{FriendshipPending, FriendshipAccepted}}}}}
	projection := bson.M{"_id": 1, "requester_id": 1, "addressee_id": 1, "status": 1, "created_at": 1, "updated_at": 1}
	return ownerDataPagePipeline(filter, projection, before, 2048)
}

func (db *DB) readOwnerFriendPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	playerID := "player-" + owner
	valid := func(row ownerFriendSource) bool {
		return row.RequesterID != "" && row.AddresseeID != "" && row.RequesterID != row.AddresseeID && len(row.RequesterID) <= 256 && len(row.AddresseeID) <= 256 && !row.CreatedAt.IsZero() && !row.UpdatedAt.IsZero() &&
			(row.RequesterID == playerID && (row.Status == FriendshipPending || row.Status == FriendshipAccepted || row.Status == FriendshipBlocked || row.Status == FriendshipIgnored) || row.AddresseeID == playerID && (row.Status == FriendshipPending || row.Status == FriendshipAccepted))
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.friendships, ownerFriendPagePipeline(owner, before), before, func(row ownerFriendSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerFriendEntry, 0, len(sources))
	for _, row := range sources {
		counterpart, direction := row.RequesterID, "incoming"
		if row.RequesterID == playerID {
			counterpart, direction = row.AddresseeID, "outgoing"
		}
		entries = append(entries, ownerFriendEntry{row.ID, counterpart, direction, row.Status, row.CreatedAt.UTC(), row.UpdatedAt.UTC()})
	}
	page := struct {
		Format      string              `json:"format"`
		Version     int                 `json:"version"`
		GeneratedAt time.Time           `json:"generated_at"`
		Coverage    ownerExportCoverage `json:"coverage"`
		Entries     []ownerFriendEntry  `json:"entries"`
		Next        string              `json:"next,omitempty"`
	}{"eidolon-owner-social-relationships", 1, at.UTC(), ownerSectionCoverage("social"), entries, next}
	data, err := json.Marshal(page)
	if err != nil || len(data) > maxBytes {
		return nil, errOwnerExportSection
	}
	return data, nil
}

type ownerMarketItem struct {
	ID     string `bson:"id" json:"id"`
	Name   string `bson:"name" json:"name"`
	Type   string `bson:"type" json:"type"`
	Rarity string `bson:"rarity" json:"rarity"`
	Level  int    `bson:"level" json:"level"`
	Stack  int    `bson:"stack" json:"stack"`
}

type ownerMarketSource struct {
	ID            primitive.ObjectID `bson:"_id" json:"-"`
	AuctionID     string             `bson:"id" json:"-"`
	SellerID      string             `bson:"seller_id" json:"-"`
	BidderID      string             `bson:"bidder_id" json:"-"`
	BuyerID       string             `bson:"buyer_id" json:"-"`
	Item          ownerMarketItem    `bson:"item" json:"-"`
	Bid           int                `bson:"bid" json:"-"`
	Buyout        int                `bson:"buyout" json:"-"`
	SalePrice     int                `bson:"sale_price" json:"-"`
	Deposit       int                `bson:"deposit" json:"-"`
	Status        string             `bson:"status" json:"-"`
	StartTime     time.Time          `bson:"start_time" json:"-"`
	EndTime       time.Time          `bson:"end_time" json:"-"`
	ItemClaimed   bool               `bson:"item_claimed" json:"-"`
	SellerClaimed bool               `bson:"seller_claimed" json:"-"`
	Refunds       []struct {
		Amount int `bson:"amount"`
	} `bson:"owner_refunds" json:"-"`
}

type ownerMarketEntry struct {
	ID                primitive.ObjectID `json:"id"`
	AuctionID         string             `json:"auction_id"`
	Seller            bool               `json:"is_seller"`
	CurrentBidder     bool               `json:"is_current_bidder"`
	Buyer             bool               `json:"is_buyer"`
	Item              ownerMarketItem    `json:"item_summary"`
	Bid               int                `json:"current_bid"`
	Buyout            int                `json:"buyout"`
	SalePrice         int                `json:"sale_price"`
	Status            string             `json:"status"`
	StartTime         time.Time          `json:"start_time"`
	EndTime           time.Time          `json:"end_time"`
	OwnPendingRefunds []int              `json:"own_pending_refund_amounts"`
	SellerDeposit     *int               `json:"seller_deposit,omitempty"`
	SellerClaimed     *bool              `json:"seller_payout_claimed,omitempty"`
	ItemClaimed       *bool              `json:"own_item_claimed,omitempty"`
}

func ownerMarketPagePipeline(owner, before string) mongo.Pipeline {
	playerID := "player-" + owner
	filter := bson.M{"$or": bson.A{bson.M{"seller_id": playerID}, bson.M{"bidder_id": playerID}, bson.M{"buyer_id": playerID}, bson.M{"pending_refunds.player_id": playerID}}}
	projection := bson.M{"_id": 1, "id": 1, "seller_id": 1, "bidder_id": 1, "buyer_id": 1, "bid": 1, "buyout": 1, "sale_price": 1, "deposit": 1, "status": 1, "start_time": 1, "end_time": 1, "item_claimed": 1, "seller_claimed": 1}
	for _, field := range []string{"id", "name", "type", "rarity", "level", "stack"} {
		projection["item."+field] = 1
	}
	projection["owner_refunds"] = bson.M{"$map": bson.M{"input": bson.M{"$filter": bson.M{"input": bson.M{"$ifNull": bson.A{"$pending_refunds", bson.A{}}}, "as": "refund", "cond": bson.M{"$eq": bson.A{"$$refund.player_id", playerID}}}}, "as": "own", "in": bson.M{"amount": "$$own.amount"}}}
	return ownerDataPagePipeline(filter, projection, before, 16<<10)
}

func (db *DB) readOwnerMarketPage(ctx context.Context, owner, before string, at time.Time, maxBytes int) ([]byte, error) {
	playerID := "player-" + owner
	valid := func(row ownerMarketSource) bool {
		if row.AuctionID == "" || row.Item.ID == "" || row.Bid < 0 || row.Buyout < 0 || row.SalePrice < 0 || row.Deposit < 0 || row.StartTime.IsZero() || !row.EndTime.After(row.StartTime) ||
			(row.Status != "ACTIVE" && row.Status != "SOLD" && row.Status != "EXPIRED" && row.Status != "CANCELLED") || (row.SellerID != playerID && row.BidderID != playerID && row.BuyerID != playerID && len(row.Refunds) == 0) {
			return false
		}
		for _, refund := range row.Refunds {
			if refund.Amount <= 0 {
				return false
			}
		}
		return true
	}
	sources, next, err := readOwnerProjectedPage(ctx, db.auctions, ownerMarketPagePipeline(owner, before), before, func(row ownerMarketSource) primitive.ObjectID { return row.ID }, valid)
	if err != nil {
		return nil, errOwnerExportSection
	}
	entries := make([]ownerMarketEntry, 0, len(sources))
	for _, row := range sources {
		entry := ownerMarketEntry{ID: row.ID, AuctionID: row.AuctionID, Seller: row.SellerID == playerID, CurrentBidder: row.BidderID == playerID, Buyer: row.BuyerID == playerID, Item: row.Item, Bid: row.Bid, Buyout: row.Buyout, SalePrice: row.SalePrice, Status: row.Status, StartTime: row.StartTime.UTC(), EndTime: row.EndTime.UTC(), OwnPendingRefunds: make([]int, 0, len(row.Refunds))}
		for _, refund := range row.Refunds {
			entry.OwnPendingRefunds = append(entry.OwnPendingRefunds, refund.Amount)
		}
		if entry.Seller {
			deposit, claimed := row.Deposit, row.SellerClaimed
			entry.SellerDeposit = &deposit
			entry.SellerClaimed = &claimed
		}
		if entry.Buyer || entry.Seller && row.Status != "SOLD" {
			claimed := row.ItemClaimed
			entry.ItemClaimed = &claimed
		}
		entries = append(entries, entry)
	}
	page := struct {
		Format      string              `json:"format"`
		Version     int                 `json:"version"`
		GeneratedAt time.Time           `json:"generated_at"`
		Coverage    ownerExportCoverage `json:"coverage"`
		Entries     []ownerMarketEntry  `json:"entries"`
		Next        string              `json:"next,omitempty"`
	}{"eidolon-owner-marketplace-summary", 1, at.UTC(), ownerSectionCoverage("market"), entries, next}
	data, err := json.Marshal(page)
	if err != nil || len(data) > maxBytes {
		return nil, errOwnerExportSection
	}
	return data, nil
}
