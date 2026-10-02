package game

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strings"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"go.mongodb.org/mongo-driver/bson"
)

func durableTradeFixture(t *testing.T, items ...Item) (*World, *Entity, *Entity, *DirectTrade) {
	t.Helper()
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	a, b := directTradePlayer("player-alice", 0, 100, items...), directTradePlayer("player-bob", 1, 100)
	a.Name, b.Name, a.EP, b.EP = "alice", "bob", 11, 19
	a.Health, a.MaxHealth, b.Health, b.MaxHealth = 100, 100, 100, 100
	w.AddEntity(a)
	w.AddEntity(b)
	trade, err := w.StartDirectTrade(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	return w, a, b, trade
}

func durableTradePlan(t *testing.T, trade *DirectTrade, a, b *Entity, decision string) database.DirectTradeOperation {
	t.Helper()
	op := database.DirectTradeOperation{Version: 1, ID: database.DirectTradeOperationID(trade.ID),
		TradeID: trade.ID, Decision: decision, State: database.DirectTradePending, CreatedAt: trade.CreatedAt}
	for index, player := range []*Entity{a, b} {
		state, err := database.DecodeDirectTradeState(player.DirectTradeState)
		if err != nil {
			t.Fatal(err)
		}
		offer := trade.OfferA
		if index == 1 {
			offer = trade.OfferB
		}
		payload, _ := json.Marshal(offer)
		op.Participants[index] = database.DirectTradeParticipant{Username: player.Name, PlayerID: player.ID,
			CharacterName: player.Name, ExpectedRevision: state.Revision, OfferPayload: string(payload)}
	}
	op.Fingerprint, _ = database.DirectTradeOperationFingerprint(op)
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	return op
}

func TestDirectTradeDurableOfferOwnsExactEscrowAndIdempotentEdit(t *testing.T) {
	item := Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1, Potency: 4,
		Stats: map[string]int{"damage": 13}, Gems: []SocketedGem{{Stats: map[string]int{"strength": 7}}},
		ForgeBasis: &forging.Basis{Level: 67, Stats: map[string]int{"damage": 9}}}
	w, a, _, trade := durableTradeFixture(t, item)
	for index, gold := range []int{5, 10} {
		var err error
		trade, err = w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, gold)
		if err != nil {
			t.Fatal(err)
		}
		state, err := database.DecodeDirectTradeState(a.DirectTradeState)
		payload, _ := json.Marshal(trade.OfferA)
		if err != nil || state.Revision != int64(index+1) || state.Escrow == nil || state.Escrow.OfferPayload != string(payload) || state.Escrow.TradeID != trade.ID ||
			state.Escrow.PeerUsername != "bob" || state.Escrow.PeerPlayerID != "player-bob" || state.Escrow.PeerCharacterName != "bob" ||
			a.Gold != 100-gold || a.Inventory[0].ID != "" || a.EP != 11 || !a.UnjournaledSave || !reflect.DeepEqual(trade.OfferA.Items[0], item) {
			t.Fatal("debit and exact owned escrow did not change together", state, err)
		}
	}
	w.DirectTrades[trade.ID].ConfirmedA, w.DirectTrades[trade.ID].ConfirmedB = true, true
	before := w.GetEntityCopy(a.ID)
	for attempt := 0; attempt < 3; attempt++ {
		retry, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 10)
		if err != nil || !retry.ConfirmedA || !retry.ConfirmedB || !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) {
			t.Fatal("identical offer replay changed custody, revision or confirmations", err)
		}
	}
	trade.OfferA.Items[0].Stats["damage"] = 99
	state, _ := database.DecodeDirectTradeState(a.DirectTradeState)
	if strings.Contains(state.Escrow.OfferPayload, "99") {
		t.Fatal("reply item aliases private escrow")
	}
}

