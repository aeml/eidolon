package database

import (
	"encoding/json"
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func removalMockDB(collection *mongo.Collection) *DB {
	return &DB{reports: collection, users: collection, auctions: collection, auctionBids: collection, directTradeOperations: collection,
		guilds: collection, guildInvites: collection, guildBankOperations: collection, groundItemOperations: collection, dungeonRoomRewards: collection,
		bossVictories: collection, raidLockouts: collection, adminOperations: collection, friendships: collection, pvpProfiles: collection, blackjackTables: collection}
}

func TestRemovalReviewCaseFencesBoundedPresenceAndNoDeletionAuthority(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"present", "absent", "case-missing", "malformed-owner", "store-error", "changed-case"} {
		mt.Run(scenario, func(mt *mtest.T) {
			db := removalMockDB(mt.Coll)
			ns := mt.DB.Name() + "." + mt.Coll.Name()
			caseRow := bson.D{{Key: "owner", Value: "private-owner"}}
			if scenario == "malformed-owner" {
				caseRow[0].Value = strings.Repeat("x", 129)
			}
			if scenario == "case-missing" {
				mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch))
			} else {
				mt.AddMockResponses(mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, caseRow))
			}
			for i := 0; i < 15; i++ {
				response := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "present", Value: true}})
				if scenario == "absent" {
					response = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
				}
				if scenario == "store-error" && i == 2 {
					response = mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 2, Message: "private-diagnostic"})
				}
				mt.AddMockResponses(response)
			}
			last := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, caseRow)
			if scenario == "changed-case" {
				last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			mt.AddMockResponses(last)
			query := RemovalReviewQuery{ReportID: "0123456789abcdef01234567", ExpectedStatus: "open"}
			result, err := db.ReadRemovalReview(query)
			valid := scenario == "present" || scenario == "absent"
			if valid {
				if err != nil || result.Owner != "private-owner" || len(result.References) != 14 || result.AccountPresent != (scenario == "present") || result.RemovalAuthorized || result.RemovalSupported || len(result.RequiredReview) != 6 {
					mt.Fatal("presence became clearance or result lost", err)
				}
				for _, check := range result.References {
					if check.ReferencePresent != (scenario == "present") {
						mt.Fatal("presence flag changed")
					}
				}
				data, _ := json.Marshal(result)
				if strings.Contains(string(data), "private-owner") {
					mt.Fatal("private owner binding marshalled")
				}
			} else if err != ErrRemovalReviewUnavailable || result.ReportID != "" {
				mt.Fatal("failed case returned partial dependencies")
			}
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName != "aggregate" {
					mt.Fatal("dependency review executed a mutation", event.CommandName)
				}
				stages, _ := event.Command.Lookup("pipeline").Array().Values()
				if len(stages) == 3 {
					limit := stages[1].Document().Lookup("$limit")
					if limit.Int32() != 1 || stages[2].Document().Lookup("$project").Document().Lookup("present").Document().Lookup("$literal").Boolean() != true {
						mt.Fatal("presence output no longer constant/bounded")
					}
				} else if len(stages) != 4 {
					mt.Fatal("unexpected case projection")
				}
			}
		})
	}
}
