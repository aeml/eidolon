package game

import (
	"encoding/json"
	"errors"
	"maps"
	"time"

	"eidolon-server/internal/database"
	"github.com/google/uuid"
)

// Caller owns the entity lock. Both receipts and both effects commit together:
// never debit the real wallet before discovering that the item cannot fit.
func (e *Entity) ApplyAuctionPurchase(id, payload string, price int) error {
	_, itemRecorded := e.ItemDeliveryReceipts[id]
	_, debitRecorded := e.GoldCreditReceipts["buyout:"+id]
	if itemRecorded != debitRecorded {
		return errors.New("incomplete auction purchase receipt pair")
	}
	preview := Entity{Gold: e.Gold, Inventory: e.Inventory, Stash: e.Stash,
		GoldCreditReceipts: maps.Clone(e.GoldCreditReceipts), ItemDeliveryReceipts: maps.Clone(e.ItemDeliveryReceipts)}
	if err := database.ApplyGoldDebit(&preview.Gold, &preview.GoldCreditReceipts, "buyout:"+id, price); err != nil {
		return err
	}
	if err := preview.ApplyAuctionItemDelivery(id, payload); err != nil {
		return err
	}
	e.Gold, e.Inventory, e.Stash = preview.Gold, preview.Inventory, preview.Stash
	e.GoldCreditReceipts, e.ItemDeliveryReceipts = preview.GoldCreditReceipts, preview.ItemDeliveryReceipts
	return nil
}

func (w *World) ApplyDurablePlayerAuctionPurchase(playerID, id, payload string, price int) (bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if err := player.ApplyAuctionPurchase(id, payload, price); err != nil {
		return true, err
	}
	player.UnjournaledSave = true
	return true, nil
}

func (ts *TradingSystem) PrepareAuctionBuyout(auctionID string, buyer *Entity) (*database.AuctionBidOperation, error) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if ts.loadError != nil {
		return nil, ts.loadError
	}
	if _, reserved := ts.pendingBids[auctionID]; reserved {
		return nil, ErrAuctionBidPending
	}
	a := ts.Auctions[auctionID]
	if a == nil || buyer == nil {
		return nil, errors.New("auction or buyer not found")
	}
	if a.Status != AuctionActive || time.Now().After(a.EndTime) {
		return nil, errors.New("auction is not active")
	}
	if a.Buyout <= 0 {
		return nil, errors.New("auction has no buyout price")
	}
	buyer.Mu.RLock()
	defer buyer.Mu.RUnlock()
	if a.SellerID == buyer.ID {
		return nil, errors.New("cannot buy your own auction")
	}
	payload, err := json.Marshal(a.Item)
	if err != nil {
		return nil, err
	}
	op := database.AuctionBidOperation{ID: uuid.NewString(), Kind: database.AuctionOperationBuyout,
		AuctionID: a.ID, PlayerID: buyer.ID, CharacterName: buyer.Name, Amount: a.Buyout,
		ItemPayload: string(payload), PreviousBid: a.Bid, PreviousBidderID: a.BidderID,
		PreviousBidderName: a.BidderName, RefundID: uuid.NewString(), EndTime: a.EndTime.UTC().Truncate(time.Millisecond)}
	if !op.Valid() {
		return nil, errors.New("invalid auction buyout")
	}
	preview := Entity{Gold: buyer.Gold, Inventory: buyer.Inventory, Stash: buyer.Stash}
	if err := preview.ApplyAuctionPurchase(op.ID, op.ItemPayload, op.Amount); err != nil {
		return nil, err
	}
	ts.pendingBids[a.ID] = op
	return &op, nil
}
