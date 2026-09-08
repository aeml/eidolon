package game

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
)

func TestAuctionListsDetachMutableState(t *testing.T) {
	for _, view := range []string{"search", "seller", "buyer"} {
		t.Run(view, func(t *testing.T) {
			ts := NewTradingSystem(nil)
			a := &Auction{ID: "snapshot", SellerID: "seller", BuyerID: "buyer", Status: AuctionActive,
				EndTime: time.Now().Add(time.Hour), Bid: 10,
				Item: Item{Stats: map[string]int{"strength": 4},
					ForgeBasis: &forging.Basis{Stats: map[string]int{"strength": 3}},
					Gems:       []SocketedGem{{Stats: map[string]int{"strength": 2}}}},
				PendingRefunds: []database.AuctionRefund{{ID: "refund", Amount: 10}}}
			ts.Auctions[a.ID] = a
			var results []*Auction
			switch view {
			case "search":
				results = ts.SearchAuctions("")
			case "seller":
				results = ts.GetPlayerAuctions("seller")
			case "buyer":
				a.Status = AuctionSold
				results = ts.GetPlayerAuctions("buyer")
			}
			if len(results) != 1 {
				t.Fatal("missing auction")
			}
			snapshot := results[0]
			if snapshot == a {
				t.Fatal("list exposes mutable trading record after releasing its lock")
			}
			snapshot.Bid = 20
			snapshot.Item.Stats["strength"] = 40
			snapshot.Item.ForgeBasis.Stats["strength"] = 30
			snapshot.Item.Gems[0].Stats["strength"] = 20
			snapshot.PendingRefunds[0].Amount = 20
			if a.Bid != 10 || a.Item.Stats["strength"] != 4 || a.Item.ForgeBasis.Stats["strength"] != 3 ||
				a.Item.Gems[0].Stats["strength"] != 2 || a.PendingRefunds[0].Amount != 10 {
				t.Fatal("nested auction snapshot mutation reached live state")
			}
		})
	}
}

func TestAuctionListSerializationConcurrentWithWrites(t *testing.T) {
	ts := NewTradingSystem(nil)
	a := &Auction{ID: "snapshot", SellerID: "seller", Status: AuctionActive,
		EndTime: time.Now().Add(time.Hour), Item: Item{Stats: map[string]int{"strength": 1}}}
	ts.Auctions[a.ID] = a
	var work sync.WaitGroup
	work.Add(1)
	go func() {
		defer work.Done()
		for i := 0; i < 500; i++ {
			ts.mu.Lock()
			a.Bid = i
			a.Item.Stats["strength"] = i
			ts.mu.Unlock()
		}
	}()
	defer work.Wait()
	for i := 0; i < 500; i++ {
		for _, snapshot := range [][]*Auction{ts.SearchAuctions(""), ts.GetPlayerAuctions("seller")} {
			if _, err := json.Marshal(snapshot); err != nil {
				t.Fatal(err)
			}
		}
	}
}
