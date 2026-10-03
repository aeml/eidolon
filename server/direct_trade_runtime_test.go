package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/lifecycle"
)

func directTradeRuntimeClients(t *testing.T, op database.DirectTradeOperation) (*Client, *Client) {
	t.Helper()
	sessionsMu.Lock()
	previous := activeSessions
	activeSessions = make(map[string]*Client)
	sessionsMu.Unlock()
	t.Cleanup(func() {
		sessionsMu.Lock()
		activeSessions = previous
		sessionsMu.Unlock()
	})
	var clients [2]*Client
	for index, participant := range op.Participants {
		client := newLevelCommandClient()
		client.username, client.playerID = participant.Username, participant.PlayerID
		client.send = make(chan []byte, 256)
		clients[index] = client
		sessionsMu.Lock()
		activeSessions[client.username] = client
		sessionsMu.Unlock()
	}
	return clients[0], clients[1]
}

func tradeActionMessage(action, tradeID string) Message {
	payload, _ := json.Marshal(TradeActionPayload{TradeID: tradeID})
	return Message{Type: action, Payload: payload}
}

func tradeTerminalMessage(t *testing.T, client *Client, kind string) map[string]json.RawMessage {
	t.Helper()
	for _, msg := range drainSentMessages(client.send) {
		if msg.Type == kind {
			var payload map[string]json.RawMessage
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				t.Fatal(err)
			}
			return payload
		}
	}
	t.Fatalf("missing %s terminal message", kind)
	return nil
}

func TestDirectTradeRuntimeHandlersSettleAndCancelThroughAdmission(t *testing.T) {
	for _, action := range []string{MsgTradeConfirm, MsgTradeCancel} {
		t.Run(action, func(t *testing.T) {
			store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
			a, b := directTradeRuntimeClients(t, op)
			a.handleMessage(tradeActionMessage(action, op.TradeID))
			wantKind, wantGold, wantItem := MsgTradeComplete, 1012, "earned-robe"
			if action == MsgTradeCancel {
				wantKind, wantGold, wantItem = MsgTradeCancel, 1000, "earned-blade"
			}
			for _, client := range []*Client{a, b} {
				payload := tradeTerminalMessage(t, client, wantKind)
				if string(payload["deliveryPending"]) != "false" {
					t.Fatal("confirmed delivery reported pending")
				}
			}
			if store.characters[a.username].Gold != wantGold || store.characters[a.username].Inventory[0].ID != wantItem ||
				store.characters[a.username].Gold+store.characters[b.username].Gold != 2000 || len(world.DirectTrades) != 0 {
				t.Fatal("registered handlers bypassed durable settlement/refund or lost value")
			}
			for _, client := range []*Client{a, b} {
				state, err := database.DecodeDirectTradeState(store.characters[client.username].DirectTradeState)
				if err != nil || state.Escrow != nil || state.Delivery != nil || state.LastOperationID != op.ID {
					t.Fatal("handler acknowledged without saved complete custody", err)
				}
			}
		})
	}
}

func TestDirectTradeRuntimeLostDecisionAckCannotBeChangedByCancel(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
	a, b := directTradeRuntimeClients(t, op)
	store.failPrepareAfter = true
	a.handleMessage(tradeActionMessage(MsgTradeConfirm, op.TradeID))
	for _, client := range []*Client{a, b} {
		for _, message := range drainSentMessages(client.send) {
			if message.Type == MsgTradeComplete || message.Type == MsgTradeCancel {
				t.Fatal("unknown decision acknowledged as complete")
			}
		}
	}
	if _, found := pendingDirectTradeForAccount(b.username); !found {
		t.Fatal("unknown prepare did not fence both accounts")
	}
	b.handleMessage(tradeActionMessage(MsgTradeCancel, op.TradeID))
	tradeTerminalMessage(t, a, MsgTradeComplete)
	tradeTerminalMessage(t, b, MsgTradeComplete)
	if store.operations[op.ID].Decision != database.DirectTradeSettle || len(store.operations) != 1 ||
		store.characters[a.username].Gold != 1012 || store.characters[b.username].Gold != 988 {
		t.Fatal("cancellation replaced the first decision after a lost acknowledgement")
	}
}

