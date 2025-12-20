package game

import (
	"testing"
)

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
