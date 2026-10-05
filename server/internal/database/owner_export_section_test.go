package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerExportSectionBoundsAndOwnerFences(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"profile", "progress", "wrong-password", "password-changed", "cross-owner", "wrong-character", "oversized-or-missing", "small-response", "cost31"} {
		mt.Run(scenario, func(mt *mtest.T) {
			section, name := "profile", ""
			if scenario == "progress" || scenario == "wrong-character" {
				section, name = "progress", "My fighter"
			}
			proofHash := string(hash)
			if scenario == "cost31" {
				proofHash = strings.Replace(proofHash, "$04$", "$31$", 1)
			}
			namespace := mt.DB.Name() + "." + mt.Coll.Name()
			credential := mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: proofHash}})
			owner := "owner"
			if scenario == "cross-owner" {
				owner = "another-account"
			}
			data := bson.D{{Key: "username", Value: owner}, {Key: "email", Value: "submitted@example.invalid"}}
			if section == "progress" {
				character := name
				if scenario == "wrong-character" {
					character = "Other fighter"
				}
				data = append(data, bson.E{Key: "character", Value: bson.M{"name": character, "class": "Fighter", "level": 30, "last_save_id": "private-replay-identity"}})
			}
			response := mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch, data)
			if scenario == "password-changed" || scenario == "oversized-or-missing" {
				response = mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch)
			}
			mt.AddMockResponses(credential, response)
			password, budget := "synthetic owner proof", maximumOwnerExportResponse
			if scenario == "wrong-password" {
				password = "incorrect"
			}
			if scenario == "small-response" {
				budget = 1
			}
			encoded, err := (&DB{users: mt.Coll}).readOwnerExportSection(context.Background(), "owner", password, section, name, time.Now(), budget)
			if scenario == "profile" || scenario == "progress" {
				if err != nil || !json.Valid(encoded) || strings.Contains(string(encoded), "private-") {
					mt.Fatal("valid owner section failed or leaked private data", err)
				}
			} else if err != errOwnerExportSection || encoded != nil {
				mt.Fatal("rejection returned partial data or private error details")
			}
			commands := mt.GetAllStartedEvents()
			want := 2
			if scenario == "wrong-password" || scenario == "cost31" {
				want = 1
			}
			if len(commands) != want {
				mt.Fatal("data queried before proof or unexpectedly retried")
			}
			credentialQuery := commands[0].Command
			if credentialQuery.Lookup("filter").Document().Lookup("username").StringValue() != "owner" || credentialQuery.Lookup("maxTimeMS").Int64() != 3000 {
				mt.Fatal("credential scope or deadline lost")
			}
			projection := credentialQuery.Lookup("projection").Document()
			elements, _ := projection.Elements()
			if len(elements) != 2 || projection.Lookup("password_hash").Int32() != 1 || projection.Lookup("_id").Int32() != 0 {
				mt.Fatal("proof query fetched whole account")
			}
			if want == 2 {
				query := commands[1].Command
				if query.Lookup("maxTimeMS").Int64() != 3000 || query.Lookup("cursor").Document().Lookup("batchSize").Int32() != 1 {
					mt.Fatal("aggregate work or batch bound lost")
				}
				stages, _ := query.Lookup("pipeline").Array().Values()
				match := stages[0].Document().Lookup("$match").Document()
				if match.Lookup("username").StringValue() != "owner" || match.Lookup("password_hash").StringValue() != string(hash) {
					mt.Fatal("credential reset race fence lost")
				}
				last := stages[len(stages)-1].Document().Lookup("$limit")
				if last.Int32() != 1 {
					mt.Fatal("unbounded account-source read")
				}
				projection := stages[len(stages)-3].Document().Lookup("$project").Document()
				if projection.Lookup("password_hash").Type != 0 || projection.Lookup("roles").Type != 0 || projection.Lookup("characters").Type != 0 {
					mt.Fatal("restricted source projection widened")
				}
				predicate := stages[len(stages)-2].Document().Lookup("$match").Document().Lookup("$expr").Document().Lookup("$lte").Array()
				values, _ := predicate.Values()
				limit := int32(16 << 10)
				if section == "progress" {
					limit = 256 << 10
				}
				if values[0].Document().Lookup("$bsonSize").StringValue() != "$$ROOT" || values[1].Int32() != limit {
					mt.Fatal("predecode input bound lost")
				}
			}
		})
	}
}

func TestOwnerExportSectionRejectsInvalidInputBeforeQueries(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("invalid", func(mt *mtest.T) {
		for _, sample := range []struct {
			owner, password, section, name string
			at                             time.Time
			budget                         int
		}{
			{"", "proof", "profile", "", time.Now(), 1000}, {"owner", "", "profile", "", time.Now(), 1000},
			{"owner", strings.Repeat("p", 73), "profile", "", time.Now(), 1000},
			{"owner", "proof", "users", "", time.Now(), 1000}, {"owner", "proof", "profile", "Other", time.Now(), 1000},
			{"owner", "proof", "progress", "", time.Now(), 1000}, {"owner", "proof", "profile", "", time.Time{}, 1000},
			{"owner", "proof", "profile", "", time.Now(), 0}, {"owner", "proof", "profile", "", time.Now(), maximumOwnerExportResponse + 1},
		} {
			result, err := (&DB{users: mt.Coll}).readOwnerExportSection(context.Background(), sample.owner, sample.password, sample.section, sample.name, sample.at, sample.budget)
			if err != errOwnerExportSection || result != nil || len(mt.GetAllStartedEvents()) != 0 {
				mt.Fatal("invalid request queried or returned data")
			}
		}
	})
}
