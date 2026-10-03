package database

import (
	"errors"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

func groundStoreDrop() GroundItemRecord {
	op := groundOperationFixture(GroundItemDrop)
	op.CreatedAt = time.Now().Add(-2 * time.Second).UTC().Truncate(time.Millisecond)
	op.Fingerprint, _ = GroundItemFingerprint(op)
	return GroundItemRecord{GroundItemOperation: op, State: GroundItemPending}
}

func groundStoreCompleted(record GroundItemRecord) GroundItemRecord {
	record.State = GroundItemComplete
	if record.Kind == GroundItemDrop {
		record.AvailableAt = record.CreatedAt.Add(time.Second)
		record.ExpiresAt = record.AvailableAt.Add(time.Minute)
	}
	return record
}

func groundStorePickup(previous GroundItemRecord) GroundItemOperation {
	op := groundOperationFixture(GroundItemPickup)
	op.ID = GroundItemOperationID("pickup-intent")
	op.LootTime, op.LootCreatedAt = previous.AvailableAt, previous.AvailableAt
	op.CreatedAt = previous.AvailableAt.Add(time.Second)
	op.Fingerprint, _ = GroundItemFingerprint(op)
	return op
}

func groundMockDB(mt *mtest.T) *DB {
	unsafe, err := mt.Coll.Clone(options.Collection().SetReadPreference(readpref.SecondaryPreferred()).SetWriteConcern(writeconcern.New(writeconcern.W(0))))
	if err != nil {
		mt.Fatal(err)
	}
	return &DB{groundItemOperations: unsafe, users: unsafe}
}

func groundAssertConcerns(mt *mtest.T) {
	mt.Helper()
	tradeAssertConcerns(mt)
	for _, event := range mt.GetAllStartedEvents() {
		if event.CommandName == "find" || event.CommandName == "aggregate" {
			if pref, err := event.Command.LookupErr("$readPreference"); err == nil {
				// mtest's Single mock deployment encodes configured Primary as
				// primaryPreferred (driver operation.createReadPref). Assert the
				// unsafe-vs-cloned wire modes separately; never allow secondary.
				mode := pref.Document().Lookup("mode").StringValue()
				if mode != "primary" && mode != "primaryPreferred" {
					mt.Fatal("ground operation/receipt inherited unsafe read preference", event.Command)
				}
			}
		}
		if event.CommandName == "aggregate" && event.Command.Lookup("readConcern").Document().Lookup("level").StringValue() != "majority" {
			mt.Fatal("projection query did not require majority-committed records")
		}
	}
}

func TestGroundItemStoreOverridesUnsafeReadPreference(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("same mock topology", func(mt *mtest.T) {
		db := groundMockDB(mt)
		mt.AddMockResponses(tradeResponse(mt), tradeResponse(mt), tradeResponse(mt))
		// Contrast identical reads on the same Single mock deployment: the
		// configured secondary preference must not leak into the durable clone.
		db.groundItemOperations.FindOne(mt.Context(), bson.M{})
		if _, err := db.GetGroundItemOperation(GroundItemOperationID("read-preference")); err != nil {
			mt.Fatal(err)
		}
		db.groundItemOperations.FindOne(mt.Context(), bson.M{})
		events := mt.GetAllStartedEvents()
		if len(events) != 3 {
			mt.Fatal("missing read commands", len(events))
		}
		for index, want := range []string{"secondaryPreferred", "primaryPreferred", "secondaryPreferred"} {
			if got := events[index].Command.Lookup("$readPreference").Document().Lookup("mode").StringValue(); got != want {
				mt.Fatal("durable clone changed the source preference or inherited secondary reads", index, got, want)
			}
		}
	})
}

func TestGroundItemStoreFreezesSameIdentityAndUnknownPrepare(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, mode := range []string{"insert", "retry", "terminal", "changed", "busy", "unknown"} {
		mt.Run(mode, func(mt *mtest.T) {
			db, pending := groundMockDB(mt), groundStoreDrop()
			op := pending.GroundItemOperation
			duplicate := mtest.CreateWriteErrorsResponse(mtest.WriteError{Code: 11000, Message: "reserved actor or loot generation"})
			switch mode {
			case "insert":
				mt.AddMockResponses(tradeResponse(mt), tradeResponse(mt), mtest.CreateSuccessResponse())
			case "retry":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, pending)))
			case "terminal":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, groundStoreCompleted(pending))))
			case "changed":
				op.X++
				op.Fingerprint, _ = GroundItemFingerprint(op)
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, pending)))
			case "busy":
				mt.AddMockResponses(tradeResponse(mt), tradeResponse(mt), duplicate, tradeResponse(mt))
			case "unknown":
				mt.AddMockResponses(tradeResponse(mt), tradeResponse(mt), mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "prepare acknowledgement lost"}))
			}
			stored, err := db.PrepareGroundItemOperation(op)
			switch mode {
			case "changed":
				if !errors.Is(err, ErrGroundItemConflict) || stored != nil {
					mt.Fatal("retained intent was replaced", stored, err)
				}
			case "busy":
				if !errors.Is(err, ErrGroundItemBusy) || stored != nil {
					mt.Fatal("actor/loot contention was not fenced", stored, err)
				}
			case "unknown":
				if err == nil || stored != nil || len(mt.GetAllStartedEvents()) != 3 {
					mt.Fatal("ambiguous prepare was acknowledged or compensated", stored, err)
				}
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, pending)))
				stored, err = db.GetGroundItemOperation(op.ID)
				if err != nil || stored == nil || stored.Fingerprint != pending.Fingerprint {
					mt.Fatal("same-ID prepare reconciliation failed", stored, err)
				}
			default:
				if err != nil || stored == nil || stored.Fingerprint != op.Fingerprint || !stored.CreatedAt.Equal(pending.CreatedAt) {
					mt.Fatal("first frozen plan was not retained", stored, err)
				}
			}
			groundAssertConcerns(mt)
		})
	}
}

