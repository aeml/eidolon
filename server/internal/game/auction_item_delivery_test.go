package game

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
)

func auctionDeliveryPayload(t *testing.T, item Item) string {
	t.Helper()
	value, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	return string(value)
}

func filledAuctionStorage(size int) []Item {
	items := make([]Item, size)
	for i := range items {
		items[i] = Item{ID: "occupied", Name: "Occupied", Stack: 1, MaxStack: 1}
	}
	return items
}

func TestAuctionItemDeliveryPreservesMetadataAndReplaysBeforeCapacity(t *testing.T) {
	item := Item{ID: "earned-staff", Name: "Staff", Stack: 1, MaxStack: 1, Level: 70, Potency: 4, Icon: "staff",
		Stats: map[string]int{"intelligence": 31}, Gems: []SocketedGem{{Stats: map[string]int{"wisdom": 7}}},
		ForgeBasis: &forging.Basis{Level: 68, Stats: map[string]int{"intelligence": 30}}}
	p := &Entity{Gold: 1234, Health: 17, Mana: 0, Inventory: filledAuctionStorage(MaxInventorySize)}
	payload := auctionDeliveryPayload(t, item)
	if err := p.ApplyAuctionItemDelivery("claim", payload); err != nil {
		t.Fatal(err)
	}
	if len(p.Stash) != 1 || !reflect.DeepEqual(p.Stash[0], item) || len(p.ItemDeliveryReceipts) != 1 || p.Gold != 1234 || p.Health != 17 || p.Mana != 0 {
		t.Fatal("delivery changed item metadata or unrelated resources")
	}
	copy := (&World{Entities: map[string]*Entity{"recipient": p}}).GetEntityCopy("recipient")
	copy.ItemDeliveryReceipts["claim"] = "detached"
	if p.ItemDeliveryReceipts["claim"] == "detached" {
		t.Fatal("snapshot aliases receipts")
	}
	// The delivered item was subsequently used/moved, and storage is now full.
	p.Stash = filledAuctionStorage(MaxStashSize)
	if err := p.ApplyAuctionItemDelivery("claim", payload); err != nil {
		t.Fatal("receipt replay checked capacity", err)
	}
	if len(p.Stash) != MaxStashSize || p.Stash[0].ID != "occupied" {
		t.Fatal("replay delivered a second copy")
	}
	item.Potency++
	if err := p.ApplyAuctionItemDelivery("claim", auctionDeliveryPayload(t, item)); err == nil {
		t.Fatal("reused receipt accepted different item")
	}
}

func TestAuctionItemDeliveryCapacityFailureIsAllOrNothing(t *testing.T) {
	item := Item{ID: "incoming", Name: "Shard", Stack: 5, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
	p := &Entity{Inventory: filledAuctionStorage(MaxInventorySize), Stash: filledAuctionStorage(MaxStashSize)}
	p.Inventory[0] = item
	p.Inventory[0].ID = "partial"
	p.Inventory[0].Stack = 8
	before := cloneItems(p.Inventory)
	payload := auctionDeliveryPayload(t, item)
	if err := p.ApplyAuctionItemDelivery("claim", payload); !errors.Is(err, ErrAuctionStorageFull) {
		t.Fatal("full storage accepted", err)
	}
	if !reflect.DeepEqual(before, p.Inventory) || len(p.ItemDeliveryReceipts) != 0 {
		t.Fatal("failed capacity check mutated partial stack/receipt")
	}
	p.Stash = nil
	if err := p.ApplyAuctionItemDelivery("claim", payload); err != nil {
		t.Fatal(err)
	}
	if p.Inventory[0].Stack != 10 || len(p.Stash) != 1 || p.Stash[0].Stack != 3 {
		t.Fatal("stack split lost quantity")
	}
	// Same display name is not enough to merge items with different properties.
	p = &Entity{Inventory: filledAuctionStorage(MaxInventorySize)}
	p.Inventory[0] = item
	p.Inventory[0].Stack = 2
	p.Inventory[0].Stats = map[string]int{"wisdom": 9}
	if err := p.ApplyAuctionItemDelivery("claim", payload); err != nil {
		t.Fatal(err)
	}
	if p.Inventory[0].Stack != 2 || p.Stash[0].Stack != 5 || p.Stash[0].Stats["wisdom"] != 2 {
		t.Fatal("merged incompatible item metadata")
	}
}

func TestAuctionItemClaimReservationAndAuthorization(t *testing.T) {
	for _, status := range []AuctionStatus{AuctionSold, AuctionExpired, AuctionCancelled} {
		t.Run(string(status), func(t *testing.T) {
			ts := NewTradingSystem(nil)
			p := &Entity{ID: "player-recipient", Name: "recipient", Gold: 1234}
			a := &Auction{ID: "claim", SellerID: p.ID, BuyerID: "player-other", Status: status, EndTime: time.Now(), Item: Item{ID: "item", Stack: 1, MaxStack: 1}}
			if status == AuctionSold {
				a.SellerID, a.BuyerID = "player-other", p.ID
			}
			ts.Auctions[a.ID] = a
			if op, err := ts.PrepareAuctionItemClaim(a.ID, &Entity{ID: "player-intruder", Name: "intruder"}); err != nil || op != nil {
				t.Fatal("intruder reserved claim")
			}
			op, err := ts.PrepareAuctionItemClaim(a.ID, p)
			if err != nil || op == nil || !op.Valid() || a.ItemClaimed || len(p.Inventory) != 0 {
				t.Fatal("prepare delivered or claimed early")
			}
			if _, err := ts.CollectAuction(a.ID, p); !errors.Is(err, ErrAuctionBidPending) {
				t.Fatal("legacy claim bypassed reservation")
			}
			if err := p.ApplyAuctionItemDelivery(op.ID, op.ItemPayload); err != nil {
				t.Fatal(err)
			}
			if err := ts.CompleteAuctionBid(*op); err != nil {
				t.Fatal(err)
			}
			settled := ts.Auctions[a.ID]
			if !settled.ItemClaimed || settled.SellerClaimed != (status != AuctionSold) || p.Gold != 1234 || p.Inventory[0].ID != "item" {
				t.Fatal("item finalization changed wrong claim/funds")
			}
			if op, err := ts.PrepareAuctionItemClaim(a.ID, p); err != nil || op != nil {
				t.Fatal("settled claim reserved again")
			}
		})
	}
}

func TestAuctionItemOperationValidationRejectsMalformedPayload(t *testing.T) {
	op := database.AuctionBidOperation{ID: "claim", AuctionID: "auction", Kind: database.AuctionOperationItemClaim, PlayerID: "player-owner", CharacterName: "owner", EndTime: time.Now(), ClaimStatus: "SOLD"}
	for _, payload := range []string{"", "null", `{"id":"x","stack":0,"maxStack":1}`, `{"id":"x","stack":2,"maxStack":1}`} {
		op.ItemPayload = payload
		if op.Valid() {
			t.Fatal("invalid payload accepted", payload)
		}
	}
	op.ItemPayload = auctionDeliveryPayload(t, Item{ID: "x", Stack: 1, MaxStack: 1})
	if !op.Valid() {
		t.Fatal("valid item claim rejected")
	}
	op.Amount = 1
	if op.Valid() {
		t.Fatal("item claim accepted unrelated gold amount")
	}
}
