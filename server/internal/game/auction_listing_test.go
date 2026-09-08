package game

import (
	"errors"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
)

func TestAuctionListingEscrowIsAtomicAndReplaysBeforeInventory(t *testing.T) {
	item := Item{ID: "owned-stack", Name: "Owned Stack", Stack: 5, MaxStack: 10, Stats: map[string]int{"wisdom": 2}, StatScaleVersion: ItemStatScaleVersion}
	payload := auctionDeliveryPayload(t, item)
	p := &Entity{Gold: 24, Inventory: []Item{item}}
	if err := p.ApplyAuctionListing("op", payload, 25); !errors.Is(err, database.ErrInsufficientGold) {
		t.Fatal("unfunded listing accepted", err)
	}
	if p.Gold != 24 || p.Inventory[0].Stack != 5 || len(p.GoldCreditReceipts) != 0 || len(p.ItemDeliveryReceipts) != 0 {
		t.Fatal("failed deposit changed inventory/receipts")
	}
	p.Gold = 1234
	p.Inventory[0].Stack = 7 // Additional earned units stay in the bag.
	if err := p.ApplyAuctionListing("op", payload, 25); err != nil {
		t.Fatal(err)
	}
	if p.Gold != 1209 || len(p.Inventory) != 1 || p.Inventory[0].Stack != 2 || p.GoldCreditReceipts["listing:op"] != -25 || len(p.ItemDeliveryReceipts) != 1 {
		t.Fatal("escrow lost extra units/deposit/receipt")
	}
	p.Gold = 0
	p.Inventory[0].Stack = 9
	if err := p.ApplyAuctionListing("op", payload, 25); err != nil {
		t.Fatal("replay checked current funds/inventory", err)
	}
	if p.Gold != 0 || p.Inventory[0].Stack != 9 {
		t.Fatal("escrow replay removed new property")
	}
	if err := p.ApplyAuctionListing("op", payload, 26); err == nil {
		t.Fatal("replay accepted different deposit")
	}
	item.Potency++
	if err := p.ApplyAuctionListing("op", auctionDeliveryPayload(t, item), 25); err == nil {
		t.Fatal("replay accepted different item")
	}
}

func TestAuctionListingChangedOrAmbiguousItemDoesNotCharge(t *testing.T) {
	item := Item{ID: "item", Name: "Item", Stack: 1, MaxStack: 1, Potency: 2}
	payload := auctionDeliveryPayload(t, item)
	for _, mode := range []string{"missing", "changed", "ambiguous"} {
		p := &Entity{Gold: 100, Inventory: []Item{item}}
		switch mode {
		case "missing":
			p.Inventory = nil
		case "changed":
			p.Inventory[0].Potency++
		case "ambiguous":
			p.Inventory = append(p.Inventory, item)
		}
		before := cloneItems(p.Inventory)
		if err := p.ApplyAuctionListing("op", payload, 25); !errors.Is(err, ErrAuctionListingItemUnavailable) {
			t.Fatal("unavailable item accepted", mode, err)
		}
		if p.Gold != 100 || len(p.ItemDeliveryReceipts) != 0 || len(p.GoldCreditReceipts) != 0 || !reflect.DeepEqual(cloneItems(p.Inventory), before) {
			t.Fatal("failed listing changed owner", mode)
		}
	}
}

func TestAuctionListingStaysInvisibleUntilEscrowCompletes(t *testing.T) {
	ts := NewTradingSystem(nil)
	p := &Entity{ID: "player-seller", Name: "seller", Gold: 1234, Inventory: make([]Item, MaxInventorySize)}
	p.Inventory[8] = Item{ID: "earned", Name: "Earned", Stack: 1, MaxStack: 1, StatScaleVersion: ItemStatScaleVersion}
	op, err := ts.PrepareAuctionListing(p, 8, 100, 500, 24)
	if err != nil || op == nil || !op.Valid() || len(ts.Auctions) != 0 || p.Gold != 1234 || p.Inventory[8].ID != "earned" {
		t.Fatal("listing preparation changed owner/market", err)
	}
	if _, err := ts.PrepareAuctionListing(p, 8, 100, 500, 24); !errors.Is(err, ErrAuctionBidPending) {
		t.Fatal("duplicate request bypassed pending listing")
	}
	if err := p.ApplyAuctionListing(op.ID, op.ItemPayload, op.Amount); err != nil {
		t.Fatal(err)
	}
	if err := ts.CompleteAuctionBid(*op); err != nil {
		t.Fatal(err)
	}
	a := ts.Auctions[op.AuctionID]
	if a == nil || a.Status != AuctionActive || a.SellerID != p.ID || a.Bid != 100 || a.Buyout != 500 || a.Deposit != 25 || a.Item.ID != "earned" || a.LastBidOperationID != op.ID || p.Gold != 1209 || p.Inventory[8].ID != "" || len(p.Inventory) != MaxInventorySize {
		t.Fatal("listing lost escrow metadata or shrank bag")
	}
	if _, err := ts.PrepareAuctionListing(p, 8, 100, 500, 24); err == nil {
		t.Fatal("empty slot listed again")
	}
	bad := *op
	bad.Amount++
	if bad.Valid() {
		t.Fatal("inconsistent listing deposit accepted")
	}
	bad = *op
	bad.ListingHours = 169
	if bad.Valid() {
		t.Fatal("invalid listing duration accepted")
	}
	bad = *op
	bad.ListingBid = 501
	if bad.Valid() {
		t.Fatal("bid exceeds buyout")
	}
}
