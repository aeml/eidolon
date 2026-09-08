package game

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"reflect"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

var ErrAuctionStorageFull = errors.New("inventory and stash are full; free space before collecting this item")

// Caller holds the entity lock. Plan the entire placement on detached storage;
// an unplaceable remainder must not mutate partial stacks or create ground loot.
func (e *Entity) ApplyAuctionItemDelivery(id, payload string) error {
	if id == "" || !database.ValidAuctionItemPayload(payload) {
		return errors.New("invalid auction item delivery")
	}
	fingerprint := sha256.Sum256([]byte(payload))
	receipt := hex.EncodeToString(fingerprint[:])
	if previous, found := e.ItemDeliveryReceipts[id]; found {
		if previous != receipt {
			return errors.New("auction delivery identity reused for a different item")
		}
		return nil // Receipt precedes capacity and item-presence checks.
	}
	var item Item
	if err := json.Unmarshal([]byte(payload), &item); err != nil {
		return err
	}
	inventory, stash := cloneItems(e.Inventory), cloneItems(e.Stash)
	if len(inventory) < MaxInventorySize {
		inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
	}
	remaining := item.Stack
	place := func(slots []Item, grow bool, limit int) []Item {
		for index := range slots {
			existing := &slots[index]
			if remaining == 0 {
				break
			}
			if item.MaxStack <= 1 || existing.ID == "" || existing.Stack <= 0 || existing.Stack >= existing.MaxStack {
				continue
			}
			left, right := *existing, item
			left.ID, right.ID, left.Stack, right.Stack = "", "", 0, 0
			if !reflect.DeepEqual(left, right) {
				continue
			}
			amount := min(remaining, existing.MaxStack-existing.Stack)
			existing.Stack += amount
			remaining -= amount
		}
		for index := range slots {
			if remaining == 0 {
				break
			}
			if slots[index].ID == "" {
				slots[index] = cloneItem(item)
				slots[index].Stack = remaining
				remaining = 0
			}
		}
		if remaining > 0 && grow && len(slots) < limit {
			copy := cloneItem(item)
			copy.Stack = remaining
			slots = append(slots, copy)
			remaining = 0
		}
		return slots
	}
	inventory = place(inventory, false, MaxInventorySize)
	stash = place(stash, true, MaxStashSize)
	if remaining != 0 {
		return ErrAuctionStorageFull
	}
	e.Inventory, e.Stash = inventory, stash
	if e.ItemDeliveryReceipts == nil {
		e.ItemDeliveryReceipts = make(map[string]string)
	}
	e.ItemDeliveryReceipts[id] = receipt
	return nil
}

func (w *World) ApplyDurablePlayerItemDelivery(playerID, id, payload string) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if err := player.ApplyAuctionItemDelivery(id, payload); err != nil {
		return true, err
	}
	player.UnjournaledSave = true
	return true, nil
}

func (ts *TradingSystem) PrepareAuctionItemClaim(auctionID string, player *Entity) (*database.AuctionBidOperation, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.loadError != nil {
		return nil, ts.loadError
	}
	if _, reserved := ts.pendingBids[auctionID]; reserved {
		return nil, ErrAuctionBidPending
	}
	a := ts.Auctions[auctionID]
	if a == nil || player == nil {
		return nil, errors.New("auction or player not found")
	}
	player.Mu.RLock()
	defer player.Mu.RUnlock()
	eligible := a.Status == AuctionSold && a.BuyerID == player.ID ||
		(a.Status == AuctionExpired || a.Status == AuctionCancelled) && a.SellerID == player.ID
	if !eligible || a.ItemClaimed {
		return nil, nil
	}
	payload, err := json.Marshal(a.Item)
	if err != nil {
		return nil, err
	}
	op := database.AuctionBidOperation{ID: uuid.NewString(), Kind: database.AuctionOperationItemClaim,
		AuctionID: auctionID, PlayerID: player.ID, CharacterName: player.Name,
		ClaimStatus: string(a.Status), ItemPayload: string(payload), EndTime: a.EndTime.UTC().Truncate(time.Millisecond)}
	if !op.Valid() {
		return nil, errors.New("invalid auction item claim")
	}
	preview := Entity{Inventory: player.Inventory, Stash: player.Stash}
	if err := preview.ApplyAuctionItemDelivery(op.ID, op.ItemPayload); err != nil {
		return nil, err
	}
	ts.pendingBids[auctionID] = op
	return &op, nil
}
