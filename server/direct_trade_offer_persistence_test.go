package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func tradeOfferPersistenceFixture(t *testing.T) (*Client, *testCharacterCommitter, string, *game.DirectTrade) {
	t.Helper()
	c, committer, dir := vendorPersistenceFixture(t)
	player := world.GetEntityCopy(c.playerID)
	world.AddEntity(&game.Entity{ID: "player-trade-peer", Name: "trade-peer", Type: game.TypePlayer,
		X: player.X + 1, Z: player.Z, Gold: 100, Inventory: make([]game.Item, game.MaxInventorySize)})
	trade, err := world.StartDirectTrade(c.playerID, "player-trade-peer")
	if err != nil {
		t.Fatal(err)
	}
	return c, committer, dir, trade
}

func assertSavedTradeOffer(t *testing.T, character *database.Character, tradeID string) {
	t.Helper()
	if character == nil || character.Gold != 993 || len(character.Inventory) != 0 {
		t.Fatal("saved offer did not own the complete bag/Gold debit", character)
	}
	state, err := database.DecodeDirectTradeState(character.DirectTradeState)
	if err != nil || state.Revision != 1 || state.Escrow == nil || state.Escrow.TradeID != tradeID || state.Delivery != nil ||
		state.Escrow.PeerUsername != "trade-peer" || state.Escrow.PeerPlayerID != "player-trade-peer" || state.Escrow.PeerCharacterName != "trade-peer" {
		t.Fatal("saved debit did not include its private escrow", state, err)
	}
	var offer game.DirectTradeOffer
	if err := json.Unmarshal([]byte(state.Escrow.OfferPayload), &offer); err != nil || offer.Gold != 7 || len(offer.Items) != 1 || offer.Items[0].ID != "earned" || offer.Items[0].Potency != 4 || offer.Items[0].Stats["strength"] != 9 {
		t.Fatal("saved escrow changed earned gear", offer, err)
	}
}

func TestDirectTradeOfferSaveBarrierAndRepeatedOfferDoNotDoubleDebit(t *testing.T) {
	c, committer, _, trade := tradeOfferPersistenceFixture(t)
	for attempt := 0; attempt < 3; attempt++ {
		result, err := setAndSaveDirectTradeOfferLocked(c.username, c.playerID, trade.ID, []string{"earned"}, 7)
		if err != nil || result == nil || result.OfferA.Gold != 7 || len(c.send) != 0 {
			t.Fatal("offer barrier failed or emitted an early reply", result, err)
		}
		assertSavedTradeOffer(t, committer.saved, trade.ID)
		if pending, err := characterSaveJournal.Read(c.username); err != nil || pending != nil {
			t.Fatal("confirmed offer retained a pending save", err)
		}
	}
}

func TestDirectTradeOfferUnknownCommitReopensExactEscrowBeforeStaleHydration(t *testing.T) {
	for _, lostAck := range []bool{false, true} {
		t.Run(fmt.Sprint(lostAck), func(t *testing.T) {
			c, committer, dir, trade := tradeOfferPersistenceFixture(t)
			var store *vendorReceiptCommitter
			if lostAck {
				store = &vendorReceiptCommitter{delegate: committer, c: c, loseAck: true}
				characterSaveCommitter = store
			} else {
				committer.fail = errors.New("database rejected")
			}
			if result, err := setAndSaveDirectTradeOfferLocked(c.username, c.playerID, trade.ID, []string{"earned"}, 7); err == nil || result != nil || len(c.send) != 0 {
				t.Fatal("unknown offer save acknowledged as completed", result, err)
			}
			pending, err := characterSaveJournal.Read(c.username)
			if err != nil || pending == nil {
				t.Fatal("failed/unknown save lost complete escrow recovery", err)
			}
			character, err := pending.Character()
			if err != nil {
				t.Fatal(err)
			}
			assertSavedTradeOffer(t, character, trade.ID)
			world.StopBackground()
			world = nil // Drop all RAM offers and entities, not just the socket.
			failedCharacterSaves.users = make(map[string]bool)
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			if lostAck {
				committer.saved.Gold += 13 // Later independent durable credit.
			} else {
				committer.fail = nil
			}
			if err := reconcilePendingCharacterSaveLocked(c.username); err != nil {
				t.Fatal(err)
			}
			if lostAck {
				if store.applied != 1 || committer.saved.Gold != 1006 || !bytes.Equal(committer.saved.DirectTradeState, character.DirectTradeState) {
					t.Fatal("lost-ACK replay resettled or replaced later credit")
				}
			} else {
				assertSavedTradeOffer(t, committer.saved, trade.ID)
			}
		})
	}
}

func TestDirectTradeOfferPreflightFailureAndMissingPersistenceDenyMutation(t *testing.T) {
	for _, unavailable := range []string{"journal", "committer", "pending save", "account binding"} {
		t.Run(unavailable, func(t *testing.T) {
			c, committer, _, trade := tradeOfferPersistenceFixture(t)
			username := c.username
			switch unavailable {
			case "journal":
				characterSaveJournal = nil
			case "committer":
				characterSaveCommitter = nil
			case "pending save":
				committer.fail = errors.New("outage")
				if err := persistCharacterSnapshot(c.username, characterSnapshotForSave(c.username, world.GetEntityCopy(c.playerID))); err == nil {
					t.Fatal("fixture save should be pending")
				}
			case "account binding":
				username = "other"
			}
			before := world.GetEntityCopy(c.playerID)
			if result, err := setAndSaveDirectTradeOfferLocked(username, c.playerID, trade.ID, []string{"earned"}, 7); result != nil || err == nil || !reflect.DeepEqual(world.GetEntityCopy(c.playerID), before) {
				t.Fatal("unavailable persistence/binding allowed a new debit", result, err)
			}
		})
	}
}

func TestDirectTradeOfferLocalJournalFailurePinsEscrowWithoutDatabaseIO(t *testing.T) {
	c, committer, dir, trade := tradeOfferPersistenceFixture(t)
	if err := os.Rename(dir, dir+".offline"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Rename(dir+".offline", dir) })
	if result, err := setAndSaveDirectTradeOfferLocked(c.username, c.playerID, trade.ID, []string{"earned"}, 7); result != nil || err == nil {
		t.Fatal("local write failure acknowledged an offer", result, err)
	}
	player := world.GetEntityCopy(c.playerID)
	if player == nil || player.Gold != 993 || len(committer.ids) != 0 || len(c.send) != 0 {
		t.Fatal("local write failure lost/persisted/acknowledged unjournaled custody")
	}
	// Detached public/persistence copies intentionally omit the sweep pin.
	// Exercise actual expiry instead of asserting that internal flag on a copy.
	world.SetEntityDisconnected(c.playerID, time.Now().Add(-time.Hour))
	if expired := world.CollectExpiredDisconnectedPlayers(15 * time.Minute); len(expired) != 0 || world.GetEntityCopy(c.playerID) == nil {
		t.Fatal("local write failure let expiry remove the only escrow copy")
	}
	if err := os.Rename(dir+".offline", dir); err != nil {
		t.Fatal(err)
	}
	if err := reconcilePendingCharacterSaveLocked(c.username); err != nil {
		t.Fatal(err)
	}
	assertSavedTradeOffer(t, committer.saved, trade.ID)
}
