package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

// Only terminal recovery is faked here. Two-sided effects have separate real
// Mongo/journal failure-boundary tests; unexpected financial IO panics.
type bankSchedulerStore struct {
	guildBankOperationStore
	ops                            map[string]database.GuildBankOperation
	held                           map[string]bool
	getErr, prepareErr, releaseErr error
	insertBeforeError              bool
	gets, queries, releases        int
	maxBatch                       int
}

func (s *bankSchedulerStore) GetGuildBankOperation(id string) (*database.GuildBankOperation, error) {
	s.gets++
	if s.getErr != nil {
		return nil, s.getErr
	}
	op, found := s.ops[id]
	if !found {
		return nil, nil
	}
	return &op, nil
}

func (s *bankSchedulerStore) PrepareGuildBankOperation(op database.GuildBankOperation) (*database.GuildBankOperation, error) {
	if s.prepareErr == nil || s.insertBeforeError {
		// Simulate another executor completing before this insertion's reply.
		op.State = database.GuildBankComplete
		s.ops[op.ID] = op
		s.held[op.ID] = true
	}
	if s.prepareErr != nil {
		return nil, s.prepareErr
	}
	return &op, nil
}

func (s *bankSchedulerStore) PendingGuildBankOperations(string, int) ([]database.GuildBankOperation, error) {
	s.queries++
	return nil, nil
}

