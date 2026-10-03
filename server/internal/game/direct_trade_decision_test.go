package game

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
)

func TestDirectTradeDecisionRejectsInvalidAdmissionWithoutFinancialEffect(t *testing.T) {
	for _, outcome := range []string{"offline", "different instance", "too far", "NaN position", "infinite position", "seated", "full recipient", "negative wallet", "wallet overflow", "missing escrow", "wrong peer", "wrong identity", "duplicate ordinary custody", "changed offer"} {
		t.Run(outcome, func(t *testing.T) {
			item := Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1, Stats: map[string]int{"damage": 23}}
			w, a, b, trade := durableTradeFixture(t, item)
			if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 7); err != nil {
				t.Fatal(err)
			}
			switch outcome {
			case "offline":
				b.Disconnected = true
			case "different instance":
				b.InstanceID = "elsewhere"
			case "too far":
				b.X = 9
			case "NaN position":
				b.X = math.NaN()
			case "infinite position":
				b.Z = math.Inf(1)
			case "seated":
				b.CasinoSeat = &CasinoSeatSession{}
			case "full recipient":
				b.Inventory = make([]Item, MaxInventorySize)
				for index := range b.Inventory {
					b.Inventory[index] = Item{ID: fmt.Sprintf("resident-%d", index), Name: "Resident", Stack: 1, MaxStack: 1}
				}
			case "negative wallet":
				b.Gold = -1
			case "wallet overflow":
				b.Gold = math.MaxInt
			case "missing escrow":
				a.DirectTradeState = nil
			case "wrong peer":
				state, err := database.DecodeDirectTradeState(a.DirectTradeState)
				if err != nil {
					t.Fatal(err)
				}
				state.Escrow.PeerUsername, state.Escrow.PeerPlayerID, state.Escrow.PeerCharacterName = "outsider", "player-outsider", "outsider"
				a.DirectTradeState, err = database.EncodeDirectTradeState(*state)
				if err != nil {
					t.Fatal(err)
				}
			case "wrong identity":
				b.Name = "outsider"
			case "duplicate ordinary custody":
				a.Stash = []Item{cloneItem(item)}
			case "changed offer":
				w.DirectTrades[trade.ID].OfferA.Items[0].Stats["damage"]++
			}
			w.DirectTrades[trade.ID].ConfirmedA, w.DirectTrades[trade.ID].ConfirmedB = true, true
			// Snapshot only financial custody; NaN makes a whole-entity equality
			// comparison misleading even when every field is unchanged.
			before, _ := json.Marshal([]any{a.Gold, b.Gold, a.EP, b.EP, a.Inventory, b.Inventory, a.Stash, b.Stash, a.DirectTradeState, b.DirectTradeState})
			prior := w.DirectTrades[trade.ID].copy()
			result, op, err := w.PrepareDurableDirectTradeConfirmation(a.ID, trade.ID)
			after, _ := json.Marshal([]any{a.Gold, b.Gold, a.EP, b.EP, a.Inventory, b.Inventory, a.Stash, b.Stash, a.DirectTradeState, b.DirectTradeState})
			if err == nil || op != nil || result == nil || result.ConfirmedA || result.ConfirmedB || string(before) != string(after) {
				t.Fatal("invalid admission captured a decision or changed financial custody", err)
			}
			prior.ConfirmedA, prior.ConfirmedB = false, false
			if !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) {
				t.Fatal("rejection changed the authoritative offers or table identity")
			}
		})
	}
}

func TestDirectTradeDecisionOutsiderCannotConfirmOrCancel(t *testing.T) {
	w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1})
	if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 7); err != nil {
		t.Fatal(err)
	}
	w.DirectTrades[trade.ID].ConfirmedA = true
	beforeA, beforeB, prior := w.GetEntityCopy(a.ID), w.GetEntityCopy(b.ID), w.DirectTrades[trade.ID].copy()
	if _, op, err := w.PrepareDurableDirectTradeConfirmation("player-outsider", trade.ID); err == nil || op != nil {
		t.Fatal("outsider confirmed another party's trade")
	}
	if _, op, err := w.PrepareDurableDirectTradeCancellation("player-outsider", trade.ID); err == nil || op != nil {
		t.Fatal("outsider cancelled another party's trade")
	}
	if !reflect.DeepEqual(w.GetEntityCopy(a.ID), beforeA) || !reflect.DeepEqual(w.GetEntityCopy(b.ID), beforeB) || !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) {
		t.Fatal("outsider changed custody or reset an owner's confirmation")
	}
}

func TestDirectTradeNonFinitePositionsCannotStartOrChangeOffers(t *testing.T) {
	for _, coordinate := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1})
		b.X = coordinate
		before, prior := w.GetEntityCopy(a.ID), w.DirectTrades[trade.ID].copy()
		if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 7); err == nil ||
			!reflect.DeepEqual(w.GetEntityCopy(a.ID), before) || !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) {
			t.Fatal("non-finite coordinates allowed an offer debit", coordinate)
		}
		w.deleteTradeLocked(w.DirectTrades[trade.ID])
		if _, err := w.StartDirectTrade(a.ID, b.ID); err == nil || len(w.DirectTrades) != 0 {
			t.Fatal("non-finite coordinates allowed new trade membership", coordinate)
		}
	}
}

func TestDirectTradeCancellationCaptureRemainsAvailableOutsideGameplayAdmission(t *testing.T) {
	w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1})
	trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	b.Disconnected, b.InstanceID, b.X, b.Gold = true, "elsewhere", 999, math.MaxInt
	b.CasinoSeat = &CasinoSeatSession{}
	a.Inventory = make([]Item, MaxInventorySize)
	for index := range a.Inventory {
		a.Inventory[index] = Item{ID: fmt.Sprintf("resident-%d", index), Name: "Resident", Stack: 1, MaxStack: 1}
	}
	beforeA, beforeB := w.GetEntityCopy(a.ID), w.GetEntityCopy(b.ID)
	_, op, err := w.PrepareDurableDirectTradeCancellation(a.ID, trade.ID)
	if err != nil || op == nil || op.Decision != database.DirectTradeCancel || op.Validate() != nil ||
		!reflect.DeepEqual(w.GetEntityCopy(a.ID), beforeA) || !reflect.DeepEqual(w.GetEntityCopy(b.ID), beforeB) {
		t.Fatal("cancellation capture needs connected/nearby peers, wallet or bag space, or refunded before persistence", err)
	}
	state, _ := database.DecodeDirectTradeState(a.DirectTradeState)
	if state.Escrow == nil || op.Participants[0].OfferPayload != state.Escrow.OfferPayload || op.Participants[0].ExpectedRevision != state.Revision {
		t.Fatal("cancellation did not bind exact owned escrow")
	}
}
