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

func vendorPersistenceFixture(t *testing.T) (*Client, *testCharacterCommitter, string) {
	t.Helper()
	dir, committer := setupCharacterJournalTest(t)
	oldDB := db
	db = nil
	t.Cleanup(func() { db = oldDB })
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	c := newLevelCommandClient()
	p := newLevelCommandPlayer(c.playerID)
	p.Name, p.Gold = c.username, 1000
	p.Inventory = []game.Item{{ID: "earned", Name: "Earned blade", Value: 125, Stack: 1,
		Rarity: game.RarityLegendary, Potency: 4, Stats: map[string]int{"strength": 9}}}
	world.AddEntity(p)
	return c, committer, dir
}

func vendorRequest(kind string) Message {
	payload, _ := json.Marshal(SellPayload{ItemID: "earned"})
	return Message{Type: kind, Payload: payload}
}

// Models the existing atomic save-receipt contract and an ambiguous commit
// reply. The separate Mongo integration checks certify the real store API.
type vendorReceiptCommitter struct {
	delegate *testCharacterCommitter
	c        *Client
	loseAck  bool
	applied  int
}

func (store *vendorReceiptCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if len(store.c.send) != 0 {
		return errors.New("vendor acknowledged before the save barrier")
	}
	if store.delegate.saved != nil && store.delegate.saved.LastSaveID == id {
		return nil
	}
	if err := store.delegate.CommitCharacterSave(username, character, id); err != nil {
		return err
	}
	store.delegate.saved.LastSaveID = id
	store.applied++
	if store.loseAck {
		store.loseAck = false
		return errors.New("commit applied, reply lost")
	}
	return nil
}

func TestVendorConfirmedSavePrecedesBothRepliesAndReplayDoesNotResettle(t *testing.T) {
	c, committer, _ := vendorPersistenceFixture(t)
	store := &vendorReceiptCommitter{delegate: committer, c: c}
	characterSaveCommitter = store
	for _, kind := range []string{MsgSell, MsgBuyback} {
		c.handleMessage(vendorRequest(kind))
		messages := drainSentMessages(c.send)
		if len(messages) != 2 || messages[0].Type != MsgInventory || messages[1].Type != MsgBuybackList {
			t.Fatal("vendor did not publish both views after its confirmed save", messages)
		}
		wantGold := 1125
		if kind == MsgBuyback {
			wantGold = 1000
		}
		if committer.saved == nil || committer.saved.Gold != wantGold {
			t.Fatal("vendor reply did not have a confirmed complete Gold/item save")
		}
		if pending, err := characterSaveJournal.Read(c.username); err != nil || pending != nil {
			t.Fatal("confirmed vendor save retained an unacknowledged intent", err)
		}
		beforeApplied := store.applied
		c.handleMessage(vendorRequest(kind))
		messages = drainSentMessages(c.send)
		if len(messages) != 3 || messages[0].Type != MsgError || store.applied != beforeApplied || committer.saved.Gold != wantGold {
			t.Fatal("replayed vendor request re-settled or did not resynchronize custody")
		}
	}
	if store.applied != 2 || committer.saved.Inventory[0].ID != "earned" || committer.saved.Inventory[0].Potency != 4 || committer.saved.Inventory[0].Stats["strength"] != 9 || len(committer.saved.Buyback) != 0 {
		t.Fatal("vendor round trip changed complete earned gear or settlement count")
	}
}

