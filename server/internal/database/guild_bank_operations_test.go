package database

import (
	"context"
	"errors"
	"math"
	"os"
	"sync"
	"testing"
	"time"
)

func bankOperationFixture(username, requestID string) GuildBankOperation {
	op := GuildBankOperation{Version: 1, Username: username, PlayerID: "player-" + username,
		CharacterName: username, GuildID: "guild-" + username, RequestID: requestID,
		Action: GuildBankDepositGold, Gold: 500, State: GuildBankPending,
		CreatedAt: time.Now().UTC().Truncate(time.Millisecond)}
	op.ID = GuildBankOperationID(username, requestID)
	op.Fingerprint = GuildBankOperationFingerprint(op)
	return op
}

func TestGuildBankOperationValidatesExactTypedIntent(t *testing.T) {
	for _, action := range []string{GuildBankDepositGold, GuildBankWithdrawGold, GuildBankDepositItem, GuildBankWithdrawItem} {
		op := bankOperationFixture("alice", "request_1234567890")
		op.Action = action
		if action == GuildBankDepositItem || action == GuildBankWithdrawItem {
			op.Gold, op.ItemPayload = 0, `{"id":"earned-blade","stack":1,"stats":{"damage":23}}`
		}
		op.Fingerprint = GuildBankOperationFingerprint(op)
		if err := op.Validate(); err != nil {
			t.Fatalf("valid %s intent rejected: %v", action, err)
		}
	}
	for name, mutate := range map[string]func(*GuildBankOperation){
		"version":                     func(op *GuildBankOperation) { op.Version = 0 },
		"account":                     func(op *GuildBankOperation) { op.Username = "" },
		"player identity":             func(op *GuildBankOperation) { op.PlayerID = "player-bob" },
		"character":                   func(op *GuildBankOperation) { op.CharacterName = "" },
		"guild":                       func(op *GuildBankOperation) { op.GuildID = "" },
		"negative guild revision":     func(op *GuildBankOperation) { op.GuildVersion = -1 },
		"guild revision overflow":     func(op *GuildBankOperation) { op.GuildVersion = math.MaxInt },
		"negative character revision": func(op *GuildBankOperation) { op.CharacterBankRevision = -1 },
		"character revision overflow": func(op *GuildBankOperation) { op.CharacterBankRevision = math.MaxInt64 },
		"request identity":            func(op *GuildBankOperation) { op.RequestID = "short" },
		"operation identity":          func(op *GuildBankOperation) { op.ID = GuildBankOperationID("bob", op.RequestID) },
		"timestamp":                   func(op *GuildBankOperation) { op.CreatedAt = time.Time{} },
		"state":                       func(op *GuildBankOperation) { op.State = "unknown" },
		"empty gold":                  func(op *GuildBankOperation) { op.Gold = 0 },
		"negative gold":               func(op *GuildBankOperation) { op.Gold = -1 },
		"mixed intent":                func(op *GuildBankOperation) { op.ItemPayload = `{"id":"blade","stack":1}` },
		"action":                      func(op *GuildBankOperation) { op.Action = "grant_ep" },
		"invalid item": func(op *GuildBankOperation) {
			op.Action, op.Gold, op.ItemPayload = GuildBankDepositItem, 0, `{"stack":1}`
		},
		"zero stack": func(op *GuildBankOperation) {
			op.Action, op.Gold, op.ItemPayload = GuildBankDepositItem, 0, `{"id":"blade","stack":0}`
		},
		"personal item": func(op *GuildBankOperation) {
			op.Action, op.Gold, op.ItemPayload = GuildBankDepositItem, 0, `{"id":"chronicle-item-seed","stack":1}`
		},
	} {
		t.Run(name, func(t *testing.T) {
			op := bankOperationFixture("alice", "request_1234567890")
			mutate(&op)
			op.Fingerprint = GuildBankOperationFingerprint(op)
			if err := op.Validate(); err == nil {
				t.Fatal("invalid intent accepted")
			}
		})
	}
	op := bankOperationFixture("alice", "request_1234567890")
	op.Gold++
	if err := op.Validate(); err == nil {
		t.Fatal("changed amount retained an old valid fingerprint")
	}
	for _, mutate := range []func(*GuildBankOperation){
		func(op *GuildBankOperation) { op.GuildVersion++ },
		func(op *GuildBankOperation) { op.CharacterBankRevision++ },
	} {
		op := bankOperationFixture("alice", "request_1234567890")
		mutate(&op)
		if err := op.Validate(); err == nil {
			t.Fatal("changed revision retained an old valid fingerprint")
		}
	}
}

func TestGuildBankOperationSerializesGuildAcrossDifferentAccounts(t *testing.T) {
	db := newBankOperationTestDB(t)
	first := bankOperationFixture(uniqueID("guild-bank-one"), "request_1234567890")
	if _, err := db.PrepareGuildBankOperation(first); err != nil {
		t.Fatal(err)
	}
	second := bankOperationFixture(uniqueID("guild-bank-two"), "request_1234567890")
	second.GuildID = first.GuildID
	second.Fingerprint = GuildBankOperationFingerprint(second)
	if _, err := db.PrepareGuildBankOperation(second); !errors.Is(err, ErrGuildBankOperationBusy) {
		t.Fatalf("a different account overwrote an unsettled guild transfer: %v", err)
	}
	// Record-state test only; neither transfer has applied financial effects.
	if _, err := db.FinishGuildBankOperation(first.ID, first.Fingerprint, GuildBankRejected); err != nil {
		t.Fatal(err)
	}
	if _, err := db.PrepareGuildBankOperation(second); err != nil {
		t.Fatalf("a rejected intent permanently locked the guild: %v", err)
	}
}

