package game

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"maps"
	"reflect"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

var ErrAuctionListingItemUnavailable = errors.New("the selected listing item changed or is no longer in your inventory")

// Caller owns the entity lock. A replay checks both receipts before looking
// for the item, which may legitimately be gone or reacquired since the escrow.
func (e *Entity) ApplyAuctionListing(id, payload string, deposit int) error {
	if id == "" || !database.ValidAuctionItemPayload(payload) {
		return errors.New("invalid listing item")
	}
	hash := sha256.Sum256([]byte(payload))
	receipt := hex.EncodeToString(hash[:])
	previous, itemRecorded := e.ItemDeliveryReceipts[id]
	_, debitRecorded := e.GoldCreditReceipts["listing:"+id]
	if itemRecorded != debitRecorded {
		return errors.New("incomplete listing escrow receipt pair")
	}
	gold, receipts := e.Gold, maps.Clone(e.GoldCreditReceipts)
	if err := database.ApplyGoldDebit(&gold, &receipts, "listing:"+id, deposit); err != nil {
		return err
	}
	if itemRecorded {
		if previous != receipt {
			return errors.New("listing identity reused for a different item")
		}
		return nil
	}
	var item Item
	if err := json.Unmarshal([]byte(payload), &item); err != nil {
		return err
	}
	selected := -1
	for i, current := range e.Inventory {
		if current.ID != item.ID || current.Stack < item.Stack {
			continue
		}
		current.Stack = item.Stack
		if !reflect.DeepEqual(current, item) {
			continue
		}
		if selected != -1 {
			return ErrAuctionListingItemUnavailable
		}
		selected = i
	}
	if selected < 0 {
		return ErrAuctionListingItemUnavailable
	}
	inventory := cloneItems(e.Inventory)
	inventory[selected].Stack -= item.Stack
	if inventory[selected].Stack == 0 {
		inventory[selected] = Item{}
	}
	e.Gold, e.GoldCreditReceipts, e.Inventory = gold, receipts, inventory
	if e.ItemDeliveryReceipts == nil {
		e.ItemDeliveryReceipts = make(map[string]string)
	}
	e.ItemDeliveryReceipts[id] = receipt
	return nil
}

func (w *World) ApplyDurablePlayerAuctionListing(playerID, id, payload string, deposit int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if err := player.ApplyAuctionListing(id, payload, deposit); err != nil {
		return true, err
	}
	player.UnjournaledSave = true
	return true, nil
}

func (ts *TradingSystem) PrepareAuctionListing(seller *Entity, slot, bid, buyout, hours int) (*database.AuctionBidOperation, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.loadError != nil {
		return nil, ts.loadError
	}
	if seller == nil {
		return nil, errors.New("seller not found")
	}
	seller.Mu.RLock()
	defer seller.Mu.RUnlock()
	for _, pending := range ts.pendingBids {
		if pending.PlayerID == seller.ID {
			return nil, ErrAuctionBidPending
		}
	}
	if slot < 0 || slot >= len(seller.Inventory) {
		return nil, errors.New("Invalid inventory slot")
	}
	item := seller.Inventory[slot]
	if item.ID == "" {
		return nil, errors.New("No item in slot")
	}
	if IsChronicleQuestItem(item) {
		return nil, errors.New("Chronicle artifacts are soulbound")
	}
	if bid <= 0 || buyout < bid || buyout > 1_000_000_000 || hours < 1 || hours > 168 {
		return nil, errors.New("invalid price")
	}
	payload, err := json.Marshal(item)
	if err != nil {
		return nil, err
	}
	start := time.Now().UTC().Truncate(time.Millisecond)
	op := database.AuctionBidOperation{ID: uuid.NewString(), AuctionID: uuid.NewString(), Kind: database.AuctionOperationListing,
		PlayerID: seller.ID, CharacterName: seller.Name, ItemPayload: string(payload), Amount: database.AuctionListingDeposit(buyout),
		ListingBid: bid, ListingBuyout: buyout, ListingHours: hours, ListingStart: start, EndTime: start.Add(time.Duration(hours) * time.Hour)}
	if !op.Valid() {
		return nil, errors.New("invalid listing decision")
	}
	preview := Entity{Gold: seller.Gold, Inventory: seller.Inventory}
	if err := preview.ApplyAuctionListing(op.ID, op.ItemPayload, op.Amount); err != nil {
		return nil, err
	}
	ts.pendingBids[op.AuctionID] = op // No visible auction until its escrow commits.
	return &op, nil
}
