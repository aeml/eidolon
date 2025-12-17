package game

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type AuctionStatus string

const (
	AuctionActive    AuctionStatus = "ACTIVE"
	AuctionSold      AuctionStatus = "SOLD"
	AuctionExpired   AuctionStatus = "EXPIRED"
	AuctionCancelled AuctionStatus = "CANCELLED"

	TradingSalesFeePercent = 0.05 // 5% fee on sale
	TradingDepositPercent  = 0.05 // 5% deposit to list
	TradingMinDeposit      = 1    // Minimum 1 gold deposit
)

type Auction struct {
	ID         string        `json:"id"`
	SellerID   string        `json:"sellerId"`
	SellerName string        `json:"sellerName"`
	Item       Item          `json:"item"`
	Bid        int           `json:"currentBid"`
	Buyout     int           `json:"buyoutPrice"`
	Duration   int           `json:"duration"` // Hours
	StartTime  time.Time     `json:"startTime"`
	EndTime    time.Time     `json:"endTime"`
	Status     AuctionStatus `json:"status"`
	BuyerID    string        `json:"buyerId"` // If sold
	Deposit    int           `json:"deposit"`
}

type TradingSystem struct {
	mu       sync.RWMutex
	Auctions map[string]*Auction
}

func NewTradingSystem() *TradingSystem {
	return &TradingSystem{
		Auctions: make(map[string]*Auction),
	}
}

func (ts *TradingSystem) CreateAuction(seller *Entity, item Item, bid, buyout, duration int) (*Auction, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if bid <= 0 || buyout < bid {
		return nil, fmt.Errorf("invalid price")
	}

	// Calculate Deposit
	deposit := int(float64(buyout) * TradingDepositPercent)
	if deposit < TradingMinDeposit {
		deposit = TradingMinDeposit
	}

	seller.Mu.Lock()
	if seller.Gold < deposit {
		seller.Mu.Unlock()
		return nil, fmt.Errorf("insufficient gold for deposit (%d gold required)", deposit)
	}
	seller.Gold -= deposit
	seller.Mu.Unlock()

	id := uuid.New().String()
	auction := &Auction{
		ID:         id,
		SellerID:   seller.ID,
		SellerName: seller.Name,
		Item:       item,
		Bid:        bid,
		Buyout:     buyout,
		Duration:   duration,
		StartTime:  time.Now(),
		EndTime:    time.Now().Add(time.Duration(duration) * time.Hour),
		Status:     AuctionActive,
		Deposit:    deposit,
	}

	ts.Auctions[id] = auction
	return auction, nil
}

func (ts *TradingSystem) SearchAuctions(query string) []*Auction {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	var results []*Auction
	query = strings.ToLower(query)

	for _, auction := range ts.Auctions {
		if auction.Status != AuctionActive {
			continue
		}

		// Check expiration
		if time.Now().After(auction.EndTime) {
			// Lazy expiration
			// We can't modify in RLock, so we'll just skip it for now
			// A background cleanup task should handle state changes
			continue
		}

		if query == "" || strings.Contains(strings.ToLower(auction.Item.Name), query) {
			results = append(results, auction)
		}
	}

	// Sort by time remaining (soonest first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].EndTime.Before(results[j].EndTime)
	})

	return results
}

func (ts *TradingSystem) GetPlayerAuctions(playerID string) []*Auction {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	var results []*Auction
	for _, auction := range ts.Auctions {
		if auction.SellerID == playerID {
			results = append(results, auction)
		}
	}

	// Sort by status (Active first) then time
	sort.Slice(results, func(i, j int) bool {
		if results[i].Status != results[j].Status {
			return results[i].Status == AuctionActive
		}
		return results[i].EndTime.Before(results[j].EndTime)
	})

	return results
}

func (ts *TradingSystem) BuyoutAuction(auctionID string, buyer *Entity) (*Item, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	auction, ok := ts.Auctions[auctionID]
	if !ok {
		return nil, fmt.Errorf("auction not found")
	}

	if auction.Status != AuctionActive {
		return nil, fmt.Errorf("auction is not active")
	}

	if time.Now().After(auction.EndTime) {
		auction.Status = AuctionExpired
		return nil, fmt.Errorf("auction expired")
	}

	if buyer.Gold < auction.Buyout {
		return nil, fmt.Errorf("insufficient gold")
	}

	if buyer.ID == auction.SellerID {
		return nil, fmt.Errorf("cannot buy your own auction")
	}

	buyer.Mu.Lock()
	defer buyer.Mu.Unlock()

	// Check for inventory space
	hasSpace := false
	for _, item := range buyer.Inventory {
		if item.ID == "" {
			hasSpace = true
			break
		}
	}
	if !hasSpace {
		return nil, fmt.Errorf("inventory full")
	}

	// Process Transaction
	buyer.Gold -= auction.Buyout

	// Add item to buyer
	for i, item := range buyer.Inventory {
		if item.ID == "" {
			buyer.Inventory[i] = auction.Item
			break
		}
	}

	auction.Status = AuctionSold
	auction.BuyerID = buyer.ID

	return &auction.Item, nil
}

func (ts *TradingSystem) CollectAuction(auctionID string, player *Entity) (interface{}, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	auction, ok := ts.Auctions[auctionID]
	if !ok {
		return nil, fmt.Errorf("auction not found")
	}

	if auction.SellerID != player.ID {
		return nil, fmt.Errorf("not your auction")
	}

	if auction.Status == AuctionSold {
		// Collect Gold
		gold := auction.Buyout // Or current bid if we had bidding

		// Calculate Sales Fee
		fee := int(float64(gold) * TradingSalesFeePercent)
		payout := gold - fee

		// Refund Deposit
		payout += auction.Deposit

		player.Mu.Lock()
		player.Gold += payout
		player.Mu.Unlock()

		// Remove auction
		delete(ts.Auctions, auctionID)

		return payout, nil
	} else if auction.Status == AuctionExpired || auction.Status == AuctionCancelled {
		// Collect Item
		// Caller must handle adding item to inventory

		// Remove auction
		delete(ts.Auctions, auctionID)

		return auction.Item, nil
	}

	return nil, fmt.Errorf("nothing to collect")
}

// CleanupExpired checks for expired auctions
func (ts *TradingSystem) CleanupExpired() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	now := time.Now()
	for _, auction := range ts.Auctions {
		if auction.Status == AuctionActive && now.After(auction.EndTime) {
			auction.Status = AuctionExpired
		}
	}
}

func (ts *TradingSystem) RemoveAuction(auctionID string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	delete(ts.Auctions, auctionID)
}

func (ts *TradingSystem) CancelAuction(auctionID string, player *Entity) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	auction, ok := ts.Auctions[auctionID]
	if !ok {
		return fmt.Errorf("auction not found")
	}

	if auction.SellerID != player.ID {
		return fmt.Errorf("not your auction")
	}

	if auction.Status != AuctionActive {
		return fmt.Errorf("auction is not active")
	}

	auction.Status = AuctionCancelled
	return nil
}