func TestDirectTradeDurableOfferFullBagSwapAndRejectedReturn(t *testing.T) {
	item := Item{ID: "escrowed", Name: "Original", Stack: 1, MaxStack: 1}
	w, a, _, trade := durableTradeFixture(t, item)
	trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 7)
	if err != nil {
		t.Fatal(err)
	}
	fillTradeBagByPickup(t, w, a)
	w.DirectTrades[trade.ID].ConfirmedB = true
	before := w.GetEntityCopy(a.ID)
	if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, nil, 0); err == nil || !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) || !w.DirectTrades[trade.ID].ConfirmedB {
		t.Fatal("rejected return changed bag, Gold, private escrow or confirmation")
	}
	replacement := a.Inventory[0]
	trade, err = w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{replacement.ID}, 8)
	if err != nil || trade.OfferA.Items[0].ID != replacement.ID || a.Inventory[0].ID != item.ID || a.Gold != 92 || trade.ConfirmedB {
		t.Fatal("full-bag swap did not exchange owned custody atomically", trade, err)
	}
}

func TestDirectTradeDurableOfferRejectsInvalidPrivateStateWithoutDebit(t *testing.T) {
	for _, outcome := range []string{"unknown version", "other escrow", "RAM-only escrow", "overflow revision", "bad item stack", "oversized item", "unclaimed delivery", "duplicate stash", "duplicate equipment"} {
		t.Run(outcome, func(t *testing.T) {
			item := Item{ID: "earned", Name: "Earned", Stack: 1, MaxStack: 1}
			w, a, _, trade := durableTradeFixture(t, item)
			switch outcome {
			case "unknown version":
				a.DirectTradeState, _ = jsonToBSONTradeState(9)
			case "other escrow":
				a.DirectTradeState, _ = database.EncodeDirectTradeState(database.DirectTradeCharacterState{Version: 1, Revision: 2,
					Escrow: &database.DirectTradeEscrowState{TradeID: "other", OfferPayload: `{"gold":0,"items":[]}`}})
			case "RAM-only escrow":
				if _, err := w.SetDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 5); err != nil {
					t.Fatal(err)
				}
			case "overflow revision":
				a.DirectTradeState, _ = database.EncodeDirectTradeState(database.DirectTradeCharacterState{Version: 1, Revision: math.MaxInt64})
			case "bad item stack":
				a.Inventory[0].Stack = -1
			case "oversized item":
				a.Inventory[0].Description = strings.Repeat("x", database.MaxDirectTradeOfferBytes)
			case "duplicate stash":
				a.Stash = []Item{cloneItem(item)}
			case "duplicate equipment":
				a.Equipment = map[string]Item{"mainHand": cloneItem(item)}
			case "unclaimed delivery":
				id := database.DirectTradeOperationID("previous")
				a.DirectTradeState, _ = database.EncodeDirectTradeState(database.DirectTradeCharacterState{Version: 1, Revision: 2,
					LastOperationID: id, LastOperationFingerprint: strings.Repeat("a", 64), LastOperationRevision: 2,
					Delivery: &database.DirectTradeDeliveryState{OperationID: id, OfferPayload: `{"gold":3,"items":[]}`}})
			}
			before, prior := w.GetEntityCopy(a.ID), w.DirectTrades[trade.ID].copy()
			if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 10); err == nil || !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) || !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) {
				t.Fatal("invalid private state mutated live custody")
			}
		})
	}
}

func TestDirectTradeDurableEscrowCannotUseRAMRefundOrSettlement(t *testing.T) {
	w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1})
	if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 5); err != nil {
		t.Fatal(err)
	}
	beforeA, beforeB, prior := w.GetEntityCopy(a.ID), w.GetEntityCopy(b.ID), w.DirectTrades[trade.ID].copy()
	if _, err := w.SetDirectTradeOffer(a.ID, trade.ID, nil, 0); err == nil {
		t.Fatal("RAM edit accepted private escrow")
	}
	if _, err := w.SetDirectTradeOffer(b.ID, trade.ID, nil, 10); err == nil {
		t.Fatal("RAM-only peer offer mixed with private escrow")
	}
	if _, _, err := w.ConfirmDirectTrade(b.ID, trade.ID); err == nil {
		t.Fatal("RAM settlement accepted private escrow")
	}
	if _, err := w.CancelDirectTrade(b.ID, trade.ID); err == nil || w.CancelDirectTradesForPlayer(b.ID) != nil {
		t.Fatal("RAM cancellation refunded private escrow")
	}
	if !reflect.DeepEqual(w.GetEntityCopy(a.ID), beforeA) || !reflect.DeepEqual(w.GetEntityCopy(b.ID), beforeB) || !reflect.DeepEqual(w.DirectTrades[trade.ID].copy(), prior) {
		t.Fatal("denied legacy path changed custody or confirmations")
	}
	w.deleteTradeLocked(w.DirectTrades[trade.ID]) // Model loss of only the RAM table.
	if _, err := w.StartDirectTrade(a.ID, b.ID); err == nil {
		t.Fatal("unresolved persisted escrow reused as a fresh trade")
	}
}

