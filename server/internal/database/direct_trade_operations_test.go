package database

import (
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

// Driver mock responses exercise the production commands without connecting to
// Mongo. They do not prove actual index enforcement, persistence or failover.
func directTradeDocument(t *testing.T, value any) bson.D {
	t.Helper()
	encoded, err := bson.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var result bson.D
	if err := bson.Unmarshal(encoded, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func tradeResponse(mt *mtest.T, documents ...bson.D) bson.D {
	return mtest.CreateCursorResponse(0, mt.DB.Name()+"."+mt.Coll.Name(), mtest.FirstBatch, documents...)
}

func tradeMockDB(mt *mtest.T) *DB {
	return &DB{directTradeOperations: mt.Coll, users: mt.Coll}
}

func tradeAssertConcerns(mt *mtest.T) {
	mt.Helper()
	for _, event := range mt.GetAllStartedEvents() {
		switch event.CommandName {
		case "insert", "update", "createIndexes":
			concern := event.Command.Lookup("writeConcern").Document()
			if concern.Lookup("w").StringValue() != "majority" || !concern.Lookup("j").Boolean() {
				mt.Fatalf("%s lacks journaled majority acknowledgement: %v", event.CommandName, event.Command)
			}
		case "find":
			if event.Command.Lookup("readConcern").Document().Lookup("level").StringValue() != "majority" {
				mt.Fatalf("durable decision/receipt read lacks majority concern: %v", event.Command)
			}
		}
	}
}

func TestDirectTradeStoreFreezesFirstDecisionAndUnknownOutcome(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, outcome := range []string{"insert", "retry", "terminal replay", "other account busy", "changed decision", "unknown write"} {
		mt.Run(outcome, func(mt *mtest.T) {
			db := tradeMockDB(mt)
			op, _ := directTradeFixture(mt.T, DirectTradeSettle)
			stored := op
			duplicate := mtest.CreateWriteErrorsResponse(mtest.WriteError{Code: 11000, Message: "duplicate reservation"})
			switch outcome {
			case "insert":
				mt.AddMockResponses(mtest.CreateSuccessResponse())
			case "retry":
				op.CreatedAt = op.CreatedAt.Add(time.Hour)
				mt.AddMockResponses(duplicate, tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "terminal replay":
				stored.State = DirectTradeComplete
				mt.AddMockResponses(duplicate, tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "other account busy":
				mt.AddMockResponses(duplicate, tradeResponse(mt))
			case "changed decision":
				op.Decision = DirectTradeCancel
				op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
				mt.AddMockResponses(duplicate, tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "unknown write":
				mt.AddMockResponses(mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "ack lost"}))
			}
			result, err := db.PrepareDirectTradeOperation(op)
			switch outcome {
			case "other account busy":
				if !errors.Is(err, ErrDirectTradeBusy) || result != nil {
					mt.Fatal("another pending trade was not fenced", result, err)
				}
			case "changed decision":
				if !errors.Is(err, ErrDirectTradeConflict) || result != nil {
					mt.Fatal("first decision was overwritten", result, err)
				}
			case "unknown write":
				if err == nil || result != nil || len(mt.GetAllStartedEvents()) != 1 {
					mt.Fatal("unknown write was treated as success or compensated", result, err)
				}
				// Reconciliation re-reads the SAME ID, preserving a committed plan.
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, stored)))
				result, err = db.GetDirectTradeOperation(op.ID)
				if err != nil || result == nil || result.Fingerprint != stored.Fingerprint {
					mt.Fatal("same-ID reconciliation failed", result, err)
				}
			default:
				if err != nil || result == nil || result.Fingerprint != stored.Fingerprint || result.State != stored.State || !result.CreatedAt.Equal(stored.CreatedAt) {
					mt.Fatal("first exact durable plan/outcome changed", result, err)
				}
			}
			tradeAssertConcerns(mt)
		})
	}
}

func TestDirectTradeStoreCompletionRequiresBothSavedReceipts(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, outcome := range []string{"both saved", "first unsaved", "second unsaved", "missing character", "changed receipt", "unknown state", "wrong fingerprint", "complete replay", "completion ack lost"} {
		mt.Run(outcome, func(mt *mtest.T) {
			db := tradeMockDB(mt)
			op, characters := directTradeFixture(mt.T, DirectTradeSettle)
			for index, character := range characters {
				if outcome == "first unsaved" && index == 0 || outcome == "second unsaved" && index == 1 {
					continue
				}
				if _, err := ApplyDirectTradeCharacterDecision(op.Participants[index].Username, character, op); err != nil {
					mt.Fatal(err)
				}
			}
			if outcome == "changed receipt" {
				state, _ := DecodeDirectTradeState(characters[1].DirectTradeState)
				state.LastOperationRevision++
				state.Revision++
				characters[1].DirectTradeState, _ = EncodeDirectTradeState(*state)
			}
			if outcome == "unknown state" {
				characters[1].DirectTradeState, _ = bson.Marshal(bson.M{"version": 9, "revision": 100})
			}
			fingerprint := op.Fingerprint
			if outcome == "wrong fingerprint" {
				fingerprint = "other"
			}
			if outcome == "complete replay" {
				op.State = DirectTradeComplete
			}
			mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, op)))
			if outcome != "wrong fingerprint" && outcome != "complete replay" {
				for index, character := range characters {
					if outcome == "missing character" && index == 0 {
						mt.AddMockResponses(tradeResponse(mt))
						break
					}
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: op.Participants[index].Username, Characters: []*Character{character}})))
					if outcome == "first unsaved" && index == 0 {
						break
					}
				}
			}
			if outcome == "both saved" {
				mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
				completed := op
				completed.State = DirectTradeComplete
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, completed)))
			}
			if outcome == "completion ack lost" {
				mt.AddMockResponses(mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "ack lost"}))
			}
			result, err := db.CompleteDirectTradeOperation(op.ID, fingerprint)
			if outcome == "both saved" || outcome == "complete replay" {
				if err != nil || result == nil || result.State != DirectTradeComplete {
					mt.Fatal("confirmed completion failed", result, err)
				}
			} else if err == nil || result != nil {
				mt.Fatal("unproven receipt/unknown completion acknowledged", result, err)
			}
			updates := 0
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName == "update" {
					updates++
					update := event.Command.Lookup("updates").Array().Index(0).Value().Document()
					filter := update.Lookup("q").Document()
					if filter.Lookup("_id").StringValue() != op.ID || filter.Lookup("fingerprint").StringValue() != op.Fingerprint || filter.Lookup("state").StringValue() != DirectTradePending ||
						update.Lookup("u").Document().Lookup("$set").Document().Lookup("state").StringValue() != DirectTradeComplete {
						mt.Fatal("completion changed the plan or lacked a frozen-plan CAS", event.Command)
					}
				}
			}
			wantUpdates := 0
			if outcome == "both saved" || outcome == "completion ack lost" {
				wantUpdates = 1
			}
			if updates != wantUpdates {
				mt.Fatalf("completion updates=%d want=%d", updates, wantUpdates)
			}
			if outcome == "complete replay" && len(mt.GetAllStartedEvents()) != 1 {
				mt.Fatal("terminal replay loaded participants or rewrote state")
			}
			if outcome == "completion ack lost" {
				completed := op
				completed.State = DirectTradeComplete
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, completed)))
				result, err = db.CompleteDirectTradeOperation(op.ID, op.Fingerprint)
				if err != nil || result == nil || result.State != DirectTradeComplete {
					mt.Fatal("lost ACK did not reconcile the terminal ID", result, err)
				}
			}
			tradeAssertConcerns(mt)
		})
	}
}

