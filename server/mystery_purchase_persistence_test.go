package main

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func mysteryPurchaseFixture(t *testing.T) (*Client, *testCharacterCommitter, *vendorReceiptCommitter, string) {
	t.Helper()
	c, saved, dir := vendorPersistenceFixture(t)
	p := world.Entities[c.playerID]
	p.Level = 1
	// The real bag is fixed-size; unlike sell/buyback, AddItemToInventory
	// requires actual empty slots instead of extending a compact save slice.
	bag := make([]game.Item, game.MaxInventorySize)
	copy(bag, p.Inventory)
	p.Inventory = bag
	store := &vendorReceiptCommitter{delegate: saved, c: c}
	characterSaveCommitter = store
	return c, saved, store, dir
}

func mysteryPurchaseRequest() Message {
	payload, _ := json.Marshal(BuyGamblePayload{Slot: "mainHand"})
	return Message{Type: MsgBuyGamble, Payload: payload}
}

func TestMysteryPurchaseConfirmsOriginalItemAndGoldBeforeInventory(t *testing.T) {
	c, saved, store, _ := mysteryPurchaseFixture(t)
	c.handleMessage(mysteryPurchaseRequest())
	messages := drainSentMessages(c.send)
	if store.applied != 1 || saved.saved == nil || saved.saved.Gold != 965 || len(saved.saved.Inventory) != 2 ||
		len(messages) != 1 || messages[0].Type != MsgInventory {
		t.Fatalf("random purchase replied before saving complete original item and Gold: applied=%d saved=%+v replies=%+v", store.applied, saved.saved, messages)
	}
	if saved.saved.Inventory[0].ID != "earned" || saved.saved.Inventory[0].Potency != 4 ||
		saved.saved.Inventory[1].ID == "" || saved.saved.Inventory[1].Slot != "mainHand" {
		t.Fatal("purchase changed existing gear or lost original generated item")
	}
	if pending, err := characterSaveJournal.Read(c.username); err != nil || pending != nil {
		t.Fatal("confirmed purchase retained pending save", err)
	}
}

func TestMysteryPurchaseFailedOrLostCommitRetainsOriginalRollAcrossReopen(t *testing.T) {
	for _, lostAck := range []bool{false, true} {
		t.Run(map[bool]string{false: "rejected", true: "reply-lost"}[lostAck], func(t *testing.T) {
			c, saved, store, dir := mysteryPurchaseFixture(t)
			store.loseAck = lostAck
			if !lostAck {
				saved.fail = errors.New("synthetic database outage")
			}
			c.handleMessage(mysteryPurchaseRequest())
			messages := drainSentMessages(c.send)
			if len(messages) != 1 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "Mystery purchase save pending") {
				t.Fatal("uncertain purchase published a random result or durable success")
			}
			pending, err := characterSaveJournal.Read(c.username)
			if err != nil || pending == nil {
				t.Fatal("original random item and debit not journaled", err)
			}
			original, err := pending.Character()
			if err != nil || original.Gold != 965 || len(original.Inventory) != 2 {
				t.Fatal("incomplete purchase post-image", err)
			}
			if !lostAck {
				before := world.GetEntityCopy(c.playerID)
				c.handleMessage(mysteryPurchaseRequest())
				after := world.GetEntityCopy(c.playerID)
				messages = drainSentMessages(c.send)
				if len(messages) != 1 || messages[0].Type != MsgError || before.Gold != after.Gold || !reflect.DeepEqual(before.Inventory, after.Inventory) {
					t.Fatal("unresolved save allowed another paid random roll")
				}
			}
			world = nil // lose live copies, then reopen the real private journal
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			saved.fail = nil
			if lostAck {
				saved.saved.Gold += 7 // a newer independent credit must survive receipt replay
			}
			if err := retryPendingCharacterSaves(); err != nil {
				t.Fatal(err)
			}
			wantGold := 965
			if lostAck {
				wantGold += 7
			}
			if store.applied != 1 || saved.saved.Gold != wantGold || !reflect.DeepEqual(original.Inventory, saved.saved.Inventory) {
				t.Fatal("recovery rerolled the item, repeated debit or erased newer credit")
			}
			if err := retryPendingCharacterSaves(); err != nil || store.applied != 1 {
				t.Fatal("completed purchase recovery applied twice", err)
			}
		})
	}
}