func TestGroundItemStorePickupChainsCannotForkOrRenewLifetime(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, mode := range []string{"valid", "pending", "skipped-generation", "changed-before", "changed-birth", "new-enemy-loot"} {
		mt.Run(mode, func(mt *mtest.T) {
			db := groundMockDB(mt)
			previous := groundStoreCompleted(groundStoreDrop())
			op := groundStorePickup(previous)
			mt.AddMockResponses(tradeResponse(mt))
			switch mode {
			case "pending":
				previous = groundStoreDrop()
			case "skipped-generation":
				op.Generation++
				op.Fingerprint, _ = GroundItemFingerprint(op)
			case "changed-before":
				op.X++
				op.Fingerprint, _ = GroundItemFingerprint(op)
			case "changed-birth":
				op.LootCreatedAt = op.LootCreatedAt.Add(time.Millisecond)
				op.Fingerprint, _ = GroundItemFingerprint(op)
			}
			if mode == "new-enemy-loot" {
				mt.AddMockResponses(tradeResponse(mt))
			} else {
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, previous)))
			}
			if mode == "valid" || mode == "new-enemy-loot" {
				mt.AddMockResponses(mtest.CreateSuccessResponse())
			}
			stored, err := db.PrepareGroundItemOperation(op)
			if mode == "valid" || mode == "new-enemy-loot" {
				if err != nil || stored == nil || !stored.AvailableAt.Equal(previous.AvailableAt) || !stored.ExpiresAt.Equal(previous.ExpiresAt) || stored.GroundPayload() != "" {
					mt.Fatal("pickup renewed the lifetime or became free loot", stored, err)
				}
			} else if stored != nil || err == nil || len(mt.GetAllStartedEvents()) != 2 {
				mt.Fatal("invalid continuation inserted another generation", stored, err)
			}
			groundAssertConcerns(mt)
		})
	}
}

func TestGroundItemStoreCompletionRequiresActualSavedReceiptAndRetainsFirstAvailability(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, mode := range []string{"confirmed", "absent", "wrong", "lost-ack", "terminal", "unconfirmed-read"} {
		mt.Run(mode, func(mt *mtest.T) {
			db := groundMockDB(mt)
			pending := groundStoreDrop()
			complete := groundStoreCompleted(pending)
			if mode == "terminal" {
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, complete)))
			} else {
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, pending)))
				character := &Character{Name: pending.Username, ItemDeliveryReceipts: map[string]string{pending.ID: pending.Fingerprint}}
				if mode == "wrong" {
					character.ItemDeliveryReceipts[pending.ID] = "other-effect"
				}
				if mode == "absent" {
					mt.AddMockResponses(tradeResponse(mt))
				} else {
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: pending.Username, Characters: []*Character{character}})))
				}
				if mode == "confirmed" || mode == "unconfirmed-read" {
					mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
					result := complete
					if mode == "unconfirmed-read" {
						result = pending
					}
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, result)))
				} else if mode == "lost-ack" {
					mt.AddMockResponses(mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "completion acknowledgement lost"}))
				}
			}
			stored, err := db.CompleteGroundItemOperation(pending.ID, pending.Fingerprint)
			if mode == "confirmed" || mode == "terminal" {
				if err != nil || stored == nil || stored.State != GroundItemComplete || !stored.AvailableAt.Equal(complete.AvailableAt) {
					mt.Fatal("saved receipt did not confirm the retained first publication", stored, err)
				}
			} else if err == nil || stored != nil {
				mt.Fatal("absent/wrong/unknown receipt acknowledged completion", stored, err)
			}
			if mode == "lost-ack" {
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, complete)))
				stored, err = db.CompleteGroundItemOperation(pending.ID, pending.Fingerprint)
				if err != nil || stored == nil || !stored.AvailableAt.Equal(complete.AvailableAt) {
					mt.Fatal("lost ACK renewed ground-loot availability", stored, err)
				}
			}
			groundAssertConcerns(mt)
		})
	}
}

func TestGroundItemStoreRecoveryQueriesKeepPendingLatestAndBoundPages(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("pending and projection", func(mt *mtest.T) {
		db := groundMockDB(mt)
		previous := groundStoreCompleted(groundStoreDrop())
		pickup := GroundItemRecord{GroundItemOperation: groundStorePickup(previous), State: GroundItemPending,
			AvailableAt: previous.AvailableAt, ExpiresAt: previous.ExpiresAt}
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, pickup)), tradeResponse(mt, directTradeDocument(mt.T, pickup)))
		pending, err := db.PendingGroundItemOperations(pickup.Username, previous.ID, 2)
		if err != nil || len(pending) != 1 || pending[0].ID != pickup.ID {
			mt.Fatal("cursor recovery lost pending custody", pending, err)
		}
		projections, err := db.GroundItemProjectionPage("earlier-loot", time.Now(), 2)
		if err != nil || len(projections) != 1 || projections[0].State != GroundItemPending || projections[0].GroundPayload() != "" {
			mt.Fatal("pending latest projection became free old loot", projections, err)
		}
		for _, event := range mt.GetAllStartedEvents() {
			if event.CommandName == "find" && event.Command.Lookup("limit").Int64() != 2 {
				mt.Fatal("recovery query lost its row bound")
			}
		}
		groundAssertConcerns(mt)
	})
}