func TestDirectTradeDurableSettlementCancellationGiftAndClaimReplay(t *testing.T) {
	for _, decision := range []string{database.DirectTradeSettle, database.DirectTradeCancel} {
		t.Run(decision, func(t *testing.T) {
			item := Item{ID: "earned", Name: "Blade", Stack: 1, MaxStack: 1, Potency: 5, Stats: map[string]int{"damage": 23},
				Gems: []SocketedGem{{Stats: map[string]int{"wisdom": 7}}}, ForgeBasis: &forging.Basis{Level: 61, Stats: map[string]int{"damage": 17}}}
			w, a, b, trade := durableTradeFixture(t, item)
			trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 5)
			if err != nil {
				t.Fatal(err)
			}
			op := durableTradePlan(t, trade, a, b, decision) // Gift recipient has no private state.
			if decision == database.DirectTradeCancel {
				// Either participant may reconstruct a cancellation after restart.
				op.Participants[0], op.Participants[1] = op.Participants[1], op.Participants[0]
				if err := op.Validate(); err != nil {
					t.Fatal("participant order changed the economic plan", err)
				}
			}
			if _, err := w.RetireDurableDirectTrade(op); err == nil {
				t.Fatal("pending shared decision retired as complete")
			}
			for _, player := range []*Entity{a, b} {
				beforeGold, beforeBag := player.Gold, cloneItems(player.Inventory)
				found, changed, err := w.ApplyDurableDirectTradeDecision(player.ID, op)
				if !found || !changed || err != nil || player.Gold != beforeGold || !reflect.DeepEqual(player.Inventory, beforeBag) {
					t.Fatal("participant decision changed visible currency/bag or failed", err)
				}
			}
			// The coordinator must prove both durable saves before supplying this
			// terminal record. This game-layer test does not simulate that proof.
			op.State = database.DirectTradeComplete
			if retired, err := w.RetireDurableDirectTrade(op); err != nil || retired == nil || len(w.DirectTrades) != 0 {
				t.Fatal("completed ephemeral table was not removed without refunds", err)
			}
			for _, player := range []*Entity{a, b} {
				if _, _, err := w.ClaimDurableDirectTradeDelivery(player.ID); err != nil {
					t.Fatal(err)
				}
			}
			receiver, sender := b, a
			if decision == database.DirectTradeCancel {
				receiver, sender = a, b
			}
			if receiver.Inventory[0].ID != item.ID || !reflect.DeepEqual(receiver.Inventory[0], item) || (receiver.Gold != 105 && decision == database.DirectTradeSettle) || (receiver.Gold != 100 && decision == database.DirectTradeCancel) ||
				sender.Inventory[0].ID != "" || a.Gold+b.Gold != 200 || a.EP != 11 || b.EP != 19 {
				t.Fatal("owned delivery did not transfer/refund exact resources")
			}
			op.State = database.DirectTradePending
			for _, player := range []*Entity{a, b} {
				before := w.GetEntityCopy(player.ID)
				for attempt := 0; attempt < 3; attempt++ {
					if _, changed, err := w.ApplyDurableDirectTradeDecision(player.ID, op); changed || err != nil {
						t.Fatal("post-claim decision replay applied twice", err)
					}
					if _, changed, err := w.ClaimDurableDirectTradeDelivery(player.ID); changed || err != nil || !reflect.DeepEqual(w.GetEntityCopy(player.ID), before) {
						t.Fatal("post-claim replay granted resources twice", err)
					}
				}
			}
		})
	}
}

