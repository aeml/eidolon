package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerReportExportQueryBoundsAndCredentialResetFence(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"valid", "oversized", "wrong-owner", "wrong-order", "reset-after-read", "empty"} {
		mt.Run(scenario, func(mt *mtest.T) {
			ns := mt.DB.Name() + "." + mt.Coll.Name()
			proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
			id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
			owner := "owner"
			if scenario == "wrong-owner" {
				owner = "another-owner"
			}
			if scenario == "wrong-order" {
				id, _ = primitive.ObjectIDFromHex("0123456789abcdef01234567")
			}
			entry := bson.M{"_id": id, "username": owner, "report_type": "Bug Report", "text": "My submission", "status": "open", "created_at": time.Now()}
			page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: entry}})
			if scenario == "empty" {
				page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			last := proof
			if scenario == "reset-after-read" {
				last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			mt.AddMockResponses(proof, page, last)
			data, err := (&DB{users: mt.Coll, reports: mt.Coll}).readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: "reports", Before: "0123456789abcdef01234565"}, time.Now(), maximumOwnerExportResponse)
			if scenario == "valid" || scenario == "empty" {
				var result ownerReportSnapshot
				if err != nil || json.Unmarshal(data, &result) != nil || result.Coverage.CompleteAccountExport || result.Reports == nil {
					mt.Fatal("valid bounded owner report page failed", err)
				}
			} else if err != errOwnerExportSection || data != nil {
				mt.Fatal("invalid source/reset delivered partial page")
			}
			events := mt.GetAllStartedEvents()
			command := events[1].Command
			stages, _ := command.Lookup("pipeline").Array().Values()
			filter := stages[0].Document().Lookup("$match").Document()
			if filter.Lookup("username").StringValue() != "owner" || filter.Lookup("_id").Document().Lookup("$lt").ObjectID().Hex() != "0123456789abcdef01234565" || stages[2].Document().Lookup("$limit").Int32() != 11 || command.Lookup("maxTimeMS").Int64() != 3000 || command.Lookup("cursor").Document().Lookup("batchSize").Int32() != 11 {
				mt.Fatal("owner keyset or work limits lost")
			}
			projection := stages[3].Document().Lookup("$project").Document()
			fields, _ := projection.Elements()
			if len(fields) != 7 || projection.Lookup("review").Type != 0 || projection.Lookup("export_approval").Type != 0 {
				mt.Fatal("private report projection widened")
			}
			if len(events) == 3 {
				if events[2].Command.Lookup("filter").Document().Lookup("password_hash").StringValue() != string(hash) {
					mt.Fatal("cross-store credential fence lost")
				}
			}
		})
	}
}

func TestOwnerExportCoverageDoesNotClaimCompleteAccountOrProviderRetrieval(t *testing.T) {
	for _, section := range []string{"profile", "progress", "reports", "sessions", "social", "market", "guilds", "invites", "pvp", "raids"} {
		coverage := ownerSectionCoverage(section)
		if coverage.CompleteAccountExport || len(coverage.Included) == 0 || len(coverage.NotIncluded) == 0 || len(coverage.WithheldPrivate) == 0 || len(coverage.SeparateHandling) == 0 || !strings.Contains(coverage.Consistency, "snapshot") {
			t.Fatal("missing honest section scope", section)
		}
	}
	for _, query := range []OwnerExportQuery{{Section: "reports", Before: "invalid"}, {Section: "reports", CharacterName: "Other"}, {Section: "reports", Before: "000000000000000000000000"}, {Section: "profile", Before: "0123456789abcdef01234560"}} {
		if ValidOwnerExportQuery(query) {
			t.Fatal("invalid scoped query accepted")
		}
	}
}
