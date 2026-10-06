package database

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestAccountIdentityCredentialProofUsesIDAndCurrentHash(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("synthetic proof"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"success", "changed", "wrong-password", "missing-id", "malformed-hash", "too-costly"} {
		mt.Run(scenario, func(mt *mtest.T) {
			id := primitive.NewObjectID()
			credential := bson.D{{Key: "_id", Value: id}, {Key: "password_hash", Value: string(hash)}}
			if scenario == "missing-id" {
				credential[0].Value = primitive.NilObjectID
			}
			if scenario == "malformed-hash" {
				credential[1].Value = "invalid"
			}
			if scenario == "too-costly" {
				credential[1].Value = strings.Replace(string(hash), "$04$", "$31$", 1)
			}
			mt.AddMockResponses(tradeResponse(mt, credential))
			if scenario == "success" {
				mt.AddMockResponses(tradeResponse(mt, bson.D{{Key: "_id", Value: id}}))
			}
			if scenario == "changed" {
				mt.AddMockResponses(tradeResponse(mt))
			}
			password := "synthetic proof"
			if scenario == "wrong-password" {
				password = "wrong"
			}
			actual, ok, err := (&DB{users: mt.Coll}).AuthenticateAccount("owner", password)
			if err != nil || ok != (scenario == "success") || (ok && actual != id) || (!ok && !actual.IsZero()) {
				mt.Fatal("identity/proof admitted", scenario, actual, ok, err)
			}
			finds := 0
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName != "find" {
					mt.Fatal("credential check wrote state", event.CommandName)
				}
				finds++
				if event.Command.Lookup("readConcern").Document().Lookup("level").StringValue() != "majority" {
					mt.Fatal("weak credential proof")
				}
				projection := event.Command.Lookup("projection").Document()
				fields, _ := projection.Elements()
				if len(fields) != 3-finds {
					mt.Fatal("whole/private account fetched", projection)
				}
				if finds == 2 {
					filter := event.Command.Lookup("filter").Document()
					if filter.Lookup("_id").ObjectID() != id || filter.Lookup("username").StringValue() != "owner" || filter.Lookup("password_hash").StringValue() != string(hash) {
						mt.Fatal("credential generation/hash fence lost", filter)
					}
				}
			}
			if (scenario == "success" || scenario == "changed") != (finds == 2) {
				mt.Fatal("unproved password admitted to identity recheck", finds)
			}
		})
	}
}

func TestAccountIdentityReadRequiresExactIDAndUsername(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("exact projection", func(mt *mtest.T) {
		id := primitive.NewObjectID()
		mt.AddMockResponses(tradeResponse(mt, bson.D{{Key: "_id", Value: id}}))
		ok, err := (&DB{users: mt.Coll}).MatchAccountIdentity("owner", id)
		if err != nil || !ok {
			mt.Fatal(err)
		}
		event := mt.GetStartedEvent()
		filter := event.Command.Lookup("filter").Document()
		fields, _ := event.Command.Lookup("projection").Document().Elements()
		if filter.Lookup("_id").ObjectID() != id || filter.Lookup("username").StringValue() != "owner" || len(fields) != 1 {
			mt.Fatal("identity read widened")
		}
	})
	if ok, err := (&DB{}).MatchAccountIdentity("owner", primitive.NilObjectID); ok || err != nil {
		t.Fatal("zero identity caused storage access")
	}
}