func jsonToBSONTradeState(version int) ([]byte, error) {
	// Encode rejects a future version, so assemble its reader fixture as BSON.
	return bson.Marshal(bson.M{"version": version, "revision": 1})
}

func TestDirectTradeDurableDeliveryFailureRetainsWholeOutbox(t *testing.T) {
	for _, outcome := range []string{"full bag", "wallet overflow", "duplicate bag", "duplicate stash", "future item", "revision overflow", "partial stack"} {
		t.Run(outcome, func(t *testing.T) {
			item := Item{ID: "earned", Name: "Shard", Stack: 4, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
			w, a, b, trade := durableTradeFixture(t, item)
			trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 5)
			if err != nil {
				t.Fatal(err)
			}
			op := durableTradePlan(t, trade, a, b, database.DirectTradeSettle)
			if _, _, err := w.ApplyDurableDirectTradeDecision(b.ID, op); err != nil {
				t.Fatal(err)
			}
			state, _ := database.DecodeDirectTradeState(b.DirectTradeState)
			switch outcome {
			case "full bag", "partial stack":
				for index := range b.Inventory {
					b.Inventory[index] = Item{ID: fmt.Sprintf("filled-%d", index), Name: "Filled", Stack: 1, MaxStack: 1}
				}
				if outcome == "partial stack" {
					b.Inventory[0] = cloneItem(item)
					b.Inventory[0].ID, b.Inventory[0].Stack = "partial", 9
				}
			case "wallet overflow":
				b.Gold = math.MaxInt
			case "duplicate bag":
				b.Inventory[0] = cloneItem(item)
			case "duplicate stash":
				b.Stash = []Item{cloneItem(item)}
			case "future item":
				state.Delivery.OfferPayload = strings.Replace(state.Delivery.OfferPayload, `"id":"earned"`, `"id":"earned","futureAppearance":{"skin":"new"}`, 1)
			case "revision overflow":
				state.Revision = math.MaxInt64
			}
			b.DirectTradeState, err = database.EncodeDirectTradeState(*state)
			if err != nil {
				t.Fatal(err)
			}
			before := w.GetEntityCopy(b.ID)
			if _, changed, err := w.ClaimDurableDirectTradeDelivery(b.ID); changed || err == nil || !reflect.DeepEqual(w.GetEntityCopy(b.ID), before) {
				t.Fatal("failed delivery partially changed bag, Gold, revision or outbox", err)
			}
			if !bytes.Equal(b.DirectTradeState, before.DirectTradeState) || a.Gold != 95 {
				t.Fatal("failed claim lost outbox or compensated sender")
			}
		})
	}
}

func TestDirectTradeDurableDeliveryStacksOnlyExactMetadata(t *testing.T) {
	for _, same := range []bool{true, false} {
		t.Run(fmt.Sprint(same), func(t *testing.T) {
			item := Item{ID: "incoming", Name: "Shard", Stack: 4, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
			w, a, b, trade := durableTradeFixture(t, item)
			trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 0)
			if err != nil {
				t.Fatal(err)
			}
			b.Inventory[0] = cloneItem(item)
			b.Inventory[0].ID, b.Inventory[0].Stack = "existing", 9
			if !same {
				b.Inventory[0].Stats["wisdom"] = 7
			}
			op := durableTradePlan(t, trade, a, b, database.DirectTradeSettle)
			if _, _, err := w.ApplyDurableDirectTradeDecision(b.ID, op); err != nil {
				t.Fatal(err)
			}
			if _, changed, err := w.ClaimDurableDirectTradeDelivery(b.ID); !changed || err != nil {
				t.Fatal(err)
			}
			wantExisting, wantIncoming := 9, 4
			if same {
				wantExisting, wantIncoming = 10, 3
			}
			if b.Inventory[0].Stack != wantExisting || b.Inventory[1].ID != item.ID || b.Inventory[1].Stack != wantIncoming || b.Inventory[1].Stats["wisdom"] != 2 {
				t.Fatal("stacking altered affixes or lost item quantity")
			}
		})
	}
}

