package database

import (
	"errors"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

func roomRewardMockDB(mt *mtest.T) *DB {
	unsafe, err := mt.Coll.Clone(options.Collection().SetReadPreference(readpref.SecondaryPreferred()).SetWriteConcern(writeconcern.New(writeconcern.W(0))))
	if err != nil {
		mt.Fatal(err)
	}
	return &DB{dungeonRoomRewards: unsafe, users: unsafe}
}

func roomRewardAssertConcerns(mt *mtest.T) {
	mt.Helper()
	tradeAssertConcerns(mt)
	for _, event := range mt.GetAllStartedEvents() {
		if pref, err := event.Command.LookupErr("$readPreference"); err == nil {
			// The driver's Single mock deployment encodes Primary as
			// primaryPreferred. No inherited secondary/nearest mode is safe.
			mode := pref.Document().Lookup("mode").StringValue()
			if mode != "primary" && mode != "primaryPreferred" {
				mt.Fatal("room receipt/operation read inherited unsafe preference", event.Command)
			}
		}
	}
}

func TestDungeonRoomRewardStoreRetainsFirstOutcomeAndUnknownWrite(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"insert", "same outcome", "changed roll", "duplicate race", "unknown prepare"} {
		mt.Run(scenario, func(mt *mtest.T) {
			db := roomRewardMockDB(mt)
			op := dungeonRoomRewardFixture()
			stored := DungeonRoomRewardRecord{DungeonRoomRewardOperation: op, State: DungeonRoomRewardPending}
			switch scenario {
			case "insert":
				mt.AddMockResponses(tradeResponse(mt), mtest.CreateSuccessResponse())
			case "same outcome":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "changed roll":
				op.Participants = append([]DungeonRoomRewardRecipient(nil), op.Participants...)
				op.Participants[0].Gold++
				op.Fingerprint, _ = DungeonRoomRewardFingerprint(op)
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "duplicate race":
				mt.AddMockResponses(tradeResponse(mt), mtest.CreateWriteErrorsResponse(mtest.WriteError{Code: 11000, Message: "retained cohort"}), tradeResponse(mt, directTradeDocument(mt.T, stored)))
			case "unknown prepare":
				mt.AddMockResponses(tradeResponse(mt), mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "ack lost"}))
			}
			result, err := db.PrepareDungeonRoomReward(op)
			if scenario == "changed roll" {
				if !errors.Is(err, ErrDungeonRoomRewardConflict) || result != nil {
					mt.Fatal("changed first roll was accepted", err)
				}
			} else if scenario == "unknown prepare" {
				if err == nil || result != nil {
					mt.Fatal("unknown prepare was described as accepted", result, err)
				}
			} else if err != nil || result == nil || result.Fingerprint != stored.Fingerprint || result.State != DungeonRoomRewardPending {
				mt.Fatal("retained first cohort changed", result, err)
			}
			roomRewardAssertConcerns(mt)
		})
	}
}

func TestDungeonRoomRewardStoreCompletesOnlyActualSavedCohort(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"all saved", "second missing receipt", "terminal replay", "unknown completion"} {
		mt.Run(scenario, func(mt *mtest.T) {
			db := roomRewardMockDB(mt)
			op := dungeonRoomRewardFixture()
			record := DungeonRoomRewardRecord{DungeonRoomRewardOperation: op, State: DungeonRoomRewardPending}
			if scenario == "terminal replay" {
				record.State = DungeonRoomRewardComplete
			}
			mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, record)))
			if scenario != "terminal replay" {
				for _, participant := range op.Participants {
					character := &Character{Name: participant.Username, ItemDeliveryReceipts: map[string]string{op.ID: op.Fingerprint}}
					if scenario == "second missing receipt" && participant.Username == "bob" {
						character.ItemDeliveryReceipts = nil
					}
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: participant.Username, Characters: []*Character{character}})))
				}
				if scenario == "unknown completion" {
					mt.AddMockResponses(mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "terminal ack lost"}))
				} else if scenario == "all saved" {
					mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
				}
			}
			result, err := db.CompleteDungeonRoomReward(op.ID, op.Fingerprint)
			if scenario == "second missing receipt" {
				if !errors.Is(err, ErrDungeonRoomRewardUnconfirmed) || result != nil {
					mt.Fatal("one saved recipient retired the unsaved cohort", err)
				}
			} else if scenario == "unknown completion" {
				if err == nil || result != nil {
					mt.Fatal("unknown completion guessed success", err)
				}
			} else if err != nil || result == nil || result.State != DungeonRoomRewardComplete {
				mt.Fatal("confirmed cohort completion was lost", result, err)
			}
			roomRewardAssertConcerns(mt)
		})
	}
}

func TestDungeonRoomRewardStoreRecoveryCursorAndParticipantScope(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("bounded scoped pending query", func(mt *mtest.T) {
		db := roomRewardMockDB(mt)
		op := dungeonRoomRewardFixture()
		record := DungeonRoomRewardRecord{DungeonRoomRewardOperation: op, State: DungeonRoomRewardPending}
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, record)))
		page, err := db.PendingDungeonRoomRewards("bob", "", 50)
		if err != nil || len(page) != 1 || page[0].ID != op.ID {
			mt.Fatal("pending cohort missing for the unsaved participant", page, err)
		}
		for _, event := range mt.GetAllStartedEvents() {
			if event.CommandName == "find" && (event.Command.Lookup("limit").Int64() != 50 || event.Command.Lookup("filter").Document().Lookup("participants.username").StringValue() != "bob") {
				mt.Fatal("room recovery query lost participant/size bounds", event.Command)
			}
		}
		roomRewardAssertConcerns(mt)
	})
}
