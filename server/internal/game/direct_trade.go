package game

import (
	"fmt"
	"math"
	"time"
)

const MaxDirectTradeGold = 100_000

type DirectTradeOffer struct {
	Items []Item `json:"items"`
	Gold  int    `json:"gold"`
}

type DirectTrade struct {
	ID         string           `json:"id"`
	PlayerAID  string           `json:"playerAId"`
	PlayerBID  string           `json:"playerBId"`
	OfferA     DirectTradeOffer `json:"offerA"`
	OfferB     DirectTradeOffer `json:"offerB"`
	ConfirmedA bool             `json:"confirmedA"`
	ConfirmedB bool             `json:"confirmedB"`
	CreatedAt  time.Time        `json:"createdAt"`
}

func (trade *DirectTrade) copy() *DirectTrade {
	if trade == nil {
		return nil
	}
	copyTrade := *trade
	copyTrade.OfferA.Items = cloneItems(trade.OfferA.Items)
	copyTrade.OfferB.Items = cloneItems(trade.OfferB.Items)
	return &copyTrade
}

func (w *World) StartDirectTrade(requesterID, targetID string) (*DirectTrade, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	if requesterID == targetID {
		return nil, fmt.Errorf("cannot trade with yourself")
	}
	requester := w.Entities[requesterID]
	target := w.Entities[targetID]
	if requester == nil || target == nil || requester.Type != TypePlayer || target.Type != TypePlayer || requester.Disconnected || target.Disconnected {
		return nil, fmt.Errorf("trade player is unavailable")
	}
	if requester.InstanceID != target.InstanceID {
		return nil, fmt.Errorf("trade players must be in the same instance")
	}
	dx, dz := requester.X-target.X, requester.Z-target.Z
	if math.Hypot(dx, dz) > 8 {
		return nil, fmt.Errorf("trade player is too far away")
	}
	if w.TradeByPlayer[requesterID] != "" || w.TradeByPlayer[targetID] != "" {
		return nil, fmt.Errorf("a player is already trading")
	}
	trade := &DirectTrade{
		ID:        fmt.Sprintf("trade-%d-%s", time.Now().UnixNano(), requesterID),
		PlayerAID: requesterID,
		PlayerBID: targetID,
		CreatedAt: time.Now().UTC(),
	}
	w.DirectTrades[trade.ID] = trade
	w.TradeByPlayer[requesterID] = trade.ID
	w.TradeByPlayer[targetID] = trade.ID
	return trade.copy(), nil
}

func (w *World) SetDirectTradeOffer(playerID, tradeID string, itemIDs []string, gold int) (*DirectTrade, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, offer, player, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, err
	}
	if gold < 0 || gold > MaxDirectTradeGold || gold > player.Gold+offer.Gold {
		return nil, fmt.Errorf("invalid trade gold")
	}
	if len(itemIDs) > MaxInventorySize {
		return nil, fmt.Errorf("too many trade items")
	}

	seen := make(map[string]bool, len(itemIDs))
	items := make([]Item, 0, len(itemIDs))
	available := make(map[string]Item, len(player.Inventory)+len(offer.Items))
	for _, item := range player.Inventory {
		if item.ID != "" {
			available[item.ID] = item
		}
	}
	for _, item := range offer.Items {
		if item.ID != "" {
			available[item.ID] = item
		}
	}
	for _, itemID := range itemIDs {
		if itemID == "" || seen[itemID] {
			return nil, fmt.Errorf("invalid trade item")
		}
		seen[itemID] = true
		item, found := available[itemID]
		if !found {
			return nil, fmt.Errorf("trade item not found")
		}
		if IsChronicleQuestItem(item) {
			return nil, fmt.Errorf("Chronicle artifacts are soulbound")
		}
		items = append(items, cloneItem(item))
	}

	// Editing an offer first returns its previous escrow, then atomically moves
	// the validated replacement into server-owned storage.
	w.returnTradeOfferLocked(player, *offer)
	if gold > player.Gold {
		return nil, fmt.Errorf("trade gold changed while editing offer")
	}
	// Re-resolve item indices because returning the old offer can fill slots.
	for i, item := range items {
		index := -1
		for slot := range player.Inventory {
			if player.Inventory[slot].ID == item.ID {
				index = slot
				break
			}
		}
		if index < 0 {
			// Roll back any replacement items already removed.
			for _, removed := range items[:i] {
				_ = player.AddItemToInventory(removed)
			}
			return nil, fmt.Errorf("trade item changed while editing offer")
		}
		player.Inventory[index] = Item{}
	}
	player.Gold -= gold
	*offer = DirectTradeOffer{Items: items, Gold: gold}
	trade.ConfirmedA = false
	trade.ConfirmedB = false
	return trade.copy(), nil
}

