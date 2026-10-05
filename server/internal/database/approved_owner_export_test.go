package database

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestApprovedOwnerExportRechecksPermissionBeforeReturningData(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"approved", "not-approved", "revoked-during-read", "wrong-password"} {
		mt.Run(scenario, func(mt *mtest.T) {
			ns := mt.DB.Name() + "." + mt.Coll.Name()
			marker := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "export_approval", Value: bson.M{"enabled": true, "revision": int64(1), "at": time.Now()}}})
			empty := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			if scenario == "not-approved" {
				mt.AddMockResponses(empty)
			} else {
				last := marker
				if scenario == "revoked-during-read" {
					last = empty
				}
				mt.AddMockResponses(marker, mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}}),
					mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "username", Value: "owner"}, {Key: "email", Value: "owner@example.invalid"}}), last)
			}
			password := "synthetic owner proof"
			if scenario == "wrong-password" {
				password = "incorrect"
			}
			db := &DB{users: mt.Coll, reports: mt.Coll}
			data, err := db.ReadApprovedOwnerExportSection(context.Background(), "owner", password, "0123456789abcdef01234567", 1, "profile", "", time.Now(), 4096)
			if scenario == "approved" {
				if err != nil || !json.Valid(data) {
					mt.Fatal("approved owner profile unavailable", err)
				}
			} else if err != errOwnerExportSection || data != nil {
				mt.Fatal("unapproved/revoked export returned data")
			}
			commands := mt.GetAllStartedEvents()
			want := 4
			if scenario == "not-approved" {
				want = 1
			}
			if scenario == "wrong-password" {
				want = 2
			}
			if len(commands) != want {
				mt.Fatal("unexpected read before approval or after proof denial")
			}
			for index, event := range commands {
				if index != 0 && index != 3 {
					continue
				}
				filter := event.Command.Lookup("filter").Document()
				if filter.Lookup("username").StringValue() != "owner" || filter.Lookup("report_type").StringValue() != "Account Data Export" || !filter.Lookup("export_approval.enabled").Boolean() || filter.Lookup("export_approval.revision").Int64() != 1 {
					mt.Fatal("approval read lost literal owner/type/permission/revision fence")
				}
				projection := event.Command.Lookup("projection").Document()
				fields, _ := projection.Elements()
				if len(fields) != 4 || projection.Lookup("text").Type != 0 || projection.Lookup("export_approval.reason").Type != 0 {
					mt.Fatal("owner approval check fetched case text/staff reason")
				}
			}
		})
	}
}
