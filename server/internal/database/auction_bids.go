package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// One durable active decision per auction. The unique auction index reserves
// the auction independently of an ambiguous insert reply; retry the SAME ID.
type AuctionBidOperation struct {
	Kind               string    `bson:"kind,omitempty"`
	Fee                int       `bson:"fee,omitempty"`
	ID                 string    `bson:"id"`
	AuctionID          string    `bson:"auction_id"`
	PlayerID           string    `bson:"player_id"`
	CharacterName      string    `bson:"character_name"`
	Amount             int       `bson:"amount"`
	PreviousBid        int       `bson:"previous_bid"`
	PreviousBidderID   string    `bson:"previous_bidder_id"`
	PreviousBidderName string    `bson:"previous_bidder_name"`
	EndTime            time.Time `bson:"end_time"`
	RefundID           string    `bson:"refund_id"`
}

const AuctionOperationSellerPayout = "seller_payout"

func (op AuctionBidOperation) Valid() bool {
	base := op.ID != "" && op.AuctionID != "" && op.CharacterName != "" &&
		op.PlayerID == "player-"+op.CharacterName && op.Amount > 0 && op.PreviousBid >= 0 &&
		!op.EndTime.IsZero()
	if !base {
		return false
	}
	switch op.Kind {
	case "": // Original durable bid records omit the kind field.
		return op.Fee == 0 && (op.PreviousBidderID == "" || op.PreviousBidderName != "" && op.RefundID != "")
	case AuctionOperationSellerPayout:
		return op.Fee >= 0 && op.PreviousBid == 0 && op.PreviousBidderID == "" && op.PreviousBidderName == "" && op.RefundID == ""
	default:
		return false
	}
}

func applyAuctionBidOperationIndexes(ctx context.Context, db *DB) error {
	_, err := db.auctionBids.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetName("bid_operation_id").SetUnique(true)},
		{Keys: bson.D{{Key: "auction_id", Value: 1}}, Options: options.Index().SetName("one_active_bid_per_auction").SetUnique(true)},
		{Keys: bson.D{{Key: "player_id", Value: 1}}, Options: options.Index().SetName("bid_operation_player")},
	})
	return err
}

func (db *DB) LoadAuctionBidOperations() ([]AuctionBidOperation, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cursor, err := db.auctionBids.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var operations []AuctionBidOperation
	if err := cursor.All(ctx, &operations); err != nil {
		return nil, err
	}
	for _, op := range operations {
		if !op.Valid() {
			return nil, errors.New("invalid durable auction bid operation")
		}
	}
	return operations, nil
}

func (db *DB) EnsureAuctionBidOperation(op AuctionBidOperation) error {
	if !op.Valid() {
		return errors.New("invalid auction bid operation")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.auctionBids.InsertOne(ctx, op)
	if !mongo.IsDuplicateKeyError(err) {
		return err
	}
	var existing AuctionBidOperation
	if err := db.auctionBids.FindOne(ctx, bson.M{"auction_id": op.AuctionID}).Decode(&existing); err != nil {
		return err
	}
	// Compare immutable intent, with BSON's millisecond time precision.
	existing.EndTime, op.EndTime = existing.EndTime.UTC().Truncate(time.Millisecond), op.EndTime.UTC().Truncate(time.Millisecond)
	if existing != op {
		return errors.New("auction is reserved by a different bid operation")
	}
	return nil
}

func (db *DB) GetAuction(id string) (*Auction, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var auction Auction
	err := db.auctions.FindOne(ctx, bson.M{"id": id}).Decode(&auction)
	return &auction, err
}

// Called only after the character debit+receipt commit. The marker and refund
// append are atomic with the new bid, so a lost reply cannot append/pay twice.
func (db *DB) CommitAuctionBidOperation(op AuctionBidOperation) (*Auction, error) {
	if !op.Valid() {
		return nil, errors.New("invalid auction bid operation")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{"id": op.AuctionID, "status": "ACTIVE", "bid": op.PreviousBid,
		"bidder_id": op.PreviousBidderID, "last_bid_operation_id": bson.M{"$ne": op.ID}}
	set := bson.M{"bid": op.Amount, "bidder_id": bson.M{"$literal": op.PlayerID},
		"bidder_name": bson.M{"$literal": op.CharacterName}, "end_time": op.EndTime,
		"last_bid_operation_id": bson.M{"$literal": op.ID}}
	if op.Kind == AuctionOperationSellerPayout {
		filter = bson.M{"id": op.AuctionID, "status": "SOLD", "seller_id": op.PlayerID,
			"seller_claimed": bson.M{"$ne": true}, "last_bid_operation_id": bson.M{"$ne": op.ID}}
		set = bson.M{"seller_claimed": true, "last_bid_operation_id": bson.M{"$literal": op.ID}}
	} else if op.PreviousBidderID != "" && op.PreviousBid > 0 {
		refund := AuctionRefund{ID: op.RefundID, PlayerID: op.PreviousBidderID,
			CharacterName: op.PreviousBidderName, Amount: op.PreviousBid}
		set["pending_refunds"] = bson.M{"$concatArrays": bson.A{
			bson.M{"$ifNull": bson.A{"$pending_refunds", bson.A{}}}, bson.M{"$literal": bson.A{refund}},
		}}
	}
	if _, err := db.auctions.UpdateOne(ctx, filter, mongo.Pipeline{{{Key: "$set", Value: set}}}); err != nil {
		return nil, err
	}
	auction, err := db.GetAuction(op.AuctionID)
	if err != nil {
		return nil, err
	}
	if auction.LastBidOperationID != op.ID {
		return nil, errors.New("auction changed before reserved bid committed")
	}
	return auction, nil
}

func (db *DB) DeleteAuctionBidOperation(op AuctionBidOperation) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.auctionBids.DeleteOne(ctx, bson.M{"id": op.ID, "auction_id": op.AuctionID})
	return err // A repeated acknowledged deletion is safe; never delete by auction alone.
}