func (s *bankSchedulerStore) ReservedGuildBankOperationIDs(limit int) ([]string, error) {
	s.queries++
	var ids []string
	for id := range s.held {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	if len(ids) > limit {
		ids = ids[:limit]
	}
	s.maxBatch = max(s.maxBatch, len(ids))
	return ids, nil
}

func (s *bankSchedulerStore) ReleaseGuildBankOperation(id, fingerprint string) error {
	s.releases++
	if s.releaseErr != nil {
		return s.releaseErr
	}
	if op, exists := s.ops[id]; !exists || op.Fingerprint != fingerprint {
		return database.ErrGuildBankOperationConflict
	}
	delete(s.held, id)
	return nil
}

func bankSchedulerFixture(t *testing.T, count int) (*bankSchedulerStore, []database.GuildBankOperation) {
	t.Helper()
	oldStore, oldCache := guildBankOperations, guildBankPending.accounts
	oldStopping := serverStopping.Load()
	t.Cleanup(func() {
		guildBankOperations, guildBankPending.accounts = oldStore, oldCache
		serverStopping.Store(oldStopping)
	})
	serverStopping.Store(false)
	guildBankPending.accounts = make(map[string]map[string]pendingGuildBankOperation)
	store := &bankSchedulerStore{ops: make(map[string]database.GuildBankOperation), held: make(map[string]bool)}
	guildBankOperations = store
	var ops []database.GuildBankOperation
	for i := 0; i < count; i++ {
		username := fmt.Sprintf("recipient-%03d", i)
		request := fmt.Sprintf("bank-recovery-request-%03d", i)
		op := database.GuildBankOperation{Version: 1, RequestID: request, Username: username,
			CharacterName: username, PlayerID: "player-" + username, GuildID: "guild-" + username,
			Action: database.GuildBankDepositGold, Gold: 10, State: database.GuildBankComplete, CreatedAt: time.Now()}
		op.ID = database.GuildBankOperationID(username, request)
		op.Fingerprint = database.GuildBankOperationFingerprint(op)
		if err := op.Validate(); err != nil {
			t.Fatal(err)
		}
		store.ops[op.ID], store.held[op.ID] = op, true
		ops = append(ops, op)
	}
	return store, ops
}

func TestGuildBankSchedulerDrainsTerminalHoldsWithBoundedRuntime(t *testing.T) {
	for _, startup := range []bool{false, true} {
		t.Run(fmt.Sprint(startup), func(t *testing.T) {
			store, _ := bankSchedulerFixture(t, 73)
			var err error
			if startup {
				err = recoverGuildBankOperationsOnStartup()
			} else {
				err = recoverPendingGuildBankOperations()
			}
			want := 50
			if startup {
				want = 73
			}
			if err != nil || store.releases != want || store.maxBatch != 50 || len(guildBankPending.accounts) != 0 {
				t.Fatal("unbounded pass or incomplete terminal release", err, store.releases, store.maxBatch)
			}
		})
	}
}

func TestGuildBankSchedulerOnlyAffectedAccountQueriesStorage(t *testing.T) {
	store, ops := bankSchedulerFixture(t, 1)
	trackGuildBankOperation(ops[0], false)
	store.getErr = errors.New("storage unavailable")
	if err := recoverAccountGuildBankOperationsLocked("unrelated"); err != nil || store.gets != 0 || store.queries != 0 {
		t.Fatal("unrelated movement queried storage")
	}
	if err := recoverAccountGuildBankOperationsLocked(ops[0].Username); err == nil || len(guildBankPending.accounts) != 1 {
		t.Fatal("affected account admitted before recovery")
	}
	store.getErr = nil
	store.releaseErr = errors.New("release acknowledgement lost")
	if err := recoverAccountGuildBankOperationsLocked(ops[0].Username); err == nil || len(guildBankPending.accounts) != 1 {
		t.Fatal("terminal intent forgotten before release")
	}
	store.releaseErr = nil
	if err := recoverAccountGuildBankOperationsLocked(ops[0].Username); err != nil || len(guildBankPending.accounts) != 0 {
		t.Fatal("recovered account remains blocked", err)
	}
	gets := store.gets
	if err := recoverAccountGuildBankOperationsLocked(ops[0].Username); err != nil || store.gets != gets {
		t.Fatal("settled account keeps querying storage")
	}
}

func TestGuildBankSchedulerResolvesAmbiguousPrepareAndPreservesConfirmedIdentity(t *testing.T) {
	for _, inserted := range []bool{false, true} {
		t.Run(fmt.Sprint(inserted), func(t *testing.T) {
			store, ops := bankSchedulerFixture(t, 1)
			op := ops[0]
			op.State = database.GuildBankPending
			delete(store.ops, op.ID)
			delete(store.held, op.ID)
			store.prepareErr, store.insertBeforeError = errors.New("insertion reply lost"), inserted
			if _, err := prepareGuildBankOperationLocked(op); err == nil || len(guildBankPending.accounts) != 1 {
				t.Fatal("uncertain insertion not tracked")
			}
			if err := recoverPendingGuildBankOperations(); err != nil || len(guildBankPending.accounts) != 0 || len(store.held) != 0 {
				t.Fatal("uncertain insertion did not reconcile", err)
			}
			if !inserted && store.releases != 0 || inserted && store.releases != 1 {
				t.Fatal("incorrect uncertain insertion effects", store.releases)
			}
		})
	}
	store, ops := bankSchedulerFixture(t, 1)
	op := ops[0]
	trackGuildBankOperation(op, false)
	trackGuildBankOperation(op, true)
	delete(store.ops, op.ID)
	if err := recoverAccountGuildBankOperationsLocked(op.Username); err == nil || len(guildBankPending.accounts) != 1 {
		t.Fatal("confirmed missing intent discarded")
	}
}

func TestGuildBankSchedulerBusyConflictCannotBlockAccountAndOutageStopsBatch(t *testing.T) {
	store, ops := bankSchedulerFixture(t, 73)
	for _, failure := range []error{database.ErrGuildBankOperationBusy, database.ErrGuildBankOperationConflict} {
		store.prepareErr = failure
		op := ops[0]
		op.State = database.GuildBankPending
		if _, err := prepareGuildBankOperationLocked(op); !errors.Is(err, failure) || len(guildBankPending.accounts) != 0 {
			t.Fatal("rejected insertion blocked unrelated work", err)
		}
	}
	store.releaseErr = errors.New("storage unavailable")
	if err := recoverPendingGuildBankOperations(); err == nil || store.releases != 1 {
		t.Fatal("outage caused repeated batch timeouts", err, store.releases)
	}
}

func TestGuildBankSchedulerAdmissionBlocksMovementAndAdministratorTargetUntilRelease(t *testing.T) {
	c, _, _, committer, player := adminMutationFixture(t)
	store, ops := bankSchedulerFixture(t, 1)
	op := ops[0]
	delete(store.ops, op.ID)
	delete(store.held, op.ID)
	op.Username, op.CharacterName, op.PlayerID = "recipient", "recipient", "player-recipient"
	op.ID = database.GuildBankOperationID(op.Username, op.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	store.ops[op.ID], store.held[op.ID] = op, true
	trackGuildBankOperation(op, false)
	store.releaseErr = errors.New("guild hold release unavailable")
	result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture)
	if result.Success || !result.Pending || result.Final || player.Gold != 100 || len(committer.ids) != 0 {
		t.Fatal("administrator mutated an unsettled bank recipient", result)
	}
	oldHandler := messageHandlers[MsgMove]
	t.Cleanup(func() {
		if oldHandler == nil {
			delete(messageHandlers, MsgMove)
		} else {
			messageHandlers[MsgMove] = oldHandler
		}
	})
	admitted := 0
	messageHandlers[MsgMove] = func(*Client, Message) { admitted++ }
	member := activeSessions["recipient"]
	member.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":40,"z":250}`)})
	if admitted != 0 {
		t.Fatal("ordinary movement admitted before bank hold release")
	}
	found := false
	for _, reply := range drainSentMessages(member.send) {
		found = found || strings.Contains(string(reply.Payload), "guild bank transfer")
	}
	if !found {
		t.Fatal("blocked account received no recovery explanation")
	}
	store.releaseErr = nil
	member.handleMessage(Message{Type: MsgMove, Payload: json.RawMessage(`{"x":40,"z":250}`)})
	if admitted != 1 || len(guildBankPending.accounts) != 0 {
		t.Fatal("settled account was not readmitted")
	}
}