func TestDirectTradeRuntimeRetainedDeliveryAllowsBagChangeAndRetry(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
	a, _ := directTradeRuntimeClients(t, op)
	player := world.GetEntity(a.playerID)
	player.Mu.Lock()
	player.Inventory = make([]game.Item, game.MaxInventorySize)
	for index := range player.Inventory {
		player.Inventory[index] = game.Item{ID: fmt.Sprintf("resident-%d", index), Name: "Resident", Stack: 1, MaxStack: 1, Value: 1}
	}
	player.Mu.Unlock()
	// A reward filled the bag after the accepted/frozen confirmation. The
	// coordinator owns the delivery instead of reversing the other side.
	completed, err := completeTradeTestLocked(op)
	if err != nil {
		t.Fatal(err)
	}
	unlock := lockCharactersWork(a.username, op.Participants[1].Username)
	err = finishDirectTradeDeliveryLocked(*completed)
	unlock()
	if err != nil || string(tradeTerminalMessage(t, a, MsgTradeComplete)["deliveryPending"]) != "true" {
		t.Fatal("full bag did not retain a clearly reported complete delivery", err)
	}
	before := store.characters[a.username].Gold
	payload, _ := json.Marshal(SellPayload{ItemID: "resident-0"})
	a.handleMessage(Message{Type: MsgSell, Payload: payload})
	state, err := database.DecodeDirectTradeState(store.characters[a.username].DirectTradeState)
	if err != nil || state.Delivery != nil || store.characters[a.username].Gold != before+1+29 {
		t.Fatal("selling to free room did not journal and claim the retained delivery", err)
	}
	count := 0
	for _, item := range store.characters[a.username].Inventory {
		if item.ID == "earned-robe" {
			count++
		}
	}
	if count != 1 {
		t.Fatal("retained delivery was lost or granted more than once", count)
	}
}

func TestDirectTradeRuntimeColdRecoveryFindsOrphanAndKeepsFrozenSettlement(t *testing.T) {
	for _, frozen := range []bool{false, true} {
		t.Run(fmt.Sprint(frozen), func(t *testing.T) {
			store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
			if frozen {
				store.operations[op.ID] = op
			}
			unlock, accounts, err := lockDirectTradeWork(true, op.Participants[1].Username)
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Contains(accounts, op.Participants[0].Username) {
				unlock()
				t.Fatal("cold recovery did not acquire its saved peer")
			}
			err = recoverColdAccountDirectTradeLocked(op.Participants[1].Username)
			unlock()
			if err != nil {
				t.Fatal(err)
			}
			wantDecision, wantGold := database.DirectTradeCancel, 1000
			if frozen {
				wantDecision, wantGold = database.DirectTradeSettle, 1012
			}
			if len(store.operations) != 1 || store.operations[op.ID].Decision != wantDecision || store.operations[op.ID].State != database.DirectTradeComplete ||
				store.characters[op.Participants[0].Username].Gold != wantGold {
				t.Fatal("orphan recovery guessed a refund or ignored a frozen settlement")
			}
		})
	}
}

func TestDirectTradeRuntimeOrphanRecoveryRejectsMispairedSavedPeer(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
	peer := store.characters[op.Participants[1].Username]
	state, _ := database.DecodeDirectTradeState(peer.DirectTradeState)
	state.Escrow.TradeID = "other-trade"
	peer.DirectTradeState, _ = database.EncodeDirectTradeState(*state)
	beforeA, beforeB := cloneTradeRecoveryCharacter(store.characters[op.Participants[0].Username]), cloneTradeRecoveryCharacter(peer)
	unlock, _, err := lockDirectTradeWork(true, op.Participants[0].Username)
	if err != nil {
		t.Fatal(err)
	}
	err = recoverColdAccountDirectTradeLocked(op.Participants[0].Username)
	unlock()
	if err == nil || len(store.operations) != 0 || !reflect.DeepEqual(store.characters[op.Participants[0].Username], beforeA) || !reflect.DeepEqual(peer, beforeB) {
		t.Fatal("mispaired orphan custody was guessed or refunded")
	}
}