func newBankOperationTestDB(t *testing.T) *DB {
	t.Helper()
	db := newFriendshipDB(t)
	if err := applyGuildBankOperationIndexes(t.Context(), db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestGuildBankOperationRetainsFirstPlanAcrossRetryAndRepositoryRestart(t *testing.T) {
	db := newBankOperationTestDB(t)
	op := bankOperationFixture(uniqueID("bank-owner"), "request_1234567890")
	stored, err := db.PrepareGuildBankOperation(op)
	if err != nil {
		t.Fatal(err)
	}
	op.CreatedAt = op.CreatedAt.Add(time.Hour)
	retry, err := db.PrepareGuildBankOperation(op)
	if err != nil || !retry.CreatedAt.Equal(stored.CreatedAt) {
		t.Fatalf("retry replaced the original decision: %+v / %v", retry, err)
	}
	changed := op
	changed.Gold++
	changed.Fingerprint = GuildBankOperationFingerprint(changed)
	if _, err := db.PrepareGuildBankOperation(changed); !errors.Is(err, ErrGuildBankOperationConflict) {
		t.Fatalf("request amount changed: %v", err)
	}
	// New DB/client drops process-only state; storage still owns the first plan.
	reopened, err := New(os.Getenv("MONGO_URI"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	loaded, err := reopened.GetGuildBankOperation(op.ID)
	if err != nil || loaded == nil || loaded.Gold != 500 || loaded.Fingerprint != stored.Fingerprint || !loaded.CreatedAt.Equal(stored.CreatedAt) {
		t.Fatalf("first plan lost on reopen: %+v / %v", loaded, err)
	}
	pending, err := reopened.PendingGuildBankOperations(op.Username, 50)
	if err != nil || len(pending) != 1 || pending[0].ID != op.ID {
		t.Fatalf("pending recovery lost intent: %+v / %v", pending, err)
	}
}

func TestGuildBankOperationSerializesAccountAndPreservesTerminalReplayIdentity(t *testing.T) {
	db := newBankOperationTestDB(t)
	op := bankOperationFixture(uniqueID("bank-terminal"), "request_1234567890")
	if _, err := db.PrepareGuildBankOperation(op); err != nil {
		t.Fatal(err)
	}
	next := bankOperationFixture(op.Username, "request_1234567891")
	if _, err := db.PrepareGuildBankOperation(next); !errors.Is(err, ErrGuildBankOperationBusy) {
		t.Fatalf("two active intents for one account: %v", err)
	}
	// This test covers record state only, not actual bank/character settlement.
	if _, err := db.FinishGuildBankOperation(op.ID, op.Fingerprint, GuildBankComplete); err != nil {
		t.Fatal(err)
	}
	if _, err := db.FinishGuildBankOperation(op.ID, op.Fingerprint, GuildBankRejected); !errors.Is(err, ErrGuildBankOperationConflict) {
		t.Fatalf("completed outcome was rewritten: %v", err)
	}
	replayed, err := db.PrepareGuildBankOperation(op)
	if err != nil || replayed.State != GuildBankComplete {
		t.Fatalf("terminal request became new pending work: %+v / %v", replayed, err)
	}
	if _, err := db.PrepareGuildBankOperation(next); err != nil {
		t.Fatalf("completed transfer prevented next request: %v", err)
	}
	pending, err := db.PendingGuildBankOperations(op.Username, 50)
	if err != nil || len(pending) != 1 || pending[0].ID != next.ID {
		t.Fatalf("terminal transfer reappeared in recovery: %+v / %v", pending, err)
	}
}

func TestGuildBankOperationConcurrentPreparationUsesOneDecision(t *testing.T) {
	db := newBankOperationTestDB(t)
	op := bankOperationFixture(uniqueID("bank-concurrent"), "request_1234567890")
	var group sync.WaitGroup
	errorsFound := make(chan error, 20)
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			stored, err := db.PrepareGuildBankOperation(op)
			if err == nil && (stored == nil || stored.Fingerprint != op.Fingerprint) {
				err = errors.New("preparation returned a different decision")
			}
			errorsFound <- err
		}()
	}
	group.Wait()
	close(errorsFound)
	for err := range errorsFound {
		if err != nil {
			t.Fatal(err)
		}
	}
	pending, err := db.PendingGuildBankOperations(op.Username, 50)
	if err != nil || len(pending) != 1 || pending[0].ID != op.ID {
		t.Fatalf("concurrent preparation duplicated intent: %+v / %v", pending, err)
	}
}

func TestGuildBankOperationUninitializedStoreAndInvalidQueriesFailClosed(t *testing.T) {
	op := bankOperationFixture("alice", "request_1234567890")
	db := &DB{}
	if _, err := db.PrepareGuildBankOperation(op); err == nil {
		t.Fatal("missing storage accepted intent")
	}
	if _, err := db.GetGuildBankOperation(op.ID); err == nil {
		t.Fatal("missing storage returned success")
	}
	for _, limit := range []int{0, 51} {
		if _, err := db.PendingGuildBankOperations("", limit); err == nil {
			t.Fatal("unbounded recovery query accepted")
		}
	}
	if _, err := db.FinishGuildBankOperation(op.ID, op.Fingerprint, "pending"); err == nil {
		t.Fatal("non-terminal outcome accepted")
	}
}
