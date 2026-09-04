package game

import (
	"eidolon-server/internal/database"
	"fmt"
	"log"
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
	ID            string        `json:"id"`
	SellerID      string        `json:"sellerId"`
	SellerName    string        `json:"sellerName"`
	Item          Item          `json:"item"`
	Bid           int           `json:"currentBid"`
	Buyout        int           `json:"buyoutPrice"`
	Duration      int           `json:"duration"` // Hours
	StartTime     time.Time     `json:"startTime"`
	EndTime       time.Time     `json:"endTime"`
	Status        AuctionStatus `json:"status"`
	BuyerID       string        `json:"buyerId"`
	BidderID      string        `json:"bidderId"`
	BidderName    string        `json:"bidderName"`
	Deposit       int           `json:"deposit"`
	SalePrice     int           `json:"salePrice,omitempty"`
	ItemClaimed   bool          `json:"itemClaimed,omitempty"`
	SellerClaimed bool          `json:"sellerClaimed,omitempty"`
}

type TradingSystem struct {
	mu       sync.RWMutex
	Auctions map[string]*Auction
	db       *database.DB
	economy  *EconomyTelemetry
}

func NewTradingSystem(db *database.DB) *TradingSystem {
	ts := &TradingSystem{
		Auctions: make(map[string]*Auction),
		db:       db,
	}
	if db != nil {
		ts.loadAuctions()
	}
	return ts
}

func (ts *TradingSystem) loadAuctions() {
	auctions, err := ts.db.LoadAuctions()
	if err != nil {
		log.Printf("Failed to load auctions: %v", err)
		return
	}

	ts.mu.Lock()
	defer ts.mu.Unlock()

	count := 0
	for _, dbAuction := range auctions {
		auction := ts.fromDBAuction(dbAuction)
		// Only load active auctions or those needing collection
		// Actually load all, cleanup will handle expiration
		ts.Auctions[auction.ID] = auction
		count++
	}
	log.Printf("Loaded %d auctions from database", count)
}

func (ts *TradingSystem) toDBAuction(a *Auction) *database.Auction {
	return &database.Auction{
		ID:            a.ID,
		SellerID:      a.SellerID,
		SellerName:    a.SellerName,
		Item:          ts.toDBItem(a.Item),
		Bid:           a.Bid,
		Buyout:        a.Buyout,
		Duration:      a.Duration,
		StartTime:     a.StartTime,
		EndTime:       a.EndTime,
		Status:        string(a.Status),
		BuyerID:       a.BuyerID,
		BidderID:      a.BidderID,
		BidderName:    a.BidderName,
		Deposit:       a.Deposit,
		SalePrice:     a.SalePrice,
		ItemClaimed:   a.ItemClaimed,
		SellerClaimed: a.SellerClaimed,
	}
}

func (ts *TradingSystem) toDBItem(i Item) database.Item {
	return database.Item{
		ID:               i.ID,
		Name:             i.Name,
		Type:             string(i.Type),
		Slot:             i.Slot,
		Rarity:           string(i.Rarity),
		Level:            i.Level,
		Stats:            i.Stats,
		Value:            i.Value,
		Icon:             i.Icon,
		Description:      i.Description,
		Stack:            i.Stack,
		MaxStack:         i.MaxStack,
		Potency:          i.Potency,
		Sockets:          i.Sockets,
		Gems:             toDBSocketedGems(i.Gems),
		SetID:            i.SetID,
		UniqueEffect:     i.UniqueEffect,
		GemType:          string(i.GemType),
		GemQuality:       string(i.GemQuality),
		StatScaleVersion: i.StatScaleVersion,
	}
}