func TestDirectTradeRuntimeHotAdmissionDoesNotReadDatabase(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
	reads := store.reads
	for _, account := range []string{op.Participants[0].Username, "unrelated"} {
		unlock, accounts, err := lockDirectTradeWork(false, account)
		if err != nil {
			t.Fatal(err)
		}
		unlock()
		if store.reads != reads || (account != "unrelated" && len(accounts) != 2) || (account == "unrelated" && len(accounts) != 1) {
			t.Fatal("ordinary admission queried storage or used the wrong lock set")
		}
	}
}

func TestDirectTradeRuntimeDisconnectSavesBothRefundsBeforeRetirement(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeCancel, true)
	a, b := directTradeRuntimeClients(t, op)
	// This financial fixture has no social database. Exclude unrelated friend
	// notification workers instead of changing production presence behavior.
	previousBackground := backgroundCharacterWork
	backgroundCharacterWork = &lifecycle.Group{}
	backgroundCharacterWork.CloseAndWait()
	t.Cleanup(func() { backgroundCharacterWork = previousBackground })
	a.markTransportClosed()
	cleanupClient(a)
	state, err := database.DecodeDirectTradeState(store.characters[a.username].DirectTradeState)
	if err != nil || state.Escrow != nil || state.Delivery != nil || store.characters[a.username].Gold != 1000 ||
		store.characters[b.username].Gold != 1000 || world.GetActiveDirectTrade(a.playerID) != nil || !a.retired.Load() {
		t.Fatal("disconnect retired with an unsaved one-sided refund", err)
	}
	entity := world.GetEntity(a.playerID)
	entity.Mu.RLock()
	disconnected := entity.Disconnected
	entity.Mu.RUnlock()
	if !disconnected || getClientByUsername(a.username) != nil {
		t.Fatal("trade cleanup did not preserve normal disconnect ownership")
	}
	tradeTerminalMessage(t, b, MsgTradeCancel)
}

func TestDirectTradeRuntimeColdDiscoveryIncludesPendingJournalPeer(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeCancel, false)
	username, peer := op.Participants[0].Username, op.Participants[1].Username
	latest := cloneTradeRecoveryCharacter(store.characters[username])
	if _, err := characterSaveJournal.Write(username, latest); err != nil {
		t.Fatal(err)
	}
	// Database is stale; the complete pending offer journal is the only current
	// source of peer discovery. No pre-authentication recovery effect is allowed.
	store.characters[username].DirectTradeState = nil
	before := cloneTradeRecoveryCharacter(store.characters[username])
	unlock, accounts, err := lockDirectTradeWork(true, username)
	if err != nil {
		t.Fatal(err)
	}
	unlock()
	if !slices.Contains(accounts, peer) || !reflect.DeepEqual(before, store.characters[username]) || len(store.operations) != 0 {
		t.Fatal("cold discovery missed journal custody or wrote before authentication")
	}
}

func TestDirectTradeRuntimeStartupDrainsMoreThanOnePage(t *testing.T) {
	store, template, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
	originals := [2]*database.Character{cloneTradeRecoveryCharacter(store.characters[template.Participants[0].Username]), cloneTradeRecoveryCharacter(store.characters[template.Participants[1].Username])}
	store.characters = make(map[string]*database.Character)
	for index := 0; index < 51; index++ {
		op := template
		op.TradeID = fmt.Sprintf("startup-page-%d", index)
		op.ID = database.DirectTradeOperationID(op.TradeID)
		for participant := range op.Participants {
			name := fmt.Sprintf("page-%d-player-%d", index, participant)
			op.Participants[participant].Username, op.Participants[participant].CharacterName, op.Participants[participant].PlayerID = name, name, "player-"+name
		}
		for participant, identity := range op.Participants {
			character := cloneTradeRecoveryCharacter(originals[participant])
			character.Name = identity.Username
			state, _ := database.DecodeDirectTradeState(character.DirectTradeState)
			state.Escrow.TradeID = op.TradeID
			peer := op.Participants[1-participant]
			state.Escrow.PeerUsername, state.Escrow.PeerCharacterName, state.Escrow.PeerPlayerID = peer.Username, peer.CharacterName, peer.PlayerID
			character.DirectTradeState, _ = database.EncodeDirectTradeState(*state)
			store.characters[identity.Username] = character
		}
		op.Fingerprint, _ = database.DirectTradeOperationFingerprint(op)
		store.operations[op.ID] = op
	}
	if err := recoverDirectTradesOnStartup(); err != nil {
		t.Fatal(err)
	}
	for _, op := range store.operations {
		if op.State != database.DirectTradeComplete {
			t.Fatal("startup admitted before draining later pages")
		}
		for _, participant := range op.Participants {
			state, err := database.DecodeDirectTradeState(store.characters[participant.Username].DirectTradeState)
			if err != nil || state.Escrow != nil || state.Delivery != nil || store.writes[participant.Username] != 2 {
				t.Fatal("paged startup lost or replayed participant custody", err)
			}
		}
	}
}

