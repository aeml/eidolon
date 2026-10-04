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

func TestOwnerProfileReaderRequiresPasswordAndNarrowFencedQueries(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	password := "owner proof password"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"success", "wrong-password", "missing-account", "changed-password", "query-error", "wrong-owner-reply", "small-budget"} {
		mt.Run(scenario, func(mt *mtest.T) {
			namespace := mt.DB.Name() + "." + mt.Coll.Name()
			credential := mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
			profileOwner := "owner"
			if scenario == "wrong-owner-reply" {
				profileOwner = "other"
			}
			profile := mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch, bson.D{
				{Key: "username", Value: profileOwner}, {Key: "email", Value: "submitted@example.invalid"},
				{Key: "password_hash", Value: "private-hash"}, {Key: "roles", Value: bson.M{"admin": "private-staff"}},
				{Key: "recovery_email", Value: bson.M{"address": "verified@example.invalid", "verified_at": time.Now()}},
			})
			if scenario == "missing-account" {
				credential = mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch)
			}
			if scenario == "changed-password" {
				profile = mtest.CreateCursorResponse(0, namespace, mtest.FirstBatch)
			}
			if scenario == "query-error" {
				profile = mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 2, Message: "private-error-detail"})
			}
			mt.AddMockResponses(credential, profile)
			proof, budget := password, 4096
			if scenario == "wrong-password" {
				proof = "not the password"
			}
			if scenario == "small-budget" {
				budget = 1
			}
			encoded, err := (&DB{users: mt.Coll}).readOwnerProfileSnapshot(context.Background(), "owner", proof, time.Now(), budget)
			if scenario == "success" {
				var result ownerProfileSnapshot
				if err != nil || json.Unmarshal(encoded, &result) != nil || result.Profile.Username != "owner" || result.Profile.VerifiedRecoveryEmail == nil || strings.Contains(string(encoded), "private-") {
					mt.Fatal("proved owner profile was not safely returned")
				}
			} else if err != errOwnerProfileSnapshot || encoded != nil {
				mt.Fatal("rejected proof or read exposed partial data/details")
			}
			commands := mt.GetAllStartedEvents()
			want := 2
			if scenario == "wrong-password" || scenario == "missing-account" {
				want = 1
			}
			if len(commands) != want {
				mt.Fatal("unexpected query count or profile read before password proof")
			}
			for i, event := range commands {
				command := event.Command
				filter := command.Lookup("filter").Document()
				if filter.Lookup("username").StringValue() != "owner" || command.Lookup("maxTimeMS").Int64() != 3000 {
					mt.Fatal("query lost exact owner scope or server work deadline")
				}
				projection := command.Lookup("projection").Document()
				elements, _ := projection.Elements()
				if i == 0 {
					if len(elements) != 2 || projection.Lookup("password_hash").Int32() != 1 || projection.Lookup("_id").Int32() != 0 {
						mt.Fatal("password proof fetched private account/character image")
					}
				} else {
					if filter.Lookup("password_hash").StringValue() != string(hash) || len(elements) != 7 || projection.Lookup("_id").Int32() != 0 {
						mt.Fatal("profile read lost credential race fence or exact projection")
					}
					for _, field := range []string{"username", "public_name", "email", "created_at", "recovery_email.address", "recovery_email.verified_at"} {
						if projection.Lookup(field).Int32() != 1 {
							mt.Fatal("profile projection widened or omitted owned field")
						}
					}
				}
			}
		})
	}
}

func TestOwnerProfileReaderRejectsInvalidInputsBeforeQuery(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("invalid", func(mt *mtest.T) {
		for _, sample := range []struct {
			owner, password string
			at              time.Time
			budget          int
		}{
			{"", "password", time.Now(), 4096}, {"owner", "", time.Now(), 4096},
			{"owner", strings.Repeat("p", 73), time.Now(), 4096},
			{"owner", "password", time.Time{}, 4096}, {"owner", "password", time.Now(), 0},
		} {
			encoded, err := (&DB{users: mt.Coll}).readOwnerProfileSnapshot(context.Background(), sample.owner, sample.password, sample.at, sample.budget)
			if err != errOwnerProfileSnapshot || encoded != nil || len(mt.GetAllStartedEvents()) != 0 {
				mt.Fatal("invalid input reached database or exposed output")
			}
		}
	})
}