func toDBSocketedGems(gems []SocketedGem) []database.SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]database.SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, database.SocketedGem{
			Type:    string(gem.Type),
			Quality: string(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func fromDBSocketedGems(gems []database.SocketedGem) []SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, SocketedGem{
			Type:    GemType(gem.Type),
			Quality: GemQuality(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func (ts *TradingSystem) fromDBAuction(a *database.Auction) *Auction {
	return &Auction{
		ID:            a.ID,
		SellerID:      a.SellerID,
		SellerName:    a.SellerName,
		Item:          ts.fromDBItem(a.Item),
		Bid:           a.Bid,
		Buyout:        a.Buyout,
		Duration:      a.Duration,
		StartTime:     a.StartTime,
		EndTime:       a.EndTime,
		Status:        AuctionStatus(a.Status),
		BuyerID:       a.BuyerID,
		BidderID:      a.BidderID,
		BidderName:    a.BidderName,
		Deposit:       a.Deposit,
		SalePrice:     a.SalePrice,
		ItemClaimed:   a.ItemClaimed,
		SellerClaimed: a.SellerClaimed,
	}
}

func (ts *TradingSystem) fromDBItem(i database.Item) Item {
	stack := i.Stack
	if stack == 0 {
		stack = 1
	}
	item := Item{
		ID:               i.ID,
		Name:             i.Name,
		Type:             ItemType(i.Type),
		Rarity:           ItemRarity(i.Rarity),
		Slot:             i.Slot,
		Level:            i.Level,
		Stats:            i.Stats,
		Value:            i.Value,
		Icon:             i.Icon,
		Description:      i.Description,
		Stack:            stack,
		MaxStack:         i.MaxStack,
		Potency:          i.Potency,
		Sockets:          i.Sockets,
		Gems:             fromDBSocketedGems(i.Gems),
		SetID:            i.SetID,
		UniqueEffect:     i.UniqueEffect,
		GemType:          GemType(i.GemType),
		GemQuality:       GemQuality(i.GemQuality),
		StatScaleVersion: i.StatScaleVersion,
	}
	NormalizeItemStatScale(&item)
	return item
}

func (ts *TradingSystem) CreateAuction(seller *Entity, item Item, bid, buyout, duration int) (*Auction, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if IsChronicleQuestItem(item) {
		return nil, fmt.Errorf("Chronicle artifacts are soulbound")
	}
	if bid <= 0 || buyout < bid || buyout > 1_000_000_000 || duration < 1 || duration > 168 || item.ID == "" {
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

	// Save to DB
	if ts.db != nil {
		if err := ts.db.CreateAuction(ts.toDBAuction(auction)); err != nil {
			log.Printf("Failed to save auction: %v", err)
			delete(ts.Auctions, id)
			seller.Mu.Lock()
			seller.Gold += deposit
			seller.Mu.Unlock()
			return nil, fmt.Errorf("failed to create auction")
		}
	}

	return auction, nil
}

func (ts *TradingSystem) SearchAuctions(query string) []*Auction {
	return ts.SearchAuctionsFiltered(AuctionSearchFilter{Query: query})
}

type AuctionSearchFilter struct {
	Query    string
	ItemType string
	Rarity   string
	MinLevel int
	MaxLevel int
}

func (ts *TradingSystem) SearchAuctionsFiltered(filter AuctionSearchFilter) []*Auction {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	var results []*Auction
	query := strings.ToLower(strings.TrimSpace(filter.Query))
	itemType := strings.TrimSpace(filter.ItemType)
	rarity := strings.TrimSpace(filter.Rarity)

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

		if query != "" && !strings.Contains(strings.ToLower(auction.Item.Name), query) {
			continue
		}
		if itemType != "" && !strings.EqualFold(string(auction.Item.Type), itemType) {
			continue
		}
		if rarity != "" && !strings.EqualFold(string(auction.Item.Rarity), rarity) {
			continue
		}
		if filter.MinLevel > 0 && auction.Item.Level < filter.MinLevel {
			continue
		}
		if filter.MaxLevel > 0 && auction.Item.Level > filter.MaxLevel {
			continue
		}
		results = append(results, auction)
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
		if auction.SellerID == playerID && !auction.SellerClaimed {
			results = append(results, auction)
		} else if auction.BuyerID == playerID && auction.Status == AuctionSold && !auction.ItemClaimed {
			// Include won auctions so I can collect them
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

func (ts *TradingSystem) BuyoutAuction(auctionID string, buyer *Entity, w *World) (*Item, error) {
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

	if buyer.ID == auction.SellerID {
		return nil, fmt.Errorf("cannot buy your own auction")
	}

	buyer.Mu.Lock()
	defer buyer.Mu.Unlock()
	if buyer.Gold < auction.Buyout {
		return nil, fmt.Errorf("insufficient gold")
	}

	// Check for inventory space (Conservative check)
	canFit := false
	// Check for empty slot
	for _, invItem := range buyer.Inventory {
		if invItem.ID == "" {
			canFit = true
			break
		}
	}

	if !canFit && auction.Item.MaxStack > 1 {
		// Check if it can stack
		for _, invItem := range buyer.Inventory {
			if invItem.ID != "" && invItem.Name == auction.Item.Name && invItem.Stack < invItem.MaxStack {
				canFit = true
				break
			}
		}
	}

	if !canFit {
		return nil, fmt.Errorf("inventory full")
	}

	// Persist the single winning transition before delivering the item. The
	// claimed flag prevents a buyout winner from collecting the same item again.
	previousStatus, previousBuyer := auction.Status, auction.BuyerID
	auction.Status = AuctionSold
	auction.BuyerID = buyer.ID
	auction.SalePrice = auction.Buyout
	auction.ItemClaimed = true
	if ts.db != nil {
		if err := ts.db.UpdateAuction(ts.toDBAuction(auction)); err != nil {
			auction.Status, auction.BuyerID = previousStatus, previousBuyer
			auction.SalePrice, auction.ItemClaimed = 0, false
			return nil, fmt.Errorf("failed to persist auction buyout")
		}
	}

	buyer.Gold -= auction.Buyout

	// Add item to buyer
	remaining := buyer.AddItemToInventory(auction.Item)
	if remaining > 0 {
		// Fallback: Try Stash
		leftoverItem := auction.Item
		leftoverItem.Stack = remaining

		remStash := buyer.AddItemToStash(leftoverItem)
		if remStash > 0 {
			// Fallback: Drop on Ground
			leftoverItem.Stack = remStash
			w.DropLoot(leftoverItem, buyer.X, buyer.Y)
		}
	}

	return &auction.Item, nil
}

func (ts *TradingSystem) BidAuction(auctionID string, bidder *Entity, bidAmount int, refundFunc func(string, string, int)) error {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	auction, ok := ts.Auctions[auctionID]
	if !ok {
		return fmt.Errorf("auction not found")
	}

	if auction.Status != AuctionActive {
		return fmt.Errorf("auction is not active")
	}

	if time.Now().After(auction.EndTime) {
		auction.Status = AuctionExpired
		return fmt.Errorf("auction expired")
	}

	if bidder.ID == auction.SellerID {
		return fmt.Errorf("cannot bid on your own auction")
	}

	// Minimum bid increment (e.g. 5% or 1 gold)
	minBid := auction.Bid + int(float64(auction.Bid)*0.05)
	if minBid < auction.Bid+1 {
		minBid = auction.Bid + 1
	}

	// If no bids yet, the bidAmount must be at least the starting bid
	if auction.BidderID == "" {
		minBid = auction.Bid
	}

	if bidAmount < minBid {
		return fmt.Errorf("bid too low (minimum: %d)", minBid)
	}

	if auction.Buyout > 0 && bidAmount >= auction.Buyout {
		return fmt.Errorf("bid exceeds buyout, use buyout instead")
	}

	bidder.Mu.Lock()
	if bidder.Gold < bidAmount {
		bidder.Mu.Unlock()
		return fmt.Errorf("insufficient gold")
	}
	bidder.Gold -= bidAmount
	bidder.Mu.Unlock()

	previousBid, previousBidderID, previousBidderName, previousEnd := auction.Bid, auction.BidderID, auction.BidderName, auction.EndTime
	auction.Bid = bidAmount
	auction.BidderID = bidder.ID
	auction.BidderName = bidder.Name

	// Extend auction if near end? (Anti-sniping)
	if time.Until(auction.EndTime) < 5*time.Minute {
		auction.EndTime = auction.EndTime.Add(5 * time.Minute)
	}

	// Save to DB
	if ts.db != nil {
		if err := ts.db.UpdateAuction(ts.toDBAuction(auction)); err != nil {
			auction.Bid, auction.BidderID, auction.BidderName, auction.EndTime = previousBid, previousBidderID, previousBidderName, previousEnd
			bidder.Mu.Lock()
			bidder.Gold += bidAmount
			bidder.Mu.Unlock()
			return fmt.Errorf("failed to persist auction bid")
		}
	}
	if previousBidderID != "" {
		go refundFunc(previousBidderID, previousBidderName, previousBid)
	}

	return nil
}

func (ts *TradingSystem) CollectAuction(auctionID string, player *Entity) (interface{}, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	auction, ok := ts.Auctions[auctionID]
	if !ok {
		return nil, fmt.Errorf("auction not found")
	}

	// Case 1: Seller collecting Gold (Sold) or Item (Expired/Cancelled)
	if auction.SellerID == player.ID {
		if auction.Status == AuctionSold && !auction.SellerClaimed {
			// Collect Gold
			gold := auction.SalePrice
			if gold <= 0 {
				gold = auction.Bid
			}

			// Calculate Sales Fee
			fee := int(float64(gold) * TradingSalesFeePercent)
			if ts.economy != nil {
				ts.economy.RecordSink("trading_house_fee", fee)
			}
			payout := gold - fee

			// Refund Deposit
			payout += auction.Deposit

			auction.SellerClaimed = true
			if err := ts.persistOrDeleteClaimedAuction(auctionID, auction); err != nil {
				auction.SellerClaimed = false
				return nil, err
			}
			player.Mu.Lock()
			player.Gold += payout
			player.Mu.Unlock()

			return payout, nil
		} else if auction.Status == AuctionExpired || auction.Status == AuctionCancelled {
			if ts.economy != nil {
				ts.economy.RecordSink("trading_house_deposit", auction.Deposit)
			}
			// Collect Item
			// Caller must handle adding item to inventory

			// Remove auction
			if ts.db != nil {
				if err := ts.db.DeleteAuction(auctionID); err != nil {
					return nil, fmt.Errorf("failed to persist auction collection")
				}
			}
			delete(ts.Auctions, auctionID)

			return auction.Item, nil
		}
	}

	// Case 2: Buyer collecting Item (Won via Bid)
	if auction.Status == AuctionSold && auction.BuyerID == player.ID && !auction.ItemClaimed {
		auction.ItemClaimed = true
		if err := ts.persistOrDeleteClaimedAuction(auctionID, auction); err != nil {
			auction.ItemClaimed = false
			return nil, err
		}
		return auction.Item, nil
	}

	return nil, fmt.Errorf("nothing to collect")
}

func (ts *TradingSystem) persistOrDeleteClaimedAuction(auctionID string, auction *Auction) error {
	if auction.ItemClaimed && auction.SellerClaimed {
		if ts.db != nil {
			if err := ts.db.DeleteAuction(auctionID); err != nil {
				return fmt.Errorf("failed to finalize auction")
			}
		}
		delete(ts.Auctions, auctionID)
		return nil
	}
	if ts.db != nil {
		if err := ts.db.UpdateAuction(ts.toDBAuction(auction)); err != nil {
			return fmt.Errorf("failed to persist auction claim")
		}
	}
	return nil
}

// CleanupExpired checks for expired auctions
func (ts *TradingSystem) CleanupExpired() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	now := time.Now()
	for _, auction := range ts.Auctions {
		if auction.Status == AuctionActive && now.After(auction.EndTime) {
			if auction.BidderID != "" {
				auction.Status = AuctionSold
				auction.BuyerID = auction.BidderID
				auction.SalePrice = auction.Bid
			} else {
				auction.Status = AuctionExpired
			}
			// Save to DB
			if ts.db != nil {
				if err := ts.db.UpdateAuction(ts.toDBAuction(auction)); err != nil {
					log.Printf("Failed to update expired auction: %v", err)
				}
			}
		}
	}
}

func (ts *TradingSystem) RemoveAuction(auctionID string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	delete(ts.Auctions, auctionID)
}

func (ts *TradingSystem) CancelAuction(auctionID string, player *Entity, w *World) error {
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

	if ts.db != nil {
		if err := ts.db.DeleteAuction(auctionID); err != nil {
			return fmt.Errorf("failed to persist auction cancellation")
		}
	}
	delete(ts.Auctions, auctionID)

	// Refund item only after cancellation is durable.
	player.Mu.Lock()
	remaining := player.AddItemToInventory(auction.Item)
	player.Mu.Unlock()

	if remaining > 0 {
		// Fallback: Try Stash
		leftoverItem := auction.Item
		leftoverItem.Stack = remaining

		player.Mu.Lock()
		remStash := player.AddItemToStash(leftoverItem)
		player.Mu.Unlock()

		if remStash > 0 {
			// Fallback: Drop on Ground
			leftoverItem.Stack = remStash
			w.DropLoot(leftoverItem, player.X, player.Y)
		}
	}

	return nil
}
