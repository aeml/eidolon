package game

import (
	"fmt"
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
	if requester == nil || target == nil {
		return nil, fmt.Errorf("trade player is unavailable")
	}
	unlock := lockDirectTradePlayers(requester, target)
	defer unlock()
	if requester.Type != TypePlayer || target.Type != TypePlayer || requester.Disconnected || target.Disconnected {
		return nil, fmt.Errorf("trade player is unavailable")
	}
	if err := directTradeReadyForNewOffer(requester, target); err != nil {
		return nil, err
	}
	if requester.InstanceID != target.InstanceID {
		return nil, fmt.Errorf("trade players must be in the same instance")
	}
	if requester.CasinoSeat != nil || target.CasinoSeat != nil {
		return nil, fmt.Errorf("leave the casino seat before trading")
	}
	if !directTradeNearby(requester, target) {
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
	return w.setDirectTradeOffer(playerID, tradeID, itemIDs, gold, false)
}

// Caller must journal/confirm the complete character post-image before sending
// an offer acknowledgement or permitting a decision. This method does no IO;
// bag, Gold and private escrow change together under world/actor ownership.
func (w *World) SetDurableDirectTradeOffer(playerID, tradeID string, itemIDs []string, gold int) (*DirectTrade, error) {
	return w.setDirectTradeOffer(playerID, tradeID, itemIDs, gold, true)
}

func (w *World) setDirectTradeOffer(playerID, tradeID string, itemIDs []string, gold int, durable bool) (*DirectTrade, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade, offer, player, err := w.tradeParticipantLocked(playerID, tradeID)
	if err != nil {
		return nil, err
	}
	peerID := trade.PlayerAID
	if peerID == playerID {
		peerID = trade.PlayerBID
	}
	peer := w.Entities[peerID]
	unlock := lockDirectTradePlayers(player, peer)
	defer unlock()
	if durable && (peer == nil || player.Type != TypePlayer || peer.Type != TypePlayer || player.ID != "player-"+player.Name || peer.ID != "player-"+peer.Name || player.Name == peer.Name) {
		return nil, fmt.Errorf("durable trade participant binding is unavailable")
	}
	if durable && (player.Disconnected || peer.Disconnected || player.InstanceID != peer.InstanceID || player.CasinoSeat != nil || peer.CasinoSeat != nil || !directTradeNearby(player, peer)) {
		return nil, fmt.Errorf("trade players are no longer available in the same nearby scene")
	}
	if !durable && directTradeUsesPrivateState(player, peer) {
		return nil, fmt.Errorf("private trade state requires durable trade recovery")
	}
	if offer.Gold < 0 || player.Gold < 0 || player.Gold > int(^uint(0)>>1)-offer.Gold {
		return nil, fmt.Errorf("trade funds are unavailable")
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
	sources := make(map[string]int, len(player.Inventory)+len(offer.Items))
	for _, item := range player.Inventory {
		if item.ID != "" {
			available[item.ID] = item
			sources[item.ID]++
		}
	}
	for _, item := range offer.Items {
		if item.ID != "" {
			available[item.ID] = item
			sources[item.ID]++
		}
	}
	if durable {
		for _, slots := range [][]Item{player.Stash, player.Buyback} {
			for _, item := range slots {
				if item.ID != "" {
					sources[item.ID]++
				}
			}
		}
		for _, item := range player.Equipment {
			if item.ID != "" {
				sources[item.ID]++
			}
		}
		for _, item := range offer.Items {
			if item.ID == "" || sources[item.ID] != 1 {
				return nil, fmt.Errorf("saved trade escrow has ambiguous item custody")
			}
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
		if sources[itemID] != 1 {
			return nil, fmt.Errorf("trade item identity is ambiguous; no items were moved")
		}
		if IsChronicleQuestItem(item) {
			return nil, fmt.Errorf("Chronicle artifacts are soulbound")
		}
		items = append(items, cloneItem(item))
	}

	// Plan on a private bag. Selected escrow stays in escrow, preserving its ID
	// even if returning it would merge into another stack. Remove selected bag
	// items before returning deselected escrow so a full-bag swap can fit.
	candidate := &Entity{Inventory: cloneItems(player.Inventory)}
	for slot, item := range candidate.Inventory {
		if seen[item.ID] {
			candidate.Inventory[slot] = Item{}
		}
	}
	var returned []Item
	for _, item := range offer.Items {
		if !seen[item.ID] {
			if durable {
				returned = append(returned, item)
			} else if candidate.AddItemToInventory(cloneItem(item)) != 0 {
				return nil, fmt.Errorf("make room in your bag before removing offered items")
			}
		}
	}
	if durable {
		candidate.Inventory, err = placeDirectTradeItemsExactly(candidate.Inventory, returned)
		if err != nil {
			return nil, err
		}
	}
	nextOffer := DirectTradeOffer{Items: items, Gold: gold}
	var nextState []byte
	if durable {
		var unchanged bool
		nextState, unchanged, err = prepareDirectTradeEscrow(player, peer, trade.ID, *offer, nextOffer)
		if err != nil {
			return nil, err
		}
		if unchanged {
			return trade.copy(), nil
		}
	}
	// No refund, world loot, confirmation or live inventory mutation preceded
	// validation. Commit the complete replacement under the actor/world locks.
	player.Inventory = candidate.Inventory
	player.Gold = player.Gold + offer.Gold - gold
	if durable {
		player.DirectTradeState = nextState
		player.UnjournaledSave = true
	}
	*offer = nextOffer
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
	playerA := w.Entities[trade.PlayerAID]
	playerB := w.Entities[trade.PlayerBID]
	unlock := lockDirectTradePlayers(playerA, playerB)
	defer unlock()
	if directTradeUsesPrivateState(playerA, playerB) {
		return nil, false, fmt.Errorf("private trade state requires durable trade recovery")
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
	unlock := lockDirectTradePlayers(w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID])
	defer unlock()
	if directTradeUsesPrivateState(w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID]) {
		return nil, fmt.Errorf("private trade state requires durable trade recovery")
	}
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
	unlock := lockDirectTradePlayers(w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID])
	defer unlock()
	if directTradeUsesPrivateState(w.Entities[trade.PlayerAID], w.Entities[trade.PlayerBID]) {
		return nil // Never refund persisted escrow through the RAM-only path.
	}
	w.cancelTradeLocked(trade)
	return snapshot
}

// World.Mu owns trade membership; actor locks also protect bag/Gold against
// asynchronous combat rewards and other actor-only work. Consistent ordering
// avoids opposite participant order between confirm/cancel/disconnect paths.
func lockDirectTradePlayers(first, second *Entity) func() {
	if first == second {
		second = nil
	}
	if first == nil || (second != nil && second.ID < first.ID) {
		first, second = second, first
	}
	if first != nil {
		first.Mu.Lock()
	}
	if second != nil {
		second.Mu.Lock()
	}
	return func() {
		if second != nil {
			second.Mu.Unlock()
		}
		if first != nil {
			first.Mu.Unlock()
		}
	}
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
			w.groundLootLocked(loot)
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
