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

func TestOwnerSessionExportCurrentProofRetentionAndProjection(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"valid", "legacy-start-missing", "wrong-owner", "expired", "outside-retention", "staff-action", "bad-session-start", "oversized", "reset-after-read", "empty"} {
		mt.Run(scenario, func(mt *mtest.T) {
			ns := mt.DB.Name() + "." + mt.Coll.Name()
			proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
			id, _ := primitive.ObjectIDFromHex("0123456789abcdef01234560")
			entry := bson.M{"_id": id, "actor": "owner", "at": now.Add(-time.Hour), "expires_at": now.Add(time.Hour), "action": "disconnect", "result": "success", "session_started_at": now.Add(-2 * time.Hour)}
			switch scenario {
			case "legacy-start-missing":
				delete(entry, "session_started_at")
			case "wrong-owner":
				entry["actor"] = "other"
			case "expired":
				entry["expires_at"] = now
			case "outside-retention":
				entry["at"] = now.Add(-91 * 24 * time.Hour)
			case "staff-action":
				entry["action"] = "admin_players"
			case "bad-session-start":
				entry["session_started_at"] = now
			}
			page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: entry}})
			if scenario == "empty" {
				page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			last := proof
			if scenario == "reset-after-read" {
				last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			mt.AddMockResponses(proof, page, last)
			data, err := (&DB{users: mt.Coll, adminActivity: mt.Coll, adminActivityRetentionDays: 90}).readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: "sessions", Before: "0123456789abcdef01234565"}, now, maximumOwnerExportResponse)
			if scenario == "valid" || scenario == "legacy-start-missing" || scenario == "empty" {
				var view ownerSessionSnapshot
				if err != nil || json.Unmarshal(data, &view) != nil || view.Coverage.CompleteAccountExport || view.RetentionDays != 90 || !view.Cutoff.Equal(now.Add(-90*24*time.Hour)) || view.Entries == nil {
					mt.Fatal("valid retained session page failed", err)
				}
				if scenario == "legacy-start-missing" && view.Entries[0].SessionStartedAt != nil {
					mt.Fatal("invented historical duration")
				}
				if strings.Contains(string(data), `"actor"`) || strings.Contains(string(data), `"expires_at"`) {
					mt.Fatal("private source identity/expiry disclosed")
				}
			} else if err != errOwnerExportSection || data != nil {
				mt.Fatal("invalid/reset source produced partial history")
			}
			events := mt.GetAllStartedEvents()
			stages, _ := events[1].Command.Lookup("pipeline").Array().Values()
			filter := stages[0].Document().Lookup("$match").Document()
			if filter.Lookup("actor").StringValue() != "owner" || filter.Lookup("at").Document().Lookup("$gt").DateTime() != now.Add(-90*24*time.Hour).UnixMilli() || filter.Lookup("expires_at").Document().Lookup("$gt").DateTime() != now.UnixMilli() || stages[2].Document().Lookup("$limit").Int32() != 11 {
				mt.Fatal("account/cutoff/source limit lost")
			}
			projection := stages[3].Document().Lookup("$project").Document()
			fields, _ := projection.Elements()
			if len(fields) != 7 || projection.Lookup("reason").Type != 0 || projection.Lookup("summary").Type != 0 || projection.Lookup("target").Type != 0 || projection.Lookup("request_id").Type != 0 {
				mt.Fatal("staff/private history projection widened")
			}
		})
	}
}
