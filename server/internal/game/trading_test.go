package game

import (
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestTradingDatabaseRoundTripPreservesCompleteItemMetadata(t *testing.T) {
	ts := NewTradingSystem(nil)
	original := Item{
		ID:               "complete-item",
		Name:             "Brilliant Spell Tome of the Owl",
		Type:             ItemArmor,
		Rarity:           RarityLegendary,
		Slot:             "offHand",
		Level:            87,
		Stats:            map[string]int{"defense": 9, "intelligence": 12},
		Value:            900,
		Stack:            1,
		MaxStack:         1,
		Potency:          4,
		Sockets:          2,
		SetID:            "temporal_weave",
		UniqueEffect:     "efficient",
		GemType:          GemSapphire,
		GemQuality:       GemPerfect,
		StatScaleVersion: ItemStatScaleVersion,
		Gems: []SocketedGem{
			{Type: GemSapphire, Quality: GemFlawless, Stats: map[string]int{"intelligence": 5}},
		},
	}

	restored := ts.fromDBItem(ts.toDBItem(original))
	if !reflect.DeepEqual(restored, original) {
		t.Fatalf("trading persistence changed item metadata:\nwant %#v\n got %#v", original, restored)
	}
}

func TestConcurrentBuyoutHasOneWinnerAndCannotBeCollectedTwice(t *testing.T) {
	ts := NewTradingSystem(nil)
	ts.Auctions["race"] = &Auction{
		ID: "race", SellerID: "seller", Item: Item{ID: "only-copy", Name: "Only Copy", Stack: 1, MaxStack: 1},
		Bid: 50, Buyout: 100, Status: AuctionActive, EndTime: time.Now().Add(time.Hour), Deposit: 5,
	}
	world := NewWorld(nil)
	buyers := []*Entity{
		{ID: "buyer-a", Gold: 1000, Inventory: make([]Item, 2)},
		{ID: "buyer-b", Gold: 1000, Inventory: make([]Item, 2)},
	}
	var wg sync.WaitGroup
	results := make(chan error, len(buyers))
	for _, buyer := range buyers {
		wg.Add(1)
		go func(candidate *Entity) {
			defer wg.Done()
			_, err := ts.BuyoutAuction("race", candidate, world)
			results <- err
		}(buyer)
	}
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("concurrent buyout winners = %d, want 1", successes)
	}
	itemCopies := 0
	for _, buyer := range buyers {
		for _, item := range buyer.Inventory {
			if item.ID == "only-copy" {
				itemCopies++
			}
		}
		if _, err := ts.CollectAuction("race", buyer); err == nil {
			t.Fatal("direct-buyout item was collectable a second time")
		}
	}
	if itemCopies != 1 {
		t.Fatalf("delivered item copies = %d, want 1", itemCopies)
	}

	seller := &Entity{ID: "seller"}
	if payout, err := ts.CollectAuction("race", seller); err != nil || payout != 100 {
		t.Fatalf("seller payout = %v, err=%v", payout, err)
	}
	if _, err := ts.CollectAuction("race", seller); err == nil {
		t.Fatal("seller collected auction proceeds twice")
	}
}

func TestBidSettlementKeepsBothIndependentClaims(t *testing.T) {
	ts := NewTradingSystem(nil)
	ts.Auctions["bid-win"] = &Auction{
		ID: "bid-win", SellerID: "seller", BuyerID: "winner", BidderID: "winner",
		Item: Item{ID: "won-item", Stack: 1}, Bid: 100, Buyout: 1000, SalePrice: 100,
		Status: AuctionSold, Deposit: 5,
	}
	winner := &Entity{ID: "winner"}
	item, err := ts.CollectAuction("bid-win", winner)
	if err != nil || item.(Item).ID != "won-item" {
		t.Fatalf("winner claim = %#v, err=%v", item, err)
	}
	if ts.Auctions["bid-win"] == nil {
		t.Fatal("buyer claim deleted seller's unpaid proceeds")
	}
	seller := &Entity{ID: "seller"}
	payout, err := ts.CollectAuction("bid-win", seller)
	if err != nil || payout != 100 {
		t.Fatalf("bid seller payout = %#v, err=%v", payout, err)
	}
	if ts.Auctions["bid-win"] != nil {
		t.Fatal("fully claimed auction was not finalized")
	}
}

func TestNewTradingSystem(t *testing.T) {
	ts := NewTradingSystem(nil)
	if ts == nil {
		t.Fatal("NewTradingSystem returned nil")
	}

	if ts.Auctions == nil {
		t.Error("Auctions map is nil")
	}
}

func TestTradingConstants(t *testing.T) {
	// Verify trading fee constants
	if TradingSalesFeePercent != 0.05 {
		t.Errorf("Expected sales fee 5%%, got %f", TradingSalesFeePercent)
	}

	if TradingDepositPercent != 0.05 {
		t.Errorf("Expected deposit 5%%, got %f", TradingDepositPercent)
	}

	if TradingMinDeposit != 1 {
		t.Errorf("Expected min deposit 1, got %d", TradingMinDeposit)
	}
}

func TestAuctionStatus(t *testing.T) {
	// Verify auction status constants
	if AuctionActive != "ACTIVE" {
		t.Errorf("Expected ACTIVE, got %s", AuctionActive)
	}

	if AuctionSold != "SOLD" {
		t.Errorf("Expected SOLD, got %s", AuctionSold)
	}

	if AuctionExpired != "EXPIRED" {
		t.Errorf("Expected EXPIRED, got %s", AuctionExpired)
	}

	if AuctionCancelled != "CANCELLED" {
		t.Errorf("Expected CANCELLED, got %s", AuctionCancelled)
	}
}

