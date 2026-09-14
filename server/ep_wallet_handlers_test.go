package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

const epHandlerID = "01234567-89ab-4cde-8fab-0123456789ab"

type epFailAfterPreflight struct {
	calls    int
	delegate *testCharacterCommitter
}

func (f *epFailAfterPreflight) CommitCharacterSave(username string, character *database.Character, id string) error {
	f.calls++
	if f.calls > 1 {
		return errors.New("database unavailable after exchange")
	}
	return f.delegate.CommitCharacterSave(username, character, id)
}

func epWalletFixture(t *testing.T) (*Client, *testCharacterCommitter, string) {
	t.Helper()
	dir, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Fighter", Level: 30, Z: 200,
		Health: 10, Mana: 3, Gold: 3_000_000, BaseStats: game.Stats{Vitality: 10, Intelligence: 10}}
	world.AddEntity(p)
	return &Client{username: "hero", playerID: p.ID, send: make(chan []byte, 10)}, committer, dir
}

func readEPResult(t *testing.T, c *Client) struct {
	Success, Pending bool
	EP, Gold         int
	ID               string
} {
	t.Helper()
	var result struct {
		Success, Pending bool
		EP, Gold         int
		ID               string
	}
	select {
	case data := <-c.send:
		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil || msg.Type != MsgEPWalletResult {
			t.Fatal("missing wallet result", string(data), err)
		}
		if err := json.Unmarshal(msg.Payload, &result); err != nil {
			t.Fatal(err)
		}
	default:
		t.Fatal("wallet response not sent")
	}
	return result
}

func epRequest() Message {
	return Message{Type: MsgExchangeGoldForEP, Payload: json.RawMessage(`{"id":"` + epHandlerID + `","amount":2,"confirmed":true}`)}
}

func TestEPWalletSavesDebitCreditAndReceiptTogether(t *testing.T) {
	c, committer, _ := epWalletFixture(t)
	c.handleEPWallet(epRequest())
	result := readEPResult(t, c)
	if !result.Success || result.Pending || result.EP != 2 || result.Gold != 1_000_000 || result.ID != epHandlerID {
		t.Fatal("wrong exchange acknowledgement", result)
	}
	if committer.saved == nil || committer.saved.Gold != result.Gold || committer.saved.EP != result.EP || committer.saved.EPExchangeReceipts[epHandlerID] != 2 {
		t.Fatal("acknowledged without atomic saved currencies/receipt")
	}
	// Mongo encoding and journal snapshots must preserve the new fields.
	encoded, err := bson.Marshal(committer.saved)
	if err != nil {
		t.Fatal(err)
	}
	var restored database.Character
	if err := bson.Unmarshal(encoded, &restored); err != nil || restored.EP != 2 || restored.EPExchangeReceipts[epHandlerID] != 2 {
		t.Fatal("wallet did not survive storage encoding", err)
	}
	c.handleEPWallet(epRequest())
	if replay := readEPResult(t, c); replay != result {
		t.Fatal("retry charged again or lost acknowledgement", replay)
	}
	c.handleEPWallet(Message{Type: MsgGetEPWallet})
	if read := readEPResult(t, c); read.EP != 2 || read.Gold != 1_000_000 {
		t.Fatal("wallet read omitted balances", read)
	}
}

func TestEPWalletDatabaseFailureRecoversWithoutDoubleCharge(t *testing.T) {
	c, committer, dir := epWalletFixture(t)
	characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
	c.handleEPWallet(epRequest())
	if result := readEPResult(t, c); result.Success || !result.Pending {
		t.Fatal("failure falsely acknowledged", result)
	}
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil {
		t.Fatal("exchange lost durable journal", err)
	}
	world = nil // Restart without the live in-memory character.
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	failedCharacterSaves.users = make(map[string]bool)
	characterSaveCommitter = committer
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.Gold != 1_000_000 || committer.saved.EP != 2 || committer.saved.EPExchangeReceipts[epHandlerID] != 2 {
		t.Fatal("recovery split currency transaction")
	}
	if applied, err := database.ApplyEPExchange(&committer.saved.Gold, &committer.saved.EP, &committer.saved.EPExchangeReceipts, epHandlerID, 2); err != nil || applied {
		t.Fatal("post-restart retry double charged", err)
	}
}

func TestEPWalletRejectsUnconfirmedFractionalReverseAndUnauthenticatedRequests(t *testing.T) {
	for _, payload := range []string{
		`{"id":"` + epHandlerID + `","amount":1,"confirmed":false}`,
		`{"id":"` + epHandlerID + `","amount":1.5,"confirmed":true}`,
		`{"id":"` + epHandlerID + `","amount":-1,"confirmed":true}`,
	} {
		c, committer, _ := epWalletFixture(t)
		c.handleEPWallet(Message{Type: MsgExchangeGoldForEP, Payload: json.RawMessage(payload)})
		p := world.GetEntityCopy(c.playerID)
		if p.Gold != 3_000_000 || p.EP != 0 || (committer.saved != nil && (committer.saved.Gold != 3_000_000 || committer.saved.EP != 0)) {
			t.Fatal("invalid request changed wallet")
		}
	}
	c := &Client{}
	if err := c.acceptInboundMessage(epRequest(), time.Now()); err == nil {
		t.Fatal("unauthenticated exchange admitted")
	}
	c.username, c.playerID = "hero", "player-hero"
	if err := c.acceptInboundMessage(Message{Type: "exchange_ep_for_gold"}, time.Now()); err == nil {
		t.Fatal("reverse exchange exposed")
	}
}
