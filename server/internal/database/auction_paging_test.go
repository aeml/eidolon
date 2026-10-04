package database

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestAuctionPagingBoundsAndCompletePrivateState(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, kind := range []string{"auction", "decision"} {
		for _, after := range []string{"", "previous"} {
			mt.Run(kind+"/"+after, func(mt *mtest.T) {
				repo := &DB{auctions: mt.Coll, auctionBids: mt.Coll}
				if kind == "auction" {
					want := &Auction{ID: "z-saved", Status: "SOLD", ItemClaimed: true, SellerClaimed: false,
						LastBidOperationID: "retain", PendingRefunds: []AuctionRefund{{ID: "refund", Amount: 43}},
						Item: Item{ID: "earned", Stats: map[string]int{"strength": 17}}}
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, want)))
					got, err := repo.LoadAuctionsPage(after, 50)
					if err != nil || len(got) != 1 || !reflect.DeepEqual(got[0], want) {
						mt.Fatal("auction page lost claims/refunds/item", got, err)
					}
				} else {
					want := listingTimeFixture()
					want.ID = "z-decision"
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, want)))
					got, err := repo.LoadAuctionBidOperationsPage(after, 50)
					if err != nil || len(got) != 1 || !reflect.DeepEqual(got[0], want) {
						mt.Fatal("decision page lost frozen escrow intent", got, err)
					}
				}
				command := mt.GetStartedEvent().Command
				if command.Lookup("limit").Int64() != 50 || command.Lookup("batchSize").Int32() != 50 || command.Lookup("sort").Document().Lookup("id").Int32() != 1 {
					mt.Fatal("unbounded or unordered recovery query", command)
				}
				filter := command.Lookup("filter").Document()
				if after != "" {
					if filter.Lookup("id").Document().Lookup("$gt").StringValue() != after {
						mt.Fatal("cursor did not advance after exact last identity", command)
					}
				} else {
					elements, err := filter.Elements()
					if err != nil || len(elements) != 0 {
						mt.Fatal("first page filtered out recovery state", command, err)
					}
				}
			})
		}
	}
}

func TestAuctionPagingRefusesInvalidBoundsAndReturnedRecords(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("invalid bounds", func(mt *mtest.T) {
		repo := &DB{auctions: mt.Coll, auctionBids: mt.Coll}
		for _, limit := range []int{-1, 0, 51} {
			if _, err := repo.LoadAuctionsPage("", limit); err == nil {
				mt.Fatal("invalid auction bound accepted")
			}
			if _, err := repo.LoadAuctionBidOperationsPage("", limit); err == nil {
				mt.Fatal("invalid decision bound accepted")
			}
		}
		if len(mt.GetAllStartedEvents()) != 0 {
			mt.Fatal("invalid page reached storage")
		}
	})
	for _, mode := range []string{"missing identity", "repeated cursor", "descending page", "invalid intent"} {
		mt.Run(mode, func(mt *mtest.T) {
			repo := &DB{auctions: mt.Coll, auctionBids: mt.Coll}
			switch mode {
			case "missing identity":
				mt.AddMockResponses(tradeResponse(mt, bson.D{{Key: "status", Value: "SOLD"}}))
			case "repeated cursor":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, Auction{ID: "previous"})))
			case "descending page":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, Auction{ID: "z"}), directTradeDocument(mt.T, Auction{ID: "y"})))
			case "invalid intent":
				op := listingTimeFixture()
				op.Kind = "unknown"
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, op)))
				if got, err := repo.LoadAuctionBidOperationsPage("", 50); err == nil || got != nil {
					mt.Fatal("invalid decision page accepted", got, err)
				}
				return
			}
			if got, err := repo.LoadAuctionsPage("previous", 50); err == nil || got != nil {
				mt.Fatal("invalid auction page accepted", got, err)
			}
		})
	}
}
