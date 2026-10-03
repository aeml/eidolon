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

var forgeTransactionKinds = []string{MsgForgeUpgrade, MsgForgePotency, MsgForgeSocket, MsgForgeInsertGem, MsgForgeCombineGem, MsgForgeRemoveGem}

func forgePersistenceFixture(t *testing.T) (*Client, *testCharacterCommitter, string) {
	t.Helper()
	c, committer, dir := vendorPersistenceFixture(t)
	p := world.Entities[c.playerID]
	p.Level = 100
	p.Equipment = map[string]game.Item{"mainHand": {ID: "earned-staff", Level: 30,
		Value: 300, Rarity: game.RarityRare, Sockets: 2, Stats: map[string]int{"damage": 30, "intelligence": 8}}}
	gem := game.GenerateGem(game.GemRuby, game.GemChipped)
	gem.Stack = 4
	p.Inventory = []game.Item{{ID: "earned-shards", Name: "Eidolon Shard", Stack: 2000},
		{ID: "earned-hearts", Name: "Eidolon Heart", Stack: 100}, *gem}
	return c, committer, dir
}

func forgeTransactionRequest(c *Client, kind string) Message {
	p := world.GetEntityCopy(c.playerID)
	item := p.Equipment["mainHand"]
	quote := &game.ForgeQuote{ItemID: item.ID, Level: item.Level, Potency: item.Potency,
		Sockets: item.Sockets, Gems: item.Gems}
	if kind == MsgForgeInsertGem || kind == MsgForgeCombineGem {
		quote.GemIDs, quote.GemCounts = []string{p.Inventory[2].ID}, []int{p.Inventory[2].Stack}
		if kind == MsgForgeCombineGem {
			quote.GemIDs = []string{p.Inventory[2].ID, p.Inventory[2].ID, p.Inventory[2].ID}
			quote.GemCounts = []int{p.Inventory[2].Stack, p.Inventory[2].Stack, p.Inventory[2].Stack}
		}
	}
	payload, _ := json.Marshal(map[string]any{"slot": "mainHand", "amount": 1,
		"equipSlot": "mainHand", "gemInvIndex": 2, "socketIndex": 0,
		"gemIndices": [3]int{2, 2, 2}, "expected": quote})
	return Message{Type: kind, Payload: payload}
}

func prepareForgeRemoval(c *Client, kind string) {
	if kind != MsgForgeRemoveGem {
		return
	}
	p := world.Entities[c.playerID]
	item := p.Equipment["mainHand"]
	item.Gems = []game.SocketedGem{{Type: game.GemRuby, Quality: game.GemChipped, Stats: map[string]int{"strength": 1}},
		{Type: game.GemSapphire, Quality: game.GemFlawed, Stats: map[string]int{"intelligence": 2}}}
	p.Equipment["mainHand"] = item
}

// Storage reply loss is modeled here; the real durable save-receipt API is
// covered by the existing character-commit Mongo checks. The local BSON
// journal, reopening, command admission and Forge actions are real.
type forgeReceiptCommitter struct {
	delegate *testCharacterCommitter
	client   *Client
	loseAck  bool
	applied  int
}

func (store *forgeReceiptCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if len(store.client.send) != 0 {
		return errors.New("Forge sent a reply before its save barrier")
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
		return errors.New("applied Forge save, acknowledgement lost")
	}
	return nil
}

func TestForgeTransactionsSaveBeforeReplyAndQuoteReplayDoesNotSpend(t *testing.T) {
	for _, kind := range forgeTransactionKinds {
		t.Run(kind, func(t *testing.T) {
			c, committer, _ := forgePersistenceFixture(t)
			prepareForgeRemoval(c, kind)
			store := &forgeReceiptCommitter{delegate: committer, client: c}
			characterSaveCommitter = store
			request := forgeTransactionRequest(c, kind)
			c.handleMessage(request)
			messages := drainSentMessages(c.send)
			if len(messages) != 1 || messages[0].Type != MsgInventory || store.applied != 1 {
				t.Fatal("Forge did not confirm one complete save before publishing the bag", messages)
			}
			post := characterSnapshotForSave(c.username, world.GetEntityCopy(c.playerID))
			if !reflect.DeepEqual(committer.saved.Inventory, post.Inventory) || !reflect.DeepEqual(committer.saved.Equipment, post.Equipment) || committer.saved.Gold != post.Gold {
				t.Fatal("saved Forge item/material custody differs from the visible post-image")
			}
			if pending, err := characterSaveJournal.Read(c.username); err != nil || pending != nil {
				t.Fatal("confirmed Forge save retained an unacknowledged journal", err)
			}
			before := world.GetEntityCopy(c.playerID)
			c.handleMessage(request)
			messages = drainSentMessages(c.send)
			after := world.GetEntityCopy(c.playerID)
			if len(messages) != 1 || messages[0].Type != MsgError || store.applied != 1 || !reflect.DeepEqual(before.Inventory, after.Inventory) || !reflect.DeepEqual(before.Equipment, after.Equipment) {
				t.Fatal("old Forge quote spent materials, changed an item or resettled")
			}
		})
	}
}

