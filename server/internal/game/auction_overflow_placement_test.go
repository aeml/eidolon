package game

import (
	"testing"
	"time"
)

// These are the no-database compatibility paths. Durable auction delivery
// instead rejects full bag/stash capacity before settling its operation.
func TestLegacyAuctionOverflowUsesPlayerGroundPlaneAndInstance(t *testing.T) {
	for _, action := range []string{"cancel", "buyout"} {
		t.Run(action, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("overflow-player", "Fighter")
			p.X, p.Y, p.Z, p.InstanceID = 60000, 200, 60010, "auction-overflow-instance"
			p.Gold = 1000
			p.Inventory = filledAuctionStorage(MaxInventorySize)
			p.Stash = filledAuctionStorage(MaxStashSize)
			item := Item{ID: "auction-overflow", Name: "Overflow material", Stack: 3, MaxStack: 99}
			ts := NewTradingSystem(nil)
			ts.Auctions["overflow"] = &Auction{ID: "overflow", SellerID: p.ID,
				Item: item, Buyout: 100, Status: AuctionActive, EndTime: time.Now().Add(time.Hour)}
			wantStack := 3
			if action == "cancel" {
				if err := ts.CancelAuction("overflow", p, w); err != nil {
					t.Fatal(err)
				}
			} else {
				ts.Auctions["overflow"].SellerID = "someone-else"
				p.Inventory[0] = item
				p.Inventory[0].Stack = 98
				wantStack = 2
				if _, err := ts.BuyoutAuction("overflow", p, w); err != nil {
					t.Fatal(err)
				}
			}
			for _, entity := range w.Entities {
				if entity.Type != TypeLoot || entity.LootItem == nil || entity.LootItem.ID != item.ID {
					continue
				}
				if entity.X != p.X || entity.Z != p.Z || entity.InstanceID != p.InstanceID || entity.LootItem.Stack != wantStack {
					t.Fatalf("overflow misplaced: x=%v z=%v instance=%q stack=%d", entity.X, entity.Z, entity.InstanceID, entity.LootItem.Stack)
				}
				return
			}
			t.Fatal("no recoverable overflow item")
		})
	}
}
