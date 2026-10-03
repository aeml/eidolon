package database

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

// Driver command proof, not replica-set failover proof. Explicitly hostile
// inherited defaults must not weaken saved entitlement/receipt decisions.
func TestWeeklyRaidStoreOverridesUnsafeConnectionConcerns(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, operation := range []string{"prepare", "prepare retry", "prepare unknown", "pending", "defer", "finish", "finish unknown", "legacy claim", "status", "outbox", "character"} {
		mt.Run(operation, func(mt *mtest.T) {
			unsafe, err := mt.Coll.Clone(options.Collection().SetReadPreference(readpref.SecondaryPreferred()).SetWriteConcern(writeconcern.New(writeconcern.W(0))))
			if err != nil {
				mt.Fatal(err)
			}
			strong, err := durableWeeklyRaidCollection(unsafe)
			if err != nil || strong == nil {
				mt.Fatal("durable weekly collection unavailable", err)
			}
			db := &DB{users: unsafe, raidLockouts: unsafe}
			at := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
			entry := WeeklyRaidLockout{PlayerID: "player-alice", Week: CurrentRaidWeek(at), CompletedAt: at, DeliveryPending: true}
			unknown := mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "acknowledgement lost"})
			switch operation {
			case "prepare", "prepare retry", "prepare unknown":
				if operation == "prepare retry" {
					mt.AddMockResponses(mtest.CreateWriteErrorsResponse(mtest.WriteError{Code: 11000, Message: "existing lockout"}), tradeResponse(mt, directTradeDocument(mt.T, entry)))
				} else if operation == "prepare unknown" {
					mt.AddMockResponses(unknown)
				} else {
					mt.AddMockResponses(mtest.CreateSuccessResponse())
				}
				result, err := db.PrepareWeeklyRaidReward(entry.PlayerID, at)
				if operation == "prepare unknown" {
					if err == nil || result != nil {
						mt.Fatal("unknown entitlement write pretended confirmed", result, err)
					}
				} else if err != nil || result == nil || result.Week != entry.Week || !result.DeliveryPending {
					mt.Fatal("confirmed entitlement was lost", result, err)
				}
			case "pending":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, entry)))
				entries, err := db.PendingWeeklyRaidRewards()
				if err != nil || len(entries) != 1 || entries[0].Week != entry.Week {
					mt.Fatal(entries, err)
				}
			case "defer", "finish", "finish unknown":
				if operation == "finish unknown" {
					mt.AddMockResponses(unknown)
				} else {
					mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
				}
				if operation == "defer" {
					err = db.DeferWeeklyRaidReward(entry.PlayerID, entry.Week, at.Add(time.Minute))
				} else {
					err = db.FinishWeeklyRaidReward(entry.PlayerID, entry.Week)
				}
				if (operation == "finish unknown") != (err != nil) {
					mt.Fatal("wrong completion acknowledgement", err)
				}
			case "legacy claim":
				mt.AddMockResponses(mtest.CreateSuccessResponse())
				claimed, err := db.ClaimWeeklyRaidReward(entry.PlayerID, at)
				if err != nil || !claimed {
					mt.Fatal(err)
				}
			case "status":
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, entry)))
				claimed, err := db.HasWeeklyRaidReward(entry.PlayerID, at)
				if err != nil || !claimed {
					mt.Fatal(err)
				}
			case "outbox", "character":
				character := &Character{Name: "alice", Gold: 123,
					WeeklyRaidCompletions: map[string]time.Time{entry.Week: at}, WeeklyRaidRewardReceipts: map[string]bool{entry.Week: true}}
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: "alice", Characters: []*Character{character}})))
				if operation == "outbox" {
					entries, err := db.UnpreparedWeeklyRaidRewards()
					if err != nil || len(entries) != 1 || entries[0].Week != entry.Week {
						mt.Fatal(entries, err)
					}
				} else {
					saved, err := db.GetWeeklyRaidCharacter("alice", "alice")
					if err != nil || saved == nil || !saved.WeeklyRaidRewardReceipts[entry.Week] {
						mt.Fatal("strong hydration lost saved receipt", err)
					}
				}
			}
			tradeAssertConcerns(mt)
			for _, event := range mt.GetAllStartedEvents() {
				if preference, found := event.Command.LookupErr("$readPreference"); found == nil {
					// The driver's Single mock topology encodes configured Primary
					// as primaryPreferred. No secondary or nearest mode is allowed.
					mode := preference.Document().Lookup("mode").StringValue()
					if mode != "primary" && mode != "primaryPreferred" {
						mt.Fatal("weekly operation inherited stale-secondary preference", event.Command)
					}
				}
			}
		})
	}
}
