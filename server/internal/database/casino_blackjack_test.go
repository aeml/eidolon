package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestBlackjackTransferBoundsAndCurrency(t *testing.T) {
	op := BlackjackTransfer{ID: "casino:round:stake", PlayerID: "player-alice", Currency: "gold", Amount: -100, NextState: []byte(`{"phase":"playing"}`)}
	if err := op.Validate(); err != nil {
		t.Fatal(err)
	}
	for _, currency := range []string{"", "vip", "resonance", "Gold"} {
		bad := op
		bad.Currency = currency
		if bad.Validate() == nil {
			t.Fatal("wrong currency accepted", currency)
		}
	}
	for _, amount := range []int{-501, 0, 8001, -int(^uint(0)>>1) - 1} {
		bad := op
		bad.Amount = amount
		if bad.Validate() == nil {
			t.Fatal("unsafe transfer amount", amount)
		}
	}
}

func TestBlackjackMongoIntentReplayAndConcurrentTransitions(t *testing.T) {
	uri := os.Getenv("EIDOLON_CASINO_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable casino Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires disposable loopback Mongo")
	}
	repo, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	tableID := fmt.Sprintf("casino-test-%d", time.Now().UnixNano())
	defer repo.blackjackTables.DeleteOne(context.Background(), bson.M{"_id": tableID})
	initial := []byte(`{"phase":"betting","round":"one"}`)
	r, err := repo.CreateBlackjackTable(tableID, initial)
	if err != nil {
		t.Fatal(err)
	}
	op := BlackjackTransfer{ID: "casino:round-one:stake", PlayerID: "player-alice", Currency: "gold", Amount: -100, NextState: []byte(`{"phase":"playing","round":"one"}`)}
	pending, err := repo.BeginBlackjackTransfer(tableID, r.Version, op)
	if err != nil || string(pending.State) != string(initial) {
		t.Fatal("candidate visible before Gold acceptance", err)
	}
	retry, err := repo.BeginBlackjackTransfer(tableID, r.Version, op)
	if err != nil || retry.Version != pending.Version {
		t.Fatal("intent retry not idempotent", err)
	}
	changed := op
	changed.Amount = -200
	if _, err := repo.BeginBlackjackTransfer(tableID, r.Version, changed); err == nil {
		t.Fatal("conflicting intent accepted")
	}
	if _, err := repo.AdvanceBlackjackTable(tableID, pending.Version, op.NextState); !errors.Is(err, ErrBlackjackTableConflict) {
		t.Fatal("turn crossed pending funds", err)
	}
	// A fresh repository connection sees the same recoverable intent.
	reopened, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close(context.Background())
	recovered, err := reopened.GetBlackjackTable(tableID)
	if err != nil || recovered.Pending == nil || recovered.Pending.ID != op.ID {
		t.Fatal("restart lost pending transfer", err)
	}
	accepted, err := reopened.ResolveBlackjackTransfer(*recovered, true)
	if err != nil || accepted.Pending != nil || string(accepted.State) != string(op.NextState) {
		t.Fatal("accepted state not committed", err)
	}
	if replay, err := repo.ResolveBlackjackTransfer(*pending, true); err != nil || replay.Version != accepted.Version {
		t.Fatal("ambiguous acknowledgement not recoverable", err)
	}
	if _, err := repo.ResolveBlackjackTransfer(*pending, false); err == nil {
		t.Fatal("accepted stake later aborted")
	}

	// Two independent writers at the same version cannot both advance/deal.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := repo.AdvanceBlackjackTable(tableID, accepted.Version, []byte(fmt.Sprintf(`{"turn":%d}`, i)))
			results <- err
		}(i)
	}
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		} else if !errors.Is(err, ErrBlackjackTableConflict) {
			t.Fatal(err)
		}
	}
	if successes != 1 {
		t.Fatal("concurrent table writes both won", successes)
	}
	current, err := repo.GetBlackjackTable(tableID)
	if err != nil {
		t.Fatal(err)
	}
	op.ID = "casino:round-one:unfunded"
	unfunded, err := repo.BeginBlackjackTransfer(tableID, current.Version, op)
	if err != nil {
		t.Fatal(err)
	}
	aborted, err := repo.ResolveBlackjackTransfer(*unfunded, false)
	if err != nil || string(aborted.State) != string(current.State) || aborted.LastAccepted {
		t.Fatal("insufficient funds changed round", err)
	}
}