func TestDirectTradeDurableOfferReturnDoesNotEraseDifferentAffixes(t *testing.T) {
	for _, same := range []bool{true, false} {
		t.Run(fmt.Sprint(same), func(t *testing.T) {
			item := Item{ID: "escrowed", Name: "Shard", Stack: 4, MaxStack: 10, Stats: map[string]int{"wisdom": 2}}
			w, a, _, trade := durableTradeFixture(t, item)
			if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{item.ID}, 5); err != nil {
				t.Fatal(err)
			}
			fillTradeBagByPickup(t, w, a)
			a.Inventory[0] = cloneItem(item)
			a.Inventory[0].ID, a.Inventory[0].Stack = "retained", 6
			if !same {
				a.Inventory[0].Stats["wisdom"] = 7
			}
			before := w.GetEntityCopy(a.ID)
			result, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, nil, 0)
			if same {
				if err != nil || result == nil || a.Inventory[0].Stack != 10 || a.Gold != 100 || len(result.OfferA.Items) != 0 {
					t.Fatal("exact compatible stack cannot receive deselected escrow", err)
				}
			} else if err == nil || result != nil || !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) {
				t.Fatal("deselected escrow erased different affixes or escaped custody", err)
			}
		})
	}
}

func TestDirectTradeDurablePeerBindingCannotBeReassigned(t *testing.T) {
	for _, route := range []string{"decision", "offer"} {
		t.Run(route, func(t *testing.T) {
			w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Earned", Stack: 1, MaxStack: 1})
			trade, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 5)
			if err != nil {
				t.Fatal(err)
			}
			op := durableTradePlan(t, trade, a, b, database.DirectTradeSettle)
			if route == "offer" {
				state, _ := database.DecodeDirectTradeState(a.DirectTradeState)
				state.Escrow.PeerUsername, state.Escrow.PeerPlayerID, state.Escrow.PeerCharacterName = "mallory", "player-mallory", "mallory"
				a.DirectTradeState, err = database.EncodeDirectTradeState(*state)
				if err != nil {
					t.Fatal(err)
				}
			}
			before := w.GetEntityCopy(a.ID)
			if route == "decision" {
				op.Participants[1].Username, op.Participants[1].PlayerID, op.Participants[1].CharacterName = "mallory", "player-mallory", "mallory"
				op.Fingerprint, _ = database.DirectTradeOperationFingerprint(op)
				if _, changed, err := w.ApplyDurableDirectTradeDecision(a.ID, op); changed || err == nil {
					t.Fatal("frozen decision redirected an owner's saved escrow")
				}
			} else if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 5); err == nil {
				t.Fatal("offer replay reassigned the saved peer identity")
			}
			if !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) {
				t.Fatal("peer conflict changed owned custody")
			}
		})
	}
}

func TestDirectTradeDurableOfferRequiresAvailableNearbyPeer(t *testing.T) {
	for _, route := range []string{"offline", "scene", "distance", "casino", "wrong character"} {
		t.Run(route, func(t *testing.T) {
			w, a, b, trade := durableTradeFixture(t, Item{ID: "earned", Name: "Earned", Stack: 1, MaxStack: 1})
			switch route {
			case "offline":
				b.Disconnected = true
			case "scene":
				b.InstanceID = "another-instance"
			case "distance":
				b.X = 20
			case "casino":
				b.CasinoSeat = &CasinoSeatSession{}
			case "wrong character":
				b.Name = "different"
			}
			before := w.GetEntityCopy(a.ID)
			if _, err := w.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned"}, 5); err == nil || !reflect.DeepEqual(w.GetEntityCopy(a.ID), before) {
				t.Fatal("unavailable peer accepted a debit", err)
			}
		})
	}
}
