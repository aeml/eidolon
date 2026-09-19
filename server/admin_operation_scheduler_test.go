package main

import (
	"bytes"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

type schedulerOperationStore struct {
	ops                               map[string]database.AdminOperation
	getErr, prepareErr, finishErr     error
	insertBeforeError                 bool
	gets, queries, finishes, maxBatch int
}

func (s *schedulerOperationStore) GetAdminOperation(id string) (*database.AdminOperation, error) {
	s.gets++
	if s.getErr != nil {
		return nil, s.getErr
	}
	op, ok := s.ops[id]
	if !ok {
		return nil, nil
	}
	return &op, nil
}
func (s *schedulerOperationStore) PrepareAdminOperation(op database.AdminOperation) (*database.AdminOperation, error) {
	if s.prepareErr == nil || s.insertBeforeError {
		s.ops[op.ID] = op
	}
	if s.prepareErr != nil {
		return nil, s.prepareErr
	}
	return &op, nil
}
func (s *schedulerOperationStore) FinishAdminOperation(id, fingerprint string, audit database.AdminActivity) (*database.AdminOperation, error) {
	s.finishes++
	if s.finishErr != nil {
		return nil, s.finishErr
	}
	op, ok := s.ops[id]
	if !ok || op.Fingerprint != fingerprint {
		return nil, database.ErrAdminOperationConflict
	}
	op.State, op.Audit = database.AdminOperationComplete, audit
	s.ops[id] = op
	return &op, nil
}
func (s *schedulerOperationStore) PendingAdminOperations(target string, limit int) ([]database.AdminOperation, error) {
	s.queries++
	var result []database.AdminOperation
	for _, op := range s.ops {
		if op.State != database.AdminOperationComplete && (target == "" || op.Target == target) {
			result = append(result, op)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	if len(result) > limit {
		result = result[:limit]
	}
	s.maxBatch = max(s.maxBatch, len(result))
	return result, nil
}
func (s *schedulerOperationStore) GetCharacter(string, string) (*database.Character, error) {
	return nil, errors.New("audit-only recovery must not load or save a character")
}

func adminSchedulerFixture(t *testing.T, count int) (*schedulerOperationStore, []database.AdminOperation) {
	t.Helper()
	oldStore, oldCache := adminOperations, adminPending.accounts
	oldStopping := serverStopping.Load()
	t.Cleanup(func() { adminOperations, adminPending.accounts = oldStore, oldCache; serverStopping.Store(oldStopping) })
	serverStopping.Store(false)
	adminPending.accounts = make(map[string]map[string]pendingAdminOperation)
	store := &schedulerOperationStore{ops: make(map[string]database.AdminOperation)}
	adminOperations = store
	var operations []database.AdminOperation
	for i := 0; i < count; i++ {
		request := fmt.Sprintf("recovery-request-%03d", i)
		audit, err := database.NewAdminActivity("operator", "recipient", MsgAdminGrantGold, request, "success", "Granted 10 Gold.", time.Now(), 90)
		if err != nil {
			t.Fatal(err)
		}
		op := database.AdminOperation{Version: 1, ID: database.AdminOperationID("operator", request), Fingerprint: strings.Repeat("a", 64),
			Actor: "operator", Target: "recipient", Action: MsgAdminGrantGold, RequestID: request, State: database.AdminOperationAuditing, Audit: audit}
		operations = append(operations, op)
		store.ops[op.ID] = op
	}
	return store, operations
}

func TestAdminRecoveryStartupDrainsAllBatchesRuntimeIsBounded(t *testing.T) {
	for _, startup := range []bool{false, true} {
		t.Run(fmt.Sprint(startup), func(t *testing.T) {
			store, _ := adminSchedulerFixture(t, 73)
			var err error
			if startup {
				err = recoverAdminOperationsOnStartup()
			} else {
				err = recoverPendingAdminOperations()
			}
			if err != nil {
				t.Fatal(err)
			}
			want := 50
			if startup {
				want = 73
			}
			if store.finishes != want || store.maxBatch != 50 {
				t.Fatal("unbounded runtime or incomplete startup", store.finishes, store.maxBatch)
			}
			if len(adminPending.accounts) != 0 {
				t.Fatal("completed recovery left a blocking account cache")
			}
		})
	}
}

func TestAdminRecoveryBlocksOnlyAffectedAccountAndRetriesWithoutCharacterIO(t *testing.T) {
	store, operations := adminSchedulerFixture(t, 1)
	trackAdminOperation(operations[0])
	store.getErr = errors.New("database unavailable")
	if err := recoverAccountAdminOperationsLocked("unrelated"); err != nil || store.gets != 0 || store.queries != 0 {
		t.Fatal("ordinary account queried operation database")
	}
	if err := recoverAccountAdminOperationsLocked("recipient"); err == nil || len(adminPending.accounts) != 1 {
		t.Fatal("pending affected account was admitted or forgotten")
	}
	store.getErr = nil
	store.finishErr = errors.New("audit unavailable")
	if err := recoverAccountAdminOperationsLocked("recipient"); err == nil || len(adminPending.accounts) != 1 {
		t.Fatal("audit failure admitted affected account")
	}
	store.finishErr = nil
	if err := recoverAccountAdminOperationsLocked("recipient"); err != nil || len(adminPending.accounts) != 0 {
		t.Fatal("recovered account stayed blocked", err)
	}
	gets := store.gets
	if err := recoverAccountAdminOperationsLocked("recipient"); err != nil || store.gets != gets {
		t.Fatal("recovered movement still queries Mongo")
	}
}

func TestAdminRecoveryResolvesAmbiguousPrepareWithoutDiscardingConfirmedIntent(t *testing.T) {
	for _, inserted := range []bool{false, true} {
		t.Run(fmt.Sprint(inserted), func(t *testing.T) {
			store, operations := adminSchedulerFixture(t, 1)
			op := operations[0]
			delete(store.ops, op.ID)
			store.prepareErr, store.insertBeforeError = errors.New("prepare response lost"), inserted
			if _, err := prepareAdminOperationLocked(op); err == nil || len(adminPending.accounts) != 1 {
				t.Fatal("ambiguous prepare wasn't tracked")
			}
			if err := recoverAccountAdminOperationsLocked(op.Target); err != nil {
				t.Fatal(err)
			}
			if len(adminPending.accounts) != 0 || inserted && store.finishes != 1 || !inserted && store.finishes != 0 {
				t.Fatal("ambiguous prepare resolved incorrectly")
			}
		})
	}
	store, operations := adminSchedulerFixture(t, 1)
	op := operations[0]
	trackAdminOperation(op)
	trackAdminOperationDecision(op, true) // Cannot downgrade a confirmed record.
	delete(store.ops, op.ID)
	if err := recoverAccountAdminOperationsLocked(op.Target); err == nil || len(adminPending.accounts) == 0 {
		t.Fatal("missing confirmed intent silently discarded")
	}
}

func TestAdminRecoveryDeniedRequestsCannotBlockVictimsAndOutageStopsBatch(t *testing.T) {
	store, operations := adminSchedulerFixture(t, 73)
	denied := operations[0]
	denied.Audit.Result = "denied"
	trackAdminOperation(denied)
	if len(adminPending.accounts) != 0 {
		t.Fatal("unauthorised operation blocked its named target")
	}
	store.finishErr = errors.New("audit outage")
	if err := recoverPendingAdminOperations(); err == nil || store.finishes != 1 || store.queries != 1 {
		t.Fatal("outage multiplied retry attempts")
	}
}

func TestAdminRecoveryConcurrentTargetCommandsFinishOnce(t *testing.T) {
	store, operations := adminSchedulerFixture(t, 1)
	trackAdminOperation(operations[0])
	var group sync.WaitGroup
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			unlock := lockCharacterWork("recipient")
			defer unlock()
			if err := recoverAccountAdminOperationsLocked("recipient"); err != nil {
				t.Error(err)
			}
		}()
	}
	group.Wait()
	if store.finishes != 1 || len(adminPending.accounts) != 0 {
		t.Fatal("concurrent target commands repeated recovery")
	}
}

func TestAdminRecoveryRuntimeResolvesMissingPrepareAndLostCompletionReplies(t *testing.T) {
	for _, completed := range []bool{false, true} {
		t.Run(fmt.Sprint(completed), func(t *testing.T) {
			store, operations := adminSchedulerFixture(t, 1)
			op := operations[0]
			if completed {
				trackAdminOperation(op)
				op.State = database.AdminOperationComplete
				store.ops[op.ID] = op
			} else {
				delete(store.ops, op.ID)
				trackAdminOperationDecision(op, true)
			}
			if err := recoverPendingAdminOperations(); err != nil || len(adminPending.accounts) != 0 || store.finishes != 0 {
				t.Fatal("quiet runtime retry did not resolve an ambiguous reply", err)
			}
		})
	}
}

func TestAdminRecoveryCommandAdmissionHonorsPendingAndStaleOwnership(t *testing.T) {
	store, operations := adminSchedulerFixture(t, 1)
	trackAdminOperation(operations[0])
	store.finishErr = errors.New("private storage diagnostic")
	previousSessions, previousHandler := activeSessions, messageHandlers[MsgAdminStatus]
	t.Cleanup(func() { activeSessions, messageHandlers[MsgAdminStatus] = previousSessions, previousHandler })
	called := 0
	messageHandlers[MsgAdminStatus] = func(*Client, Message) { called++ }
	current := &Client{username: "recipient", send: make(chan []byte, 10)}
	other := &Client{username: "unrelated", send: make(chan []byte, 10)}
	activeSessions = map[string]*Client{"recipient": current, "unrelated": other}
	current.handleMessage(Message{Type: MsgAdminStatus})
	if called != 0 {
		t.Fatal("pending target command reached its handler")
	}
	messages := drainSentMessages(current.send)
	if len(messages) != 1 || bytes.Contains(messages[0].Payload, []byte("private storage")) {
		t.Fatal("missing safe recovery rejection or leaked diagnostic")
	}
	gets := store.gets
	other.handleMessage(Message{Type: MsgAdminStatus})
	if called != 1 || store.gets != gets {
		t.Fatal("unrelated command blocked or queried operation storage")
	}
	stale := &Client{username: "recipient", send: make(chan []byte, 10)}
	stale.handleMessage(Message{Type: MsgAdminStatus})
	if called != 1 || store.gets != gets {
		t.Fatal("replaced socket entered account recovery")
	}
	store.finishErr = nil
	current.handleMessage(Message{Type: MsgAdminStatus})
	if called != 2 || len(adminPending.accounts) != 0 {
		t.Fatal("recovered target command was not admitted")
	}
}