func TestForgeTransactionsRejectedOrUnknownSaveRecoverExactPostImageAfterReopen(t *testing.T) {
	for _, kind := range forgeTransactionKinds {
		for _, lostAck := range []bool{false, true} {
			name := kind + map[bool]string{false: "/rejected", true: "/lost-ack"}[lostAck]
			t.Run(name, func(t *testing.T) {
				c, committer, dir := forgePersistenceFixture(t)
				prepareForgeRemoval(c, kind)
				store := &forgeReceiptCommitter{delegate: committer, client: c, loseAck: lostAck}
				characterSaveCommitter = store
				if !lostAck {
					committer.fail = errors.New("storage unavailable")
				}
				c.handleMessage(forgeTransactionRequest(c, kind))
				messages := drainSentMessages(c.send)
				if len(messages) != 2 || messages[0].Type != MsgError || !strings.Contains(string(messages[0].Payload), "Forge save pending") || messages[1].Type != MsgInventory {
					t.Fatal("unconfirmed Forge save reported success instead of pending custody", messages)
				}
				pending, err := characterSaveJournal.Read(c.username)
				if err != nil || pending == nil {
					t.Fatal("changed equipment/material debit was not journaled", err)
				}
				post := characterSnapshotForSave(c.username, world.GetEntityCopy(c.playerID))
				if !lostAck {
					before := world.GetEntityCopy(c.playerID)
					c.handleMessage(forgeTransactionRequest(c, MsgForgeUpgrade))
					messages = drainSentMessages(c.send)
					after := world.GetEntityCopy(c.playerID)
					if len(messages) != 1 || messages[0].Type != MsgError || !reflect.DeepEqual(before.Inventory, after.Inventory) || !reflect.DeepEqual(before.Equipment, after.Equipment) {
						t.Fatal("failed previous save admitted another Forge purchase")
					}
				} else {
					committer.saved.Gold += 7 // A later independent durable credit.
				}
				world = nil // Lose live copies, then reopen the real disk journal.
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				committer.fail = nil
				failedCharacterSaves.users = map[string]bool{}
				if err := retryPendingCharacterSaves(); err != nil {
					t.Fatal(err)
				}
				wantGold := post.Gold
				if lostAck {
					wantGold += 7
				}
				if store.applied != 1 || committer.saved.Gold != wantGold || !reflect.DeepEqual(committer.saved.Inventory, post.Inventory) || !reflect.DeepEqual(committer.saved.Equipment, post.Equipment) {
					t.Fatal("recovery changed earned gear, spent twice or replaced a newer credit")
				}
				if err := retryPendingCharacterSaves(); err != nil || store.applied != 1 {
					t.Fatal("completed Forge recovery was applied twice", err)
				}
			})
		}
	}
}

func TestForgeLocalJournalFailurePinsLatestGearAndRetryDoesNotSpendAgain(t *testing.T) {
	c, committer, dir := forgePersistenceFixture(t)
	request := forgeTransactionRequest(c, MsgForgeUpgrade)
	if err := os.Rename(dir, dir+"-held"); err != nil {
		t.Fatal(err)
	}
	c.handleMessage(request)
	messages := drainSentMessages(c.send)
	if len(messages) != 2 || messages[0].Type != MsgError || len(committer.ids) != 0 {
		t.Fatal("failed journal write acknowledged or attempted a database commit")
	}
	post := world.GetEntityCopy(c.playerID)
	world.SetEntityDisconnected(c.playerID, time.Now().Add(-10*time.Minute))
	if expired := world.CollectExpiredDisconnectedPlayers(5 * time.Minute); len(expired) != 0 {
		t.Fatal("latest unjournaled Forge copy expired")
	}
	if err := os.Rename(dir+"-held", dir); err != nil {
		t.Fatal(err)
	}
	world.ClearEntityDisconnected(c.playerID)
	c.handleMessage(request)
	messages = drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgError || committer.saved == nil || committer.saved.Equipment["mainHand"].Level != post.Equipment["mainHand"].Level || !reflect.DeepEqual(world.GetEntityCopy(c.playerID).Inventory, post.Inventory) {
		t.Fatal("retry failed to save the pinned Forge effect once and reject its old quote")
	}
}

func TestForgeMissingQuoteUnavailablePersistenceOrTradeDoesNotMutate(t *testing.T) {
	for _, mode := range []string{"quote", "journal", "committer", "trade"} {
		t.Run(mode, func(t *testing.T) {
			c, committer, _ := forgePersistenceFixture(t)
			request := forgeTransactionRequest(c, MsgForgeUpgrade)
			switch mode {
			case "quote":
				request.Payload = json.RawMessage(`{"slot":"mainHand","amount":1}`)
			case "journal":
				characterSaveJournal = nil
			case "committer":
				characterSaveCommitter = nil
			case "trade":
				peer := newLevelCommandPlayer("player-forge-peer")
				world.AddEntity(peer)
				if _, err := world.StartDirectTrade(c.playerID, peer.ID); err != nil {
					t.Fatal(err)
				}
			}
			before := world.GetEntityCopy(c.playerID)
			c.handleMessage(request)
			messages := drainSentMessages(c.send)
			after := world.GetEntityCopy(c.playerID)
			if len(messages) != 1 || messages[0].Type != MsgError || len(committer.ids) != 0 || !reflect.DeepEqual(before.Inventory, after.Inventory) || !reflect.DeepEqual(before.Equipment, after.Equipment) {
				t.Fatal("unavailable Forge mutated or saved materials/equipment", messages)
			}
		})
	}
}
