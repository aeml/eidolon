package game

import (
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"strings"

	"eidolon-server/internal/database"
)

var ErrDirectTradeDeliveryFull = errors.New("trade delivery is safely retained; free bag space or wallet room to receive it")

// Caller holds the actor lock and both accounts' work locks, and has re-read
// the exact frozen shared intent. This changes private custody only; Gold and
// the visible bag are untouched until a separate journaled claim.
func (player *Entity) ApplyDirectTradeDecision(op database.DirectTradeOperation) (bool, error) {
	if player.Type != TypePlayer || player.ID != "player-"+player.Name {
		return false, database.ErrDirectTradeConflict
	}
	character := &database.Character{Name: player.Name, DirectTradeState: database.CloneDirectTradeState(player.DirectTradeState)}
	changed, err := database.ApplyDirectTradeCharacterDecision(player.Name, character, op)
	if err != nil || !changed {
		return changed, err
	}
	player.DirectTradeState = database.CloneDirectTradeState(character.DirectTradeState)
	player.UnjournaledSave = true
	return true, nil
}

func (w *World) ApplyDurableDirectTradeDecision(playerID string, op database.DirectTradeOperation) (found, changed bool, err error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	changed, err = player.ApplyDirectTradeDecision(op)
	return true, changed, err
}

// Claim the entire owned delivery on detached storage. Partial stacking, full
// bags, wallet overflow, ambiguous custody and unknown future item formats must
// retain the original outbox: never drop world loot or compensate the sender.
// Caller must persist the complete post-image before acknowledging a claim.
func (player *Entity) ClaimDirectTradeDelivery() (bool, error) {
	if player.Type != TypePlayer || player.ID != "player-"+player.Name {
		return false, database.ErrDirectTradeConflict
	}
	state, err := database.DecodeDirectTradeState(player.DirectTradeState)
	if err != nil {
		return false, err
	}
	if state.Delivery == nil {
		return false, nil
	}
	var offer DirectTradeOffer
	decoder := json.NewDecoder(strings.NewReader(state.Delivery.OfferPayload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&offer); err != nil {
		return false, err // A newer item's exact payload remains owned and intact.
	}
	if state.Revision == math.MaxInt64 || player.Gold < 0 || offer.Gold < 0 || len(player.Inventory) > MaxInventorySize {
		return false, database.ErrDirectTradeConflict
	}
	if player.Gold > math.MaxInt-offer.Gold {
		return false, ErrDirectTradeDeliveryFull
	}
	owned := map[string]bool{}
	for _, slots := range [][]Item{player.Inventory, player.Stash, player.Buyback} {
		for _, item := range slots {
			if item.ID != "" {
				owned[item.ID] = true
			}
		}
	}
	for _, item := range player.Equipment {
		if item.ID != "" {
			owned[item.ID] = true
		}
	}
	for _, item := range offer.Items {
		if owned[item.ID] || IsChronicleQuestItem(item) {
			return false, database.ErrDirectTradeConflict
		}
	}
	inventory, err := placeDirectTradeItemsExactly(player.Inventory, offer.Items)
	if err != nil {
		return false, err
	}
	state.Delivery = nil
	state.Revision++
	encoded, err := database.EncodeDirectTradeState(*state)
	if err != nil {
		return false, err
	}
	player.Inventory, player.Gold, player.DirectTradeState = inventory, player.Gold+offer.Gold, encoded
	player.UnjournaledSave = true
	return true, nil
}

// Used for both deselected escrow and owned deliveries. Unlike the ordinary
// legacy pickup helper, equal names alone cannot erase earned affixes or gems.
func placeDirectTradeItemsExactly(original []Item, items []Item) ([]Item, error) {
	if len(original) > MaxInventorySize {
		return nil, database.ErrDirectTradeConflict
	}
	inventory := cloneItems(original)
	if len(inventory) < MaxInventorySize {
		inventory = append(inventory, make([]Item, MaxInventorySize-len(inventory))...)
	}
	for _, item := range items {
		item.Stack, item.MaxStack = max(1, item.Stack), max(1, item.MaxStack)
		remaining := item.Stack
		if item.MaxStack > 1 {
			for index := range inventory {
				existing := &inventory[index]
				if existing.ID == "" || existing.Stack <= 0 || existing.Stack >= existing.MaxStack {
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
				if remaining == 0 {
					break
				}
			}
		}
		if remaining > 0 {
			for index := range inventory {
				if inventory[index].ID == "" {
					inventory[index] = cloneItem(item)
					inventory[index].Stack = remaining
					remaining = 0
					break
				}
			}
		}
		if remaining != 0 {
			return nil, ErrDirectTradeDeliveryFull
		}
	}
	return inventory, nil
}

func (w *World) ClaimDurableDirectTradeDelivery(playerID string) (found, changed bool, err error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return false, false, nil
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Type != TypePlayer {
		return true, false, database.ErrDirectTradeConflict
	}
	changed, err = player.ClaimDirectTradeDelivery()
	return true, changed, err
}

// Remove only the ephemeral table after BOTH participant receipts are confirmed
// and the shared decision is complete. No refund/item/Gold effect occurs here.
func (w *World) RetireDurableDirectTrade(op database.DirectTradeOperation) (*DirectTrade, error) {
	if err := op.Validate(); err != nil {
		return nil, err
	}
	if op.State != database.DirectTradeComplete {
		return nil, database.ErrDirectTradeConflict
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	trade := w.DirectTrades[op.TradeID]
	if trade == nil {
		return nil, nil
	}
	a, b := op.Participants[0].PlayerID, op.Participants[1].PlayerID
	if !((trade.PlayerAID == a && trade.PlayerBID == b) || (trade.PlayerAID == b && trade.PlayerBID == a)) {
		return nil, database.ErrDirectTradeConflict
	}
	copy := trade.copy()
	w.deleteTradeLocked(trade)
	return copy, nil
}