func TestCreateAuctionInvalidPrice(t *testing.T) {
	ts := NewTradingSystem(nil)

	seller := &Entity{
		ID:   "seller-1",
		Gold: 1000,
	}

	item := Item{
		ID:   "item-1",
		Name: "Test Sword",
	}

	// Test bid <= 0
	_, err := ts.CreateAuction(seller, item, 0, 100, 24)
	if err == nil {
		t.Error("Expected error for bid <= 0")
	}

	// Test buyout < bid
	_, err = ts.CreateAuction(seller, item, 100, 50, 24)
	if err == nil {
		t.Error("Expected error for buyout < bid")
	}
}

func TestCreateAuctionInsufficientGold(t *testing.T) {
	ts := NewTradingSystem(nil)

	seller := &Entity{
		ID:   "seller-1",
		Gold: 0, // No gold for deposit
	}

	item := Item{
		ID:   "item-1",
		Name: "Test Sword",
	}

	// Buyout 100 requires 5 gold deposit
	_, err := ts.CreateAuction(seller, item, 10, 100, 24)
	if err == nil {
		t.Error("Expected error for insufficient gold")
	}
}

func TestSearchAuctionsEmpty(t *testing.T) {
	ts := NewTradingSystem(nil)

	results := ts.SearchAuctions("")
	if len(results) != 0 {
		t.Errorf("Expected 0 results, got %d", len(results))
	}
}

func TestGetPlayerAuctionsEmpty(t *testing.T) {
	ts := NewTradingSystem(nil)

	results := ts.GetPlayerAuctions("player-1")
	if len(results) != 0 {
		t.Errorf("Expected 0 results, got %d", len(results))
	}
}

func TestDepositCalculation(t *testing.T) {
	// Test deposit calculation logic
	// deposit = buyout * 0.05, min 1

	testCases := []struct {
		buyout          int
		expectedDeposit int
	}{
		{100, 5},   // 100 * 0.05 = 5
		{1000, 50}, // 1000 * 0.05 = 50
		{10, 1},    // 10 * 0.05 = 0.5, but min is 1
		{1, 1},     // 1 * 0.05 = 0.05, but min is 1
	}

	for _, tc := range testCases {
		deposit := int(float64(tc.buyout) * TradingDepositPercent)
		if deposit < TradingMinDeposit {
			deposit = TradingMinDeposit
		}

		if deposit != tc.expectedDeposit {
			t.Errorf("Buyout %d: expected deposit %d, got %d",
				tc.buyout, tc.expectedDeposit, deposit)
		}
	}
}

func TestSalesFeeCalculation(t *testing.T) {
	// Test sales fee calculation
	testCases := []struct {
		salePrice   int
		expectedFee int
	}{
		{100, 5},   // 100 * 0.05 = 5
		{1000, 50}, // 1000 * 0.05 = 50
		{50, 2},    // 50 * 0.05 = 2.5 -> 2
	}

	for _, tc := range testCases {
		fee := int(float64(tc.salePrice) * TradingSalesFeePercent)
		if fee != tc.expectedFee {
			t.Errorf("Sale %d: expected fee %d, got %d",
				tc.salePrice, tc.expectedFee, fee)
		}
	}
}

func TestAuctionStruct(t *testing.T) {
	auction := &Auction{
		ID:       "auction-1",
		SellerID: "seller-1",
		Bid:      10,
		Buyout:   100,
		Duration: 24,
		Status:   AuctionActive,
	}

	if auction.ID != "auction-1" {
		t.Error("Auction ID not set")
	}

	if auction.Status != AuctionActive {
		t.Error("Auction status not ACTIVE")
	}
}

func TestSearchAuctionsFilteredCombinesCategoryRarityAndLevel(t *testing.T) {
	ts := NewTradingSystem(nil)
	ts.Auctions["matching"] = &Auction{
		ID: "matching", Status: AuctionActive, EndTime: time.Now().Add(time.Hour),
		Item: Item{Name: "Ember Sword", Type: ItemWeapon, Rarity: RarityLegendary, Level: 60},
	}
	ts.Auctions["wrong-rarity"] = &Auction{
		ID: "wrong-rarity", Status: AuctionActive, EndTime: time.Now().Add(time.Hour),
		Item: Item{Name: "Ember Axe", Type: ItemWeapon, Rarity: RarityRare, Level: 60},
	}
	ts.Auctions["wrong-level"] = &Auction{
		ID: "wrong-level", Status: AuctionActive, EndTime: time.Now().Add(time.Hour),
		Item: Item{Name: "Ember Sword", Type: ItemWeapon, Rarity: RarityLegendary, Level: 20},
	}
	ts.Auctions["sold"] = &Auction{
		ID: "sold", Status: AuctionSold, EndTime: time.Now().Add(time.Hour),
		Item: Item{Name: "Ember Sword", Type: ItemWeapon, Rarity: RarityLegendary, Level: 60},
	}

	results := ts.SearchAuctionsFiltered(AuctionSearchFilter{
		Query: "sword", ItemType: "weapon", Rarity: "legendary", MinLevel: 50, MaxLevel: 70,
	})
	if len(results) != 1 || results[0].ID != "matching" {
		t.Fatalf("unexpected filtered auctions: %+v", results)
	}
}
