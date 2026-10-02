package database

import (
	"bytes"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

const tradeOfferA = `{"gold":17,"items":[{"id":"earned-blade","stack":1,"maxStack":1,"stats":{"strength":19},"gems":[{"stats":{"damage":7}}],"forgeBasis":{"futureExactBasis":13},"futureAppearance":{"weave":"blue"}}]}`
const tradeOfferB = `{"gold":29,"items":[{"id":"earned-shards","stack":5,"maxStack":25,"icon":"shard","futureAffix":{"seed":719}}]}`
const tradeEmptyOffer = `{"gold":0,"items":[]}`

func directTradeFixture(t *testing.T, decision string) (DirectTradeOperation, [2]*Character) {
	t.Helper()
	op := DirectTradeOperation{Version: 1, TradeID: "trade-server-generated-1", Decision: decision,
		State: DirectTradePending, CreatedAt: time.Unix(1_800_000_000, 0).UTC(),
		Participants: [2]DirectTradeParticipant{
			{Username: "alice", PlayerID: "player-alice", CharacterName: "alice", ExpectedRevision: 4, OfferPayload: tradeOfferA},
			{Username: "bob", PlayerID: "player-bob", CharacterName: "bob", ExpectedRevision: 9, OfferPayload: tradeOfferB},
		}}
	op.ID = DirectTradeOperationID(op.TradeID)
	op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
	var characters [2]*Character
	for i, participant := range op.Participants {
		state, err := EncodeDirectTradeState(DirectTradeCharacterState{Version: 1, Revision: participant.ExpectedRevision,
			Escrow: &DirectTradeEscrowState{TradeID: op.TradeID, OfferPayload: participant.OfferPayload}})
		if err != nil {
			t.Fatal(err)
		}
		characters[i] = &Character{Name: participant.CharacterName, Level: 73, Gold: 1000 + i, EP: 37,
			DirectTradeState: state, Inventory: []Item{{ID: "unrelated", Stack: 1, Stats: map[string]int{"wisdom": 9}}},
			Stash: []Item{{ID: "stashed"}}, ItemDeliveryReceipts: map[string]string{"previous": "receipt"}}
	}
	return op, characters
}

func cloneTradeCharacter(t *testing.T, original *Character) *Character {
	t.Helper()
	encoded, err := bson.Marshal(original)
	if err != nil {
		t.Fatal(err)
	}
	var copy Character
	if err := bson.Unmarshal(encoded, &copy); err != nil {
		t.Fatal(err)
	}
	return &copy
}

func TestDirectTradeFingerprintBindsAccountCustodyNotParticipantArrayOrder(t *testing.T) {
	op, _ := directTradeFixture(t, DirectTradeCancel)
	reversed := op
	reversed.Participants[0], reversed.Participants[1] = reversed.Participants[1], reversed.Participants[0]
	if err := reversed.Validate(); err != nil {
		t.Fatal("the same account-bound plan reconstructed by the peer conflicted", err)
	}
	// Sorting identities must not detach their offers or expected revisions.
	reversed.Participants[0].OfferPayload, reversed.Participants[1].OfferPayload = reversed.Participants[1].OfferPayload, reversed.Participants[0].OfferPayload
	if err := reversed.Validate(); err == nil {
		t.Fatal("participant ordering normalization reassigned offered custody")
	}
}

func TestDirectTradeDecisionPartialParticipantSaveReplayAndExactMetadata(t *testing.T) {
	for _, decision := range []string{DirectTradeSettle, DirectTradeCancel} {
		t.Run(decision, func(t *testing.T) {
			op, characters := directTradeFixture(t, decision)
			for index, character := range characters {
				before := cloneTradeCharacter(t, character)
				changed, err := ApplyDirectTradeCharacterDecision(op.Participants[index].Username, character, op)
				if err != nil || !changed {
					t.Fatal("valid frozen decision rejected", err)
				}
				state, err := DecodeDirectTradeState(character.DirectTradeState)
				if err != nil {
					t.Fatal(err)
				}
				wantPayload := op.Participants[index].OfferPayload
				if decision == DirectTradeSettle {
					wantPayload = op.Participants[1-index].OfferPayload
				}
				if state.Escrow != nil || state.Delivery == nil || state.Delivery.OfferPayload != wantPayload || state.Delivery.OperationID != op.ID || state.LastOperationFingerprint != op.Fingerprint || state.Revision != op.Participants[index].ExpectedRevision+1 {
					t.Fatal("participant did not consume escrow into its exact owned delivery and receipt")
				}
				before.DirectTradeState = character.DirectTradeState
				if !reflect.DeepEqual(before, character) {
					t.Fatal("trade recovery changed unrelated Gold, EP, gear or progression")
				}
				// Drop all typed state, as after one saved side and a restart. A
				// replay must recognize the durable receipt, not grant twice.
				characters[index] = cloneTradeCharacter(t, character)
				saved := CloneDirectTradeState(characters[index].DirectTradeState)
				for replay := 0; replay < 3; replay++ {
					changed, err = ApplyDirectTradeCharacterDecision(op.Participants[index].Username, characters[index], op)
					if err != nil || changed || !bytes.Equal(saved, characters[index].DirectTradeState) {
						t.Fatal("saved participant replay changed delivery", err)
					}
				}
			}
		})
	}
}

func TestDirectTradeEmptyRecipientAndFullBagKeepOwnedRecoveryDelivery(t *testing.T) {
	op, characters := directTradeFixture(t, DirectTradeSettle)
	op.Participants[1].ExpectedRevision, op.Participants[1].OfferPayload = 0, tradeEmptyOffer
	op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
	characters[1].DirectTradeState = nil
	characters[1].Gold = math.MaxInt
	characters[1].Inventory = make([]Item, MaxDirectTradeOfferItems)
	for i := range characters[1].Inventory {
		characters[1].Inventory[i] = Item{ID: "existing", Stack: 1}
	}
	for index, character := range characters {
		before := cloneTradeCharacter(t, character)
		if changed, err := ApplyDirectTradeCharacterDecision(op.Participants[index].Username, character, op); err != nil || !changed {
			t.Fatal(err)
		}
		state, _ := DecodeDirectTradeState(character.DirectTradeState)
		if index == 0 && state.Delivery != nil {
			t.Fatal("gift sender was refunded after settlement")
		}
		if index == 1 && (state.Delivery == nil || state.Delivery.OfferPayload != tradeOfferA) {
			t.Fatal("full bag lost incoming gear or Gold")
		}
		before.DirectTradeState = character.DirectTradeState
		if !reflect.DeepEqual(before, character) {
			t.Fatal("owned delivery bypassed capacity or overflowed the visible wallet")
		}
	}
}

func TestDirectTradeDecisionRejectsConflictBeforeAnyCharacterMutation(t *testing.T) {
	for _, name := range []string{"wrong account", "wrong character", "changed offer", "stale revision", "different trade", "same ID changed plan", "already complete", "unknown state format", "extra state field", "duplicate state field", "prior delivery"} {
		t.Run(name, func(t *testing.T) {
			op, characters := directTradeFixture(t, DirectTradeSettle)
			character, username := characters[0], "alice"
			state, _ := DecodeDirectTradeState(character.DirectTradeState)
			switch name {
			case "wrong account":
				username = "mallory"
			case "wrong character":
				character.Name = "another character"
			case "changed offer":
				state.Escrow.OfferPayload = tradeOfferB
			case "stale revision":
				state.Revision++
			case "different trade":
				state.Escrow.TradeID = "different-trade"
			case "same ID changed plan":
				if _, err := ApplyDirectTradeCharacterDecision(username, character, op); err != nil {
					t.Fatal(err)
				}
				op.Decision = DirectTradeCancel
				op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
			case "already complete":
				op.State = DirectTradeComplete
			case "unknown state format":
				character.DirectTradeState, _ = bson.Marshal(bson.D{{Key: "version", Value: 9}, {Key: "revision", Value: 4}})
			case "extra state field", "duplicate state field":
				var document bson.D
				if err := bson.Unmarshal(character.DirectTradeState, &document); err != nil {
					t.Fatal(err)
				}
				key := "future_state"
				if name == "duplicate state field" {
					key = "revision"
				}
				document = append(document, bson.E{Key: key, Value: 4})
				character.DirectTradeState, _ = bson.Marshal(document)
			case "prior delivery":
				state.Escrow = nil
				state.LastOperationID, state.LastOperationFingerprint, state.LastOperationRevision = DirectTradeOperationID("earlier-trade"), strings.Repeat("a", 64), 4
				state.Delivery = &DirectTradeDeliveryState{OperationID: state.LastOperationID, OfferPayload: tradeOfferA}
				op.Participants[0].OfferPayload = tradeEmptyOffer
				op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
			}
			if name == "changed offer" || name == "stale revision" || name == "different trade" || name == "prior delivery" {
				var err error
				character.DirectTradeState, err = EncodeDirectTradeState(*state)
				if err != nil {
					t.Fatal(err)
				}
			}
			before := cloneTradeCharacter(t, character)
			changed, err := ApplyDirectTradeCharacterDecision(username, character, op)
			if err == nil || changed || !reflect.DeepEqual(before, character) {
				t.Fatal("invalid decision changed the character")
			}
		})
	}
}

func TestDirectTradeDecisionRejectsInvalidIntentShape(t *testing.T) {
	for _, name := range []string{"self", "wrong player binding", "wrong identity", "negative revision", "overflow revision", "changed fingerprint", "negative Gold", "too much Gold", "floating Gold", "null offer", "EP offer", "duplicate own ID", "duplicate across offers", "personal quest item", "negative stack", "overfilled stack", "too many items", "oversized payload", "invalid UTF8", "gold only"} {
		t.Run(name, func(t *testing.T) {
			op, _ := directTradeFixture(t, DirectTradeSettle)
			switch name {
			case "self":
				op.Participants[1] = op.Participants[0]
			case "wrong player binding":
				op.Participants[0].PlayerID = "player-mallory"
			case "wrong identity":
				op.ID = DirectTradeOperationID("another")
			case "negative revision":
				op.Participants[0].ExpectedRevision = -1
			case "overflow revision":
				op.Participants[0].ExpectedRevision = math.MaxInt64
			case "negative Gold":
				op.Participants[0].OfferPayload = `{"gold":-1}`
			case "too much Gold":
				op.Participants[0].OfferPayload = `{"gold":100001}`
			case "floating Gold":
				op.Participants[0].OfferPayload = `{"gold":0.5}`
			case "null offer":
				op.Participants[0].OfferPayload = `null`
			case "EP offer":
				op.Participants[0].OfferPayload = `{"items":[],"gold":0,"ep":100}`
			case "duplicate own ID":
				op.Participants[0].OfferPayload = `{"items":[{"id":"x"},{"id":"x"}]}`
			case "duplicate across offers":
				op.Participants[1].OfferPayload = tradeOfferA
			case "personal quest item":
				op.Participants[0].OfferPayload = `{"items":[{"id":"chronicle-item-fragment"}]}`
			case "negative stack":
				op.Participants[0].OfferPayload = `{"items":[{"id":"x","stack":-1}]}`
			case "overfilled stack":
				op.Participants[0].OfferPayload = `{"items":[{"id":"x","stack":2,"maxStack":1}]}`
			case "too many items":
				items := []string{}
				for i := 0; i <= MaxDirectTradeOfferItems; i++ {
					items = append(items, `{"id":"item-`+strings.Repeat("x", i+1)+`"}`)
				}
				op.Participants[0].OfferPayload = `{"items":[` + strings.Join(items, ",") + `]}`
			case "oversized payload":
				op.Participants[0].OfferPayload = strings.Repeat(" ", MaxDirectTradeOfferBytes) + tradeOfferA
			case "invalid UTF8":
				op.Participants[0].OfferPayload = "{\"items\":[{\"id\":\"\xff\"}]}"
			case "gold only":
				op.Participants[0].OfferPayload, op.Participants[1].OfferPayload = `{"gold":17}`, `{"gold":29}`
			}
			op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
			if name == "changed fingerprint" {
				op.Fingerprint = strings.Repeat("0", 64)
			}
			if err := op.Validate(); err == nil {
				t.Fatal("invalid intent accepted")
			}
		})
	}
}

func TestDirectTradeStateEmptyLegacyAndFingerprintExcludeOnlyRecoveryFields(t *testing.T) {
	state, err := DecodeDirectTradeState(nil)
	if err != nil || state.Version != 1 || state.Revision != 0 || state.Escrow != nil || state.Delivery != nil {
		t.Fatal("legacy account invented trade state", err)
	}
	op, _ := directTradeFixture(t, DirectTradeSettle)
	before := op.Fingerprint
	op.CreatedAt = op.CreatedAt.Add(time.Hour)
	op.State = DirectTradeComplete
	if after, err := DirectTradeOperationFingerprint(op); err != nil || after != before || op.Validate() != nil {
		t.Fatal("retry timestamp/outcome changed the frozen plan", err)
	}
	for _, decision := range []string{DirectTradeSettle, DirectTradeCancel} {
		op.Decision = decision
		fingerprint, _ := DirectTradeOperationFingerprint(op)
		if (fingerprint == before) != (decision == DirectTradeSettle) {
			t.Fatal("decision not bound to fingerprint")
		}
	}
}