func TestVendorFailedOrUnknownCommitRecoversCompleteSnapshotAfterReopen(t *testing.T) {
	for _, tc := range []struct {
		kind    string
		lostAck bool
	}{
		{MsgSell, false}, {MsgSell, true}, {MsgBuyback, false}, {MsgBuyback, true},
	} {
		lostAck := tc.lostAck
		name := tc.kind + " database rejected"
		if lostAck {
			name = tc.kind + " commit reply lost"
		}
		t.Run(name, func(t *testing.T) {
			c, committer, dir := vendorPersistenceFixture(t)
			if tc.kind == MsgBuyback {
				p := world.Entities[c.playerID]
				p.Buyback = append(p.Buyback, p.Inventory[0])
				p.Inventory = []game.Item{{}}
			}
			store := &vendorReceiptCommitter{delegate: committer, c: c, loseAck: lostAck}
			characterSaveCommitter = store
			if !lostAck {
				committer.fail = errors.New("database unavailable")
			}
			c.handleMessage(vendorRequest(tc.kind))
			messages := drainSentMessages(c.send)
			if len(messages) != 3 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "Vendor save pending") {
				t.Fatal("unconfirmed vendor effect did not report pending before current custody views")
			}
			pending, err := characterSaveJournal.Read(c.username)
			if err != nil || pending == nil {
				t.Fatal("vendor post-image was not durably journaled", err)
			}
			if !lostAck {
				before := world.GetEntityCopy(c.playerID)
				inverse := MsgBuyback
				if tc.kind == MsgBuyback {
					inverse = MsgSell
				}
				c.handleMessage(vendorRequest(inverse))
				messages = drainSentMessages(c.send)
				after := world.GetEntityCopy(c.playerID)
				if len(messages) != 1 || messages[0].Type != MsgError || before.Gold != after.Gold || !reflect.DeepEqual(before.Inventory, after.Inventory) || !reflect.DeepEqual(before.Buyback, after.Buyback) {
					t.Fatal("pending failed save admitted another vendor mutation")
				}
			}
			if lostAck {
				// A newer independent durable Gold credit must survive replay of
				// the already applied save ID; it is not another vendor payout.
				committer.saved.Gold += 7
			}
			world = nil // Drop every live copy, then reopen the actual journal.
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			committer.fail = nil
			failedCharacterSaves.users = map[string]bool{}
			if err := retryPendingCharacterSaves(); err != nil {
				t.Fatal(err)
			}
			wantGold := 1125
			if tc.kind == MsgBuyback {
				wantGold = 875
			}
			if lostAck {
				wantGold += 7
			}
			if store.applied != 1 || committer.saved.Gold != wantGold {
				t.Fatal("restart recovery repeated Gold, lost gear, or replaced a newer credit")
			}
			if tc.kind == MsgSell && (len(committer.saved.Inventory) != 0 || len(committer.saved.Buyback) != 1 || committer.saved.Buyback[0].ID != "earned" || committer.saved.Buyback[0].Potency != 4) {
				t.Fatal("sale recovery did not preserve gear exclusively in buyback")
			}
			if tc.kind == MsgBuyback && (len(committer.saved.Inventory) != 1 || committer.saved.Inventory[0].ID != "earned" || committer.saved.Inventory[0].Potency != 4 || len(committer.saved.Buyback) != 0) {
				t.Fatal("buyback recovery did not preserve gear exclusively in inventory")
			}
			if err := retryPendingCharacterSaves(); err != nil || store.applied != 1 || committer.saved.Gold != wantGold {
				t.Fatal("completed recovery replay changed settlement", err)
			}
		})
	}
}

func TestVendorLocalWriteFailurePinsLatestCopyUntilRetry(t *testing.T) {
	c, committer, dir := vendorPersistenceFixture(t)
	p := world.GetEntityCopy(c.playerID)
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	c.handleMessage(vendorRequest(MsgSell))
	messages := drainSentMessages(c.send)
	if len(messages) != 3 || messages[0].Type != MsgError || len(committer.ids) != 0 {
		t.Fatal("local journal failure tried Mongo or claimed completion")
	}
	world.SetEntityDisconnected(c.playerID, time.Now().Add(-10*time.Minute))
	if expired := world.CollectExpiredDisconnectedPlayers(5 * time.Minute); len(expired) != 0 {
		t.Fatal("unjournaled vendor post-image expired")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	if _, ok := world.ClearEntityDisconnected(c.playerID); !ok {
		t.Fatal("pinned character could not reconnect")
	}
	c.handleMessage(vendorRequest(MsgSell))
	messages = drainSentMessages(c.send)
	if len(messages) != 3 || messages[0].Type != MsgError || committer.saved == nil || committer.saved.Gold != p.Gold+125 || len(committer.saved.Buyback) != 1 {
		t.Fatal("retry failed to settle the latest copy once and resynchronize the original request")
	}
	if report := world.Economy.Drain(time.Now()); report.SourceTotal != 125 {
		t.Fatal("pending sale was applied twice")
	}
}

func TestVendorUnavailablePersistenceOrActiveTradeDoesNotMutate(t *testing.T) {
	for _, trade := range []bool{false, true} {
		t.Run(map[bool]string{false: "no persistence", true: "RAM trade active"}[trade], func(t *testing.T) {
			c, committer, _ := vendorPersistenceFixture(t)
			before := world.GetEntityCopy(c.playerID)
			if trade {
				peer := newLevelCommandPlayer("player-vendor-peer")
				world.AddEntity(peer)
				if _, err := world.StartDirectTrade(c.playerID, peer.ID); err != nil {
					t.Fatal(err)
				}
			} else {
				characterSaveJournal = nil
			}
			c.handleMessage(vendorRequest(MsgSell))
			messages := drainSentMessages(c.send)
			after := world.GetEntityCopy(c.playerID)
			if len(messages) != 1 || messages[0].Type != MsgError || after.Gold != before.Gold || !reflect.DeepEqual(before.Inventory, after.Inventory) || !reflect.DeepEqual(before.Buyback, after.Buyback) || len(committer.ids) != 0 {
				t.Fatal("unavailable vendor changed or saved a wallet/item")
			}
		})
	}
}