func TestMysteryPurchaseRecoveredCommandDoesNotBuyAnotherBox(t *testing.T) {
	c, saved, store, _ := mysteryPurchaseFixture(t)
	saved.fail = errors.New("synthetic database outage")
	c.handleMessage(mysteryPurchaseRequest())
	drainSentMessages(c.send)
	original := world.GetEntityCopy(c.playerID)
	saved.fail = nil
	c.handleMessage(mysteryPurchaseRequest())
	messages := drainSentMessages(c.send)
	after := world.GetEntityCopy(c.playerID)
	if len(messages) != 2 || messages[0].Type != MsgError || messages[1].Type != MsgInventory ||
		!strings.Contains(string(messages[0].Payload), "No new mystery item") || store.applied != 1 ||
		after.Gold != original.Gold || !reflect.DeepEqual(after.Inventory, original.Inventory) {
		t.Fatal("save recovery also charged for a second mystery purchase")
	}
	c.handleMessage(mysteryPurchaseRequest()) // a fresh, deliberate click is another purchase
	messages = drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgInventory || store.applied != 2 || saved.saved.Gold != 930 || len(saved.saved.Inventory) != 3 {
		t.Fatal("recovery poisoned future deliberate purchases")
	}
}

func TestMysteryPurchaseLocalWriteFailurePinsOriginalRollAndDoesNotReroll(t *testing.T) {
	c, saved, store, dir := mysteryPurchaseFixture(t)
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	c.handleMessage(mysteryPurchaseRequest())
	messages := drainSentMessages(c.send)
	original := world.GetEntityCopy(c.playerID)
	if len(messages) != 1 || messages[0].Type != MsgError || len(saved.ids) != 0 {
		t.Fatal("failed local write attempted Mongo or published the roll")
	}
	world.SetEntityDisconnected(c.playerID, time.Now().Add(-10*time.Minute))
	if expired := world.CollectExpiredDisconnectedPlayers(5 * time.Minute); len(expired) != 0 {
		t.Fatal("unjournaled original purchase expired")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	world.ClearEntityDisconnected(c.playerID)
	c.handleMessage(mysteryPurchaseRequest())
	messages = drainSentMessages(c.send)
	after := world.GetEntityCopy(c.playerID)
	if store.applied != 1 || len(messages) != 2 || messages[0].Type != MsgError || messages[1].Type != MsgInventory ||
		after.Gold != original.Gold || !reflect.DeepEqual(after.Inventory, original.Inventory) {
		t.Fatal("local write recovery lost or replaced the original roll/debit")
	}
}

func TestMysteryPurchaseUnavailableConditionsDoNotSpendOrSave(t *testing.T) {
	for _, condition := range []string{"no-persistence", "trade", "invalid-slot", "material", "relic", "full-bag", "zero-level", "negative-level", "oversized-level", "insufficient-gold"} {
		t.Run(condition, func(t *testing.T) {
			c, saved, _, _ := mysteryPurchaseFixture(t)
			p := world.Entities[c.playerID]
			request := mysteryPurchaseRequest()
			switch condition {
			case "no-persistence":
				characterSaveJournal = nil
			case "trade":
				world.TradeByPlayer[c.playerID] = "synthetic-active-review"
			case "invalid-slot":
				request.Payload = json.RawMessage(`{"slot":"ep-wallet"}`)
			case "material", "relic":
				request.Payload, _ = json.Marshal(BuyGamblePayload{Slot: condition})
			case "full-bag":
				p.Inventory = make([]game.Item, game.MaxInventorySize)
				for i := range p.Inventory {
					p.Inventory[i] = game.Item{ID: "occupied"}
				}
			case "zero-level":
				p.Level = 0
			case "negative-level":
				p.Level = -1
			case "oversized-level":
				p.Level = game.MaxPlayerLevel + 1
			case "insufficient-gold":
				p.Gold = 34
			}
			before := world.GetEntityCopy(c.playerID)
			c.handleMessage(request)
			after := world.GetEntityCopy(c.playerID)
			messages := drainSentMessages(c.send)
			if len(messages) != 1 || messages[0].Type != MsgError || len(saved.ids) != 0 ||
				after.Gold != before.Gold || after.Level != before.Level || !reflect.DeepEqual(before.Inventory, after.Inventory) {
				t.Fatal("unavailable purchase changed saved/live value or reported an item")
			}
		})
	}
}