func TestDirectTradeStoreRecoveryBoundsAndIndexes(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("bounded account recovery", func(mt *mtest.T) {
		db := tradeMockDB(mt)
		op, _ := directTradeFixture(mt.T, DirectTradeSettle)
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, op)))
		pending, err := db.PendingDirectTradeOperations("bob", 50)
		if err != nil || len(pending) != 1 || pending[0].ID != op.ID {
			mt.Fatal("second participant cannot find the pending decision", pending, err)
		}
		command := mt.GetStartedEvent().Command
		filter := command.Lookup("filter").Document()
		if filter.Lookup("state").StringValue() != DirectTradePending || filter.Lookup("participants.username").StringValue() != "bob" || command.Lookup("limit").Int64() != 50 || command.Lookup("sort").Document().Lookup("_id").Int32() != 1 {
			mt.Fatal("unbounded or wrong-account recovery query", command)
		}
		mt.ClearEvents()
		for _, limit := range []int{0, -1, 51, 1_000_000} {
			if _, err := db.PendingDirectTradeOperations("", limit); err == nil {
				mt.Fatal("invalid recovery limit accepted", limit)
			}
		}
		if _, err := db.GetDirectTradeOperation("invalid"); err == nil || len(mt.GetAllStartedEvents()) != 0 {
			mt.Fatal("invalid lookup reached storage")
		}
	})
	mt.Run("corrupt recovery record", func(mt *mtest.T) {
		db := tradeMockDB(mt)
		op, _ := directTradeFixture(mt.T, DirectTradeSettle)
		op.State = DirectTradeComplete
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, op)))
		if _, err := db.PendingDirectTradeOperations("", 1); err == nil {
			mt.Fatal("terminal record accepted as pending recovery work")
		}
	})
	mt.Run("both accounts reserved without TTL", func(mt *mtest.T) {
		db := tradeMockDB(mt)
		mt.AddMockResponses(mtest.CreateSuccessResponse())
		if err := applyDirectTradeOperationIndexes(mt.Context(), db); err != nil {
			mt.Fatal(err)
		}
		command := mt.GetStartedEvent().Command
		indexes, _ := command.Lookup("indexes").Array().Values()
		if len(indexes) != 2 {
			mt.Fatal("unexpected trade indexes", command)
		}
		reservation := indexes[0].Document()
		if !reservation.Lookup("unique").Boolean() || reservation.Lookup("key").Document().Lookup("participants.username").Int32() != 1 || reservation.Lookup("partialFilterExpression").Document().Lookup("state").StringValue() != DirectTradePending {
			mt.Fatal("index does not reserve both pending participants", command)
		}
		for _, index := range indexes {
			if _, err := index.Document().LookupErr("expireAfterSeconds"); err == nil {
				mt.Fatal("terminal identities must not expire")
			}
		}
		tradeAssertConcerns(mt)
	})
}