func TestDirectTradeRuntimeStartupAndUnknownPrepareRetry(t *testing.T) {
	for _, unknown := range []bool{false, true} {
		t.Run(fmt.Sprint(unknown), func(t *testing.T) {
			store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
			if unknown {
				store.failPrepareBefore = true
				if _, err := completeTradeTestLocked(op); err == nil {
					t.Fatal("fixture should leave an unknown prepare")
				}
				if err := recoverPendingDirectTrades(); err != nil {
					t.Fatal(err)
				}
			} else {
				store.operations[op.ID] = op
				if err := recoverDirectTradesOnStartup(); err != nil {
					t.Fatal(err)
				}
			}
			if store.operations[op.ID].State != database.DirectTradeComplete || len(directTradePending.accounts) != 0 ||
				store.characters[op.Participants[0].Username].Gold != 1012 || store.characters[op.Participants[1].Username].Gold != 988 {
				t.Fatal("startup/unknown prepare did not finish and deliver exactly one settlement")
			}
		})
	}
}

func TestDirectTradeRuntimeRequestUsesCanonicalAccountOwnership(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeCancel, true)
	a, b := directTradeRuntimeClients(t, op)
	a.handleMessage(tradeActionMessage(MsgTradeCancel, op.TradeID))
	drainSentMessages(a.send)
	drainSentMessages(b.send)
	payload, _ := json.Marshal(TradeRequestPayload{TargetName: strings.ToUpper(b.username)})
	a.handleMessage(Message{Type: MsgTradeRequest, Payload: payload})
	trade := world.GetActiveDirectTrade(a.playerID)
	if trade == nil || trade.PlayerBID != b.playerID || len(store.operations) != 1 {
		t.Fatal("case-insensitive search did not bind the actual account")
	}
}

func TestDirectTradeRuntimeOwnershipRechecksPeerWhileQueued(t *testing.T) {
	_, op, _ := directTradeRecoveryFixture(t, database.DirectTradeCancel, true)
	third := newLevelCommandPlayer("player-trade-third")
	third.Name = "trade-third"
	first := world.GetEntityCopy(op.Participants[0].PlayerID)
	third.X, third.Z = first.X+1, first.Z
	world.AddEntity(third)
	unlock := lockCharactersWork(op.Participants[0].Username, op.Participants[1].Username, third.Name)
	released := false
	defer func() {
		if !released {
			unlock()
		}
	}()
	result := make(chan []string, 1)
	failure := make(chan error, 1)
	go func() {
		release, accounts, err := lockDirectTradeWork(false, op.Participants[0].Username)
		if err != nil {
			failure <- err
			return
		}
		release()
		result <- accounts
	}()
	deadline := time.Now().Add(time.Second)
	for {
		characterWork.Lock()
		queued := characterWork.entries[op.Participants[0].Username].users > 1
		characterWork.Unlock()
		if queued {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("ownership fixture did not queue")
		}
		time.Sleep(time.Millisecond)
	}
	completed, err := prepareAndCompleteDirectTradeLocked(op)
	if err != nil {
		t.Fatal(err)
	}
	if err := finishDirectTradeDeliveryLocked(*completed); err != nil {
		t.Fatal(err)
	}
	if _, err := world.StartDirectTrade(op.Participants[0].PlayerID, third.ID); err != nil {
		t.Fatal(err)
	}
	unlock()
	released = true
	select {
	case accounts := <-result:
		if !slices.Contains(accounts, third.Name) {
			t.Fatal("queued ownership missed the new peer")
		}
	case err := <-failure:
		t.Fatal(err)
	case <-time.After(3 * time.Second):
		t.Fatal("expanding peer ownership nested locks or deadlocked")
	}
}