func (w *World) ConfirmDirectTrade(playerID, tradeID string) (*DirectTrade, bool, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, _, _, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, false, err
	}
	if playerID == trade.PlayerAID {
		trade.ConfirmedA = true
	} else {
		trade.ConfirmedB = true
	}
	if !trade.ConfirmedA || !trade.ConfirmedB {
		return trade.copy(), false, nil
	}
	if len(trade.OfferA.Items)+len(trade.OfferB.Items) == 0 {
		trade.ConfirmedA, trade.ConfirmedB = false, false
		return trade.copy(), false, fmt.Errorf("gold-only direct trades are not allowed")
	}
	playerA := w.Entities[trade.PlayerAID]
	playerB := w.Entities[trade.PlayerBID]
	if playerA == nil || playerB == nil || !canReceiveTradeItems(playerA.Inventory, trade.OfferB.Items) || !canReceiveTradeItems(playerB.Inventory, trade.OfferA.Items) {
		trade.ConfirmedA, trade.ConfirmedB = false, false
		return trade.copy(), false, fmt.Errorf("recipient inventory is full")
	}
	for _, item := range trade.OfferB.Items {
		_ = playerA.AddItemToInventory(item)
	}
	for _, item := range trade.OfferA.Items {
		_ = playerB.AddItemToInventory(item)
	}
	playerA.Gold += trade.OfferB.Gold
	playerB.Gold += trade.OfferA.Gold
	completed := trade.copy()
	w.deleteTradeLocked(trade)
	return completed, true, nil
}

func (w *World) CancelDirectTrade(playerID, tradeID string) (*DirectTrade, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, _, _, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, err
	}
	snapshot := trade.copy()
	w.cancelTradeLocked(trade)
	return snapshot, nil
}

func (w *World) CancelDirectTradesForPlayer(playerID string) *DirectTrade {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade := w.DirectTrades[w.TradeByPlayer[playerID]]
	if trade == nil {
		return nil
	}
	snapshot := trade.copy()
	w.cancelTradeLocked(trade)
	return snapshot
}

func (w *World) tradeParticipantLocked(playerID, tradeID string) (*DirectTrade, *DirectTradeOffer, *Entity, error) {
	trade := w.DirectTrades[tradeID]
	if trade == nil || w.TradeByPlayer[playerID] != tradeID {
		return nil, nil, nil, fmt.Errorf("trade not found")
	}
	player := w.Entities[playerID]
	if player == nil {
		return nil, nil, nil, fmt.Errorf("trade player not found")
	}
	if playerID == trade.PlayerAID {
		return trade, &trade.OfferA, player, nil
	}
	if playerID == trade.PlayerBID {
		return trade, &trade.OfferB, player, nil
	}
	return nil, nil, nil, fmt.Errorf("not a trade participant")
}

func (w *World) cancelTradeLocked(trade *DirectTrade) {
	w.returnTradeOfferLocked(w.Entities[trade.PlayerAID], trade.OfferA)
	w.returnTradeOfferLocked(w.Entities[trade.PlayerBID], trade.OfferB)
	w.deleteTradeLocked(trade)
}

func (w *World) returnTradeOfferLocked(player *Entity, offer DirectTradeOffer) {
	if player == nil {
		return
	}
	player.Gold += offer.Gold
	for _, item := range offer.Items {
		if remaining := player.AddItemToInventory(item); remaining > 0 {
			item.Stack = remaining
			loot := &Entity{
				ID:   fmt.Sprintf("trade-return-%d-%s", time.Now().UnixNano(), item.ID),
				Type: TypeLoot, X: player.X, Y: .5, Z: player.Z, InstanceID: player.InstanceID,
				LootItem: &item, LootTime: time.Now(), CreatedAt: time.Now(),
			}
			w.Entities[loot.ID] = loot
			w.Grid.Add(loot)
		}
	}
}

func (w *World) deleteTradeLocked(trade *DirectTrade) {
	delete(w.DirectTrades, trade.ID)
	delete(w.TradeByPlayer, trade.PlayerAID)
	delete(w.TradeByPlayer, trade.PlayerBID)
}

func canReceiveTradeItems(inventory []Item, items []Item) bool {
	testInventory := cloneItems(inventory)
	testEntity := &Entity{Inventory: testInventory}
	for _, item := range items {
		if testEntity.AddItemToInventory(item) != 0 {
			return false
		}
	}
	return true
}
