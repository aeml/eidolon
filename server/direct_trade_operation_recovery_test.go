package main

import (
	"errors"
	"fmt"
	"math"
	"os"
	"reflect"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

// Models durable store/atomic character-save receipts, not actual Mongo. The
// real BSON filesystem journal is used below and survives all simulated restarts.
type tradeRecoveryStore struct {
	mu                                    sync.Mutex
	operations                            map[string]database.DirectTradeOperation
	characters                            map[string]*database.Character
	writes                                map[string]int
	prepareCalls, completeCalls, reads    int
	failPrepareBefore, failPrepareAfter   bool
	failSaveAccount                       string
	failSaveAfter                         bool
	failCompleteBefore, failCompleteAfter bool
}

func cloneTradeRecoveryCharacter(character *database.Character) *database.Character {
	if character == nil {
		return nil
	}
	value, err := bson.Marshal(character)
	if err != nil {
		panic(err)
	}
	var result database.Character
	if err := bson.Unmarshal(value, &result); err != nil {
		panic(err)
	}
	return &result
}

func (store *tradeRecoveryStore) GetDirectTradeCharacter(username, name string) (*database.Character, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	character := store.characters[username]
	if character == nil || character.Name != name {
		return nil, nil
	}
	return cloneTradeRecoveryCharacter(character), nil
}

func (store *tradeRecoveryStore) CommitCharacterSave(username string, character *database.Character, id string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if previous := store.characters[username]; previous != nil && previous.LastSaveID == id {
		return nil
	}
	failing := store.failSaveAccount == username
	if failing && !store.failSaveAfter {
		store.failSaveAccount = ""
		return errors.New("character commit rejected")
	}
	store.characters[username] = cloneTradeRecoveryCharacter(character)
	store.characters[username].LastSaveID = id
	store.writes[username]++
	if failing {
		store.failSaveAccount = ""
		return errors.New("character commit applied, acknowledgement lost")
	}
	return nil
}

func (store *tradeRecoveryStore) GetDirectTradeOperation(id string) (*database.DirectTradeOperation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.reads++
	op, found := store.operations[id]
	if !found {
		return nil, nil
	}
	return &op, nil
}

func (store *tradeRecoveryStore) PrepareDirectTradeOperation(op database.DirectTradeOperation) (*database.DirectTradeOperation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.prepareCalls++
	if store.failPrepareBefore {
		store.failPrepareBefore = false
		return nil, errors.New("prepare rejected")
	}
	if previous, found := store.operations[op.ID]; found {
		if previous.Fingerprint != op.Fingerprint {
			return nil, database.ErrDirectTradeConflict
		}
		return &previous, nil
	}
	store.operations[op.ID] = op
	if store.failPrepareAfter {
		store.failPrepareAfter = false
		return nil, errors.New("prepare applied, acknowledgement lost")
	}
	return &op, nil
}

func (store *tradeRecoveryStore) CompleteDirectTradeOperation(id, fingerprint string) (*database.DirectTradeOperation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.completeCalls++
	op, found := store.operations[id]
	if !found || op.Fingerprint != fingerprint {
		return nil, database.ErrDirectTradeConflict
	}
	if op.State == database.DirectTradeComplete {
		return &op, nil
	}
	for _, participant := range op.Participants {
		if !directTradeReceiptMatches(store.characters[participant.Username], op, participant.Username) {
			return nil, errors.New("both actual stored participant receipts are required")
		}
	}
	if store.failCompleteBefore {
		store.failCompleteBefore = false
		return nil, errors.New("completion rejected")
	}
	op.State = database.DirectTradeComplete
	store.operations[id] = op
	if store.failCompleteAfter {
		store.failCompleteAfter = false
		return nil, errors.New("completion applied, acknowledgement lost")
	}
	return &op, nil
}

func (store *tradeRecoveryStore) PendingDirectTradeOperations(username string, limit int) ([]database.DirectTradeOperation, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	var result []database.DirectTradeOperation
	for _, op := range store.operations {
		if op.State == database.DirectTradePending && (username == "" || op.Participants[0].Username == username || op.Participants[1].Username == username) {
			result = append(result, op)
		}
	}
	slices.SortFunc(result, func(a, b database.DirectTradeOperation) int {
		if a.ID < b.ID {
			return -1
		}
		return 1
	})
	if len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func directTradeRecoveryFixture(t *testing.T, decision string, online bool) (*tradeRecoveryStore, database.DirectTradeOperation, string) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	previousStore, previousPending := directTradeOperations, directTradePending.accounts
	t.Cleanup(func() { directTradeOperations, directTradePending.accounts = previousStore, previousPending })
	directTradePending.accounts = make(map[string]pendingDirectTradeOperation)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	a, b := newLevelCommandPlayer("player-trade-alice"), newLevelCommandPlayer("player-trade-bob")
	a.Name, b.Name, a.Gold, b.Gold, a.EP, b.EP = "trade-alice", "trade-bob", 1000, 1000, 17, 19
	b.X, b.Z = a.X+1, a.Z
	a.Inventory = []game.Item{{ID: "earned-blade", Name: "Earned blade", Stack: 1, MaxStack: 1, Potency: 5, Stats: map[string]int{"damage": 23},
		Gems: []game.SocketedGem{{Stats: map[string]int{"wisdom": 7}}}, ForgeBasis: &forging.Basis{Level: 61, Stats: map[string]int{"damage": 17}}}}
	b.Inventory = []game.Item{{ID: "earned-robe", Name: "Earned robe", Stack: 1, MaxStack: 1, Stats: map[string]int{"intelligence": 9}}}
	world.AddEntity(a)
	world.AddEntity(b)
	trade, err := world.StartDirectTrade(a.ID, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := world.SetDurableDirectTradeOffer(a.ID, trade.ID, []string{"earned-blade"}, 17); err != nil {
		t.Fatal(err)
	}
	if _, err := world.SetDurableDirectTradeOffer(b.ID, trade.ID, []string{"earned-robe"}, 29); err != nil {
		t.Fatal(err)
	}
	var captured *database.DirectTradeOperation
	if decision == database.DirectTradeSettle {
		if _, first, err := world.PrepareDurableDirectTradeConfirmation(a.ID, trade.ID); err != nil || first != nil {
			t.Fatal("first confirmation must not freeze a decision", err)
		}
		_, captured, err = world.PrepareDurableDirectTradeConfirmation(b.ID, trade.ID)
	} else {
		_, captured, err = world.PrepareDurableDirectTradeCancellation(a.ID, trade.ID)
	}
	if err != nil || captured == nil {
		t.Fatal("authoritative world decision capture failed", err)
	}
	op := *captured
	store := &tradeRecoveryStore{operations: make(map[string]database.DirectTradeOperation), characters: make(map[string]*database.Character), writes: make(map[string]int)}
	for _, player := range []*game.Entity{a, b} {
		character := characterSnapshotForSave(player.Name, world.GetEntityCopy(player.ID))
		if !online {
			character.Resources = &database.CharacterResources{Version: 1, Health: 17, Mana: 0}
			character.WellRested = &database.CharacterWellRested{Version: 1, RemainingSeconds: 600}
			character.Equipment = map[string]database.Item{"chest": {ID: "legacy-chest", Stats: map[string]int{"vitality": 625}}}
			character.Quests = []database.Quest{{ID: "story-fixture", Count: 7, RewardXPQuoted: true, RewardGoldQuoted: true}}
			character.ItemDeliveryReceipts = map[string]string{"previous": "receipt"}
		}
		store.characters[player.Name] = cloneTradeRecoveryCharacter(character)
	}
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	characterSaveCommitter, directTradeOperations = store, store
	if !online {
		world.StopBackground()
		world = nil
	}
	return store, op, dir
}

func completeTradeTestLocked(op database.DirectTradeOperation) (*database.DirectTradeOperation, error) {
	unlock := lockCharactersWork(op.Participants[0].Username, op.Participants[1].Username)
	defer unlock()
	return prepareAndCompleteDirectTradeLocked(op)
}

func claimTradeTestLocked(username string, store directTradeOperationStore) (bool, error) {
	unlock := lockCharacterWork(username)
	defer unlock()
	return claimAndSaveDirectTradeDeliveryLocked(username, store)
}

func assertTradeNoUnrelatedChanges(t *testing.T, before, after *database.Character) {
	t.Helper()
	check := cloneTradeRecoveryCharacter(after)
	check.Gold, check.Inventory, check.DirectTradeState, check.LastSaveID, check.LastLogout = before.Gold, before.Inventory, before.DirectTradeState, before.LastSaveID, before.LastLogout
	if !reflect.DeepEqual(before, check) {
		t.Fatal("trade recovery changed unrelated resources, EP, progression, equipment, quests or receipts")
	}
}

func TestDirectTradeCoordinatorOnlineOfflineSettlementAndCancellation(t *testing.T) {
	for _, online := range []bool{false, true} {
		for _, decision := range []string{database.DirectTradeSettle, database.DirectTradeCancel} {
			t.Run(fmt.Sprintf("%v-%s", online, decision), func(t *testing.T) {
				store, op, _ := directTradeRecoveryFixture(t, decision, online)
				before := map[string]*database.Character{}
				for _, participant := range op.Participants {
					before[participant.Username] = cloneTradeRecoveryCharacter(store.characters[participant.Username])
				}
				completed, err := completeTradeTestLocked(op)
				if err != nil || completed == nil || completed.State != database.DirectTradeComplete {
					t.Fatal("two-account completion failed", completed, err)
				}
				for _, participant := range op.Participants {
					saved := store.characters[participant.Username]
					if !directTradeReceiptMatches(saved, op, participant.Username) || saved.Gold != before[participant.Username].Gold || len(saved.Inventory) != 0 || store.writes[participant.Username] != 1 {
						t.Fatal("decision did not save private ownership exactly once before delivery")
					}
					if _, found := pendingDirectTradeForAccount(participant.Username); found {
						t.Fatal("complete decision left account admission fenced")
					}
					if changed, err := claimTradeTestLocked(participant.Username, store); !changed || err != nil {
						t.Fatal("confirmed delivery failed", err)
					}
					saved = store.characters[participant.Username]
					wantGold, wantItem := 1000, "earned-blade"
					if participant.Username == "trade-bob" {
						wantItem = "earned-robe"
					}
					if decision == database.DirectTradeSettle {
						wantGold, wantItem = 1012, "earned-robe"
						if participant.Username == "trade-bob" {
							wantGold, wantItem = 988, "earned-blade"
						}
					}
					if saved.Gold != wantGold || len(saved.Inventory) != 1 || saved.Inventory[0].ID != wantItem {
						t.Fatal("delivery changed net funds or item ownership", saved.Gold, saved.Inventory)
					}
					if wantItem == "earned-blade" && (saved.Inventory[0].Potency != 5 || saved.Inventory[0].Gems[0].Stats["wisdom"] != 7 || saved.Inventory[0].ForgeBasis.Stats["damage"] != 17) {
						t.Fatal("delivery altered exact earned Forge/gem metadata")
					}
					assertTradeNoUnrelatedChanges(t, before[participant.Username], saved)
				}
				if online && len(world.DirectTrades) != 0 {
					t.Fatal("completed table was not retired without a refund")
				}
				for attempt := 0; attempt < 3; attempt++ {
					if _, err := completeTradeTestLocked(op); err != nil {
						t.Fatal(err)
					}
					for _, participant := range op.Participants {
						if changed, err := claimTradeTestLocked(participant.Username, store); changed || err != nil || store.writes[participant.Username] != 2 {
							t.Fatal("completed/claimed replay paid or rewrote another effect", err)
						}
					}
				}
			})
		}
	}
}

func TestDirectTradeCoordinatorFailureAndFreshRecoveryKeepsFirstDecision(t *testing.T) {
	for _, failure := range []string{"prepare-before", "prepare-after", "first-save-before", "first-save-after", "second-save-before", "second-save-after", "complete-before", "complete-after"} {
		t.Run(failure, func(t *testing.T) {
			store, op, dir := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
			switch failure {
			case "prepare-before":
				store.failPrepareBefore = true
			case "prepare-after":
				store.failPrepareAfter = true
			case "first-save-before", "first-save-after":
				store.failSaveAccount, store.failSaveAfter = "trade-alice", failure == "first-save-after"
			case "second-save-before", "second-save-after":
				store.failSaveAccount, store.failSaveAfter = "trade-bob", failure == "second-save-after"
			case "complete-before":
				store.failCompleteBefore = true
			case "complete-after":
				store.failCompleteAfter = true
			}
			if result, err := completeTradeTestLocked(op); err == nil || result != nil {
				t.Fatal("unknown decision acknowledged as complete", result, err)
			}
			for _, participant := range op.Participants {
				if _, found := pendingDirectTradeForAccount(participant.Username); !found {
					t.Fatal("unknown outcome lost one account's fence")
				}
			}
			if failure == "prepare-before" || failure == "prepare-after" {
				if store.writes["trade-alice"] != 0 || store.writes["trade-bob"] != 0 {
					t.Fatal("participant effect preceded confirmed prepare")
				}
				// A later cancellation request cannot replace the unresolved plan.
				cancel := op
				cancel.Decision = database.DirectTradeCancel
				cancel.Fingerprint, _ = database.DirectTradeOperationFingerprint(cancel)
				completed, err := completeTradeTestLocked(cancel)
				if err != nil || completed == nil || completed.Decision != database.DirectTradeSettle {
					t.Fatal("unknown preparation was compensated by cancellation", completed, err)
				}
			} else {
				world.StopBackground()
				world = nil
				directTradePending.accounts = make(map[string]pendingDirectTradeOperation)
				failedCharacterSaves.users = make(map[string]bool)
				var err error
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				if failure == "first-save-after" {
					store.characters["trade-alice"].Gold += 13
				}
				if failure == "second-save-after" {
					store.characters["trade-bob"].Gold += 13
				}
				// New process recovery uses the actual stored intent, not old RAM.
				frozen, err := store.GetDirectTradeOperation(op.ID)
				if err != nil || frozen == nil {
					t.Fatal("shared intent was lost", err)
				}
				if err := recoverDirectTradeOperation(*frozen); err != nil {
					t.Fatal("fresh journal/intent recovery failed", err)
				}
			}
			for _, participant := range op.Participants {
				if !directTradeReceiptMatches(store.characters[participant.Username], op, participant.Username) || store.writes[participant.Username] != 1 {
					t.Fatal("participant receipt was replayed as another transfer")
				}
				if changed, err := claimTradeTestLocked(participant.Username, store); !changed || err != nil {
					t.Fatal(err)
				}
			}
			wantTotal := 2000
			if failure == "first-save-after" || failure == "second-save-after" {
				wantTotal += 13
			}
			if store.characters["trade-alice"].Gold+store.characters["trade-bob"].Gold != wantTotal || store.characters["trade-alice"].Inventory[0].ID != "earned-robe" || store.characters["trade-bob"].Inventory[0].ID != "earned-blade" || len(store.operations) != 1 || store.operations[op.ID].Decision != database.DirectTradeSettle {
				t.Fatal("fresh recovery duplicated/lost funds, reassigned custody or changed the frozen decision")
			}
		})
	}
}

func TestDirectTradeCoordinatorMissingConfirmedIntentAndChangedCustodyFailClosed(t *testing.T) {
	for _, failure := range []string{"missing intent", "changed participant", "unproved receipt", "foreign account"} {
		t.Run(failure, func(t *testing.T) {
			store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
			if _, err := store.PrepareDirectTradeOperation(op); err != nil {
				t.Fatal(err)
			}
			if err := confirmDirectTradeOperationLocked(op); err != nil {
				t.Fatal(err)
			}
			switch failure {
			case "missing intent":
				delete(store.operations, op.ID)
			case "changed participant":
				changed := op
				changed.Participants[1].OfferPayload = `{"gold":0,"items":[]}`
				changed.Fingerprint, _ = database.DirectTradeOperationFingerprint(changed)
				store.operations[op.ID] = changed
			case "unproved receipt":
				state, _ := database.DecodeDirectTradeState(store.characters["trade-alice"].DirectTradeState)
				state.Revision++
				store.characters["trade-alice"].DirectTradeState, _ = database.EncodeDirectTradeState(*state)
			case "foreign account":
				reads := store.reads
				if err := recoverAccountDirectTradesLocked("unrelated"); err != nil || store.reads != reads {
					t.Fatal("unrelated ordinary admission queries/executes someone else's trade")
				}
				return
			}
			beforeA, beforeB := cloneTradeRecoveryCharacter(store.characters["trade-alice"]), cloneTradeRecoveryCharacter(store.characters["trade-bob"])
			if result, err := completeTradeTestLocked(op); result != nil || err == nil || !reflect.DeepEqual(store.characters["trade-alice"], beforeA) || !reflect.DeepEqual(store.characters["trade-bob"], beforeB) || store.prepareCalls != 1 {
				t.Fatal("missing/changed confirmed intent recreated or changed custody", result, err)
			}
		})
	}
}

func TestDirectTradeCoordinatorSortedBothAccountLocksSerializeOppositeRecovery(t *testing.T) {
	store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
	if _, err := store.PrepareDirectTradeOperation(op); err != nil {
		t.Fatal(err)
	}
	reversed := op
	reversed.Participants[0], reversed.Participants[1] = reversed.Participants[1], reversed.Participants[0]
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, captured := range []database.DirectTradeOperation{op, reversed} {
		go func(captured database.DirectTradeOperation) {
			<-start
			results <- recoverDirectTradeOperation(captured)
		}(captured)
	}
	close(start)
	for count := 0; count < 2; count++ {
		select {
		case err := <-results:
			if err != nil {
				t.Fatal(err)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("opposite participant order deadlocked recovery")
		}
	}
	if store.writes["trade-alice"] != 1 || store.writes["trade-bob"] != 1 || store.operations[op.ID].State != database.DirectTradeComplete ||
		!directTradeReceiptMatches(store.characters["trade-alice"], op, "trade-alice") || !directTradeReceiptMatches(store.characters["trade-bob"], op, "trade-bob") {
		t.Fatal("serialized recovery applied another participant effect")
	}
}

func TestDirectTradeCoordinatorDeliveryRefusesUnprovenOrUnplaceableCustody(t *testing.T) {
	for _, outcome := range []string{"pending decision", "full bag", "wallet overflow", "changed payload", "missing outbox", "future item"} {
		t.Run(outcome, func(t *testing.T) {
			store, op, _ := directTradeRecoveryFixture(t, database.DirectTradeSettle, false)
			if outcome == "future item" {
				payload := strings.Replace(op.Participants[0].OfferPayload, `"id":"earned-blade"`, `"id":"earned-blade","futureAppearance":{"skin":"new"}`, 1)
				op.Participants[0].OfferPayload = payload
				op.Fingerprint, _ = database.DirectTradeOperationFingerprint(op)
				state, _ := database.DecodeDirectTradeState(store.characters["trade-alice"].DirectTradeState)
				state.Escrow.OfferPayload = payload
				var err error
				store.characters["trade-alice"].DirectTradeState, err = database.EncodeDirectTradeState(*state)
				if err != nil {
					t.Fatal(err)
				}
			}
			store.failCompleteBefore = outcome == "pending decision"
			completed, err := completeTradeTestLocked(op)
			if outcome == "pending decision" {
				if err == nil || completed != nil {
					t.Fatal("fixture decision should still be pending")
				}
			} else if err != nil || completed == nil {
				t.Fatal(err)
			}
			character := store.characters["trade-bob"]
			state, _ := database.DecodeDirectTradeState(character.DirectTradeState)
			switch outcome {
			case "full bag":
				for index := 0; index < game.MaxInventorySize; index++ {
					character.Inventory = append(character.Inventory, database.Item{ID: fmt.Sprintf("filled-%d", index), Stack: 1, MaxStack: 1})
				}
			case "wallet overflow":
				character.Gold = math.MaxInt - 10
			case "changed payload":
				state.Delivery.OfferPayload = strings.Replace(state.Delivery.OfferPayload, `"gold":17`, `"gold":99`, 1)
			case "missing outbox":
				state.Delivery = nil
			}
			character.DirectTradeState, err = database.EncodeDirectTradeState(*state)
			if err != nil {
				t.Fatal(err)
			}
			before := cloneTradeRecoveryCharacter(character)
			writes := store.writes["trade-bob"]
			if changed, err := claimTradeTestLocked("trade-bob", store); changed || err == nil || store.writes["trade-bob"] != writes || !reflect.DeepEqual(store.characters["trade-bob"], before) {
				t.Fatal("unproved/unplaceable/future delivery mutated stored custody", outcome, err)
			}
		})
	}
}

func TestDirectTradeCoordinatorClaimSaveRecoveryDoesNotRegrant(t *testing.T) {
	for _, online := range []bool{false, true} {
		for _, lostAck := range []bool{false, true} {
			t.Run(fmt.Sprintf("online-%v-lostAck-%v", online, lostAck), func(t *testing.T) {
				store, op, dir := directTradeRecoveryFixture(t, database.DirectTradeSettle, online)
				if _, err := completeTradeTestLocked(op); err != nil {
					t.Fatal(err)
				}
				store.failSaveAccount, store.failSaveAfter = "trade-bob", lostAck
				if changed, err := claimTradeTestLocked("trade-bob", store); changed || err == nil {
					t.Fatal("unknown claim save acknowledged as confirmed", err)
				}
				pending, err := characterSaveJournal.Read("trade-bob")
				if err != nil || pending == nil {
					t.Fatal("failed claim lost its full bag/Gold/outbox post-image", err)
				}
				postImage, err := pending.Character()
				if err != nil || postImage.Gold != 988 || len(postImage.Inventory) != 1 || postImage.Inventory[0].ID != "earned-blade" {
					t.Fatal("claim journal is not the complete transfer", err)
				}
				state, err := database.DecodeDirectTradeState(postImage.DirectTradeState)
				if err != nil || state.Delivery != nil || state.Revision != op.Participants[1].ExpectedRevision+2 || !directTradeReceiptMatches(postImage, op, "trade-bob") {
					t.Fatal("claim journal did not atomically empty its outbox", err)
				}
				if world != nil {
					world.StopBackground()
				}
				world = nil
				failedCharacterSaves.users = make(map[string]bool)
				characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
				if err != nil {
					t.Fatal(err)
				}
				if lostAck {
					store.characters["trade-bob"].Gold += 13
				}
				if changed, err := claimTradeTestLocked("trade-bob", store); changed || err != nil {
					t.Fatal("journal recovery re-granted an already captured claim", err)
				}
				wantGold := 988
				if lostAck {
					wantGold += 13
				}
				if store.characters["trade-bob"].Gold != wantGold || len(store.characters["trade-bob"].Inventory) != 1 || store.writes["trade-bob"] != 2 {
					t.Fatal("claim replay overwrote later credit or granted another item/Gold effect")
				}
			})
		}
	}
}

func TestDirectTradeCoordinatorClaimLocalJournalFailurePinsLatestPostImage(t *testing.T) {
	store, op, dir := directTradeRecoveryFixture(t, database.DirectTradeSettle, true)
	if _, err := completeTradeTestLocked(op); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(dir, dir+".offline"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Rename(dir+".offline", dir) })
	if changed, err := claimTradeTestLocked("trade-bob", store); changed || err == nil {
		t.Fatal("unjournaled claim acknowledged", err)
	}
	world.SetEntityDisconnected("player-trade-bob", time.Now().Add(-time.Hour))
	if expired := world.CollectExpiredDisconnectedPlayers(15 * time.Minute); len(expired) != 0 || world.GetEntityCopy("player-trade-bob") == nil || store.writes["trade-bob"] != 1 {
		t.Fatal("expiry removed or committed the only unjournaled claim post-image")
	}
	if err := os.Rename(dir+".offline", dir); err != nil {
		t.Fatal(err)
	}
	if changed, err := claimTradeTestLocked("trade-bob", store); changed || err != nil || store.characters["trade-bob"].Gold != 988 || store.writes["trade-bob"] != 2 {
		t.Fatal("local-write recovery lost or re-granted the claim", err)
	}
}

func TestDirectTradeCoordinatorCannotFreezeUnsavedOrMispairedEscrow(t *testing.T) {
	for _, outcome := range []string{"missing saved escrow", "duplicated bag item", "receipt without intent", "offer save unavailable"} {
		t.Run(outcome, func(t *testing.T) {
			store, op, dir := directTradeRecoveryFixture(t, database.DirectTradeSettle, outcome == "offer save unavailable")
			character := store.characters["trade-alice"]
			switch outcome {
			case "missing saved escrow", "offer save unavailable":
				character.DirectTradeState = nil
				character.Gold = 1000
				character.Inventory = []database.Item{{ID: "earned-blade", Stack: 1, MaxStack: 1}}
				if outcome == "offer save unavailable" {
					noteCharacterSaveFailure("trade-alice", true)
					if err := os.Rename(dir, dir+".offline"); err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() { _ = os.Rename(dir+".offline", dir) })
				}
			case "duplicated bag item":
				character.Inventory = []database.Item{{ID: "earned-blade", Stack: 1, MaxStack: 1}}
			case "receipt without intent":
				if _, err := database.ApplyDirectTradeCharacterDecision("trade-alice", character, op); err != nil {
					t.Fatal(err)
				}
			}
			beforeA, beforeB := cloneTradeRecoveryCharacter(character), cloneTradeRecoveryCharacter(store.characters["trade-bob"])
			if result, err := completeTradeTestLocked(op); result != nil || err == nil || store.prepareCalls != 0 || len(store.operations) != 0 || store.writes["trade-alice"] != 0 || store.writes["trade-bob"] != 0 ||
				!reflect.DeepEqual(store.characters["trade-alice"], beforeA) || !reflect.DeepEqual(store.characters["trade-bob"], beforeB) {
				t.Fatal("shared intent/effect preceded proven saved escrow", outcome, result, err)
			}
		})
	}
}
