package database

import (
	"encoding/json"
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestCharacterEntryAccountProjectsFirstCharacterAndPreservesLegacyInitialization(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, sample := range []struct {
		name       string
		characters []*Character
	}{
		{"missing-or-null", nil}, {"empty-array", []*Character{}},
		{"existing", []*Character{{Name: "original", Class: "Rogue", Gold: 1234, EP: 99,
			ItemDeliveryReceipts: map[string]string{"original-receipt": "exact-proof"}}}},
	} {
		mt.Run(sample.name, func(mt *mtest.T) {
			id := primitive.NewObjectID()
			for _, character := range sample.characters {
				character.AccountID = id
			}
			mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, CharacterEntryAccount{ID: id, PublicName: "Chosen alias", Characters: sample.characters})))
			account, err := (&DB{users: mt.Coll}).GetCharacterEntryAccount("exact-owner")
			if err != nil || account.ID != id || account.PublicName != "Chosen alias" || !reflect.DeepEqual(account.Characters, sample.characters) {
				mt.Fatal("entry lost first save or nil/empty array distinction", err)
			}
			command := mt.GetStartedEvent().Command
			if command.Lookup("filter").Document().Lookup("username").StringValue() != "exact-owner" {
				mt.Fatal("entry lost exact account scope")
			}
			projection := command.Lookup("projection").Document()
			fields, err := projection.Elements()
			if err != nil || len(fields) != 3 || projection.Lookup("_id").Int32() != 1 || projection.Lookup("public_name").Int32() != 1 || projection.Lookup("characters").Document().Lookup("$slice").Int32() != 1 {
				mt.Fatal("entry fetched private account or unrelated characters")
			}
			encoded, err := json.Marshal(account)
			if err != nil || string(encoded) != "{}" {
				mt.Fatal("private hydration DTO exposed via JSON", err)
			}
		})
	}
	mt.Run("invalid-first", func(mt *mtest.T) {
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, CharacterEntryAccount{Characters: []*Character{nil}})))
		if account, err := (&DB{users: mt.Coll}).GetCharacterEntryAccount("exact-owner"); err == nil || account != nil {
			mt.Fatal("invalid first character could be overwritten with a new one")
		}
	})
	mt.Run("lookup-error", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 123, Message: "synthetic query failure"}))
		if account, err := (&DB{users: mt.Coll}).GetCharacterEntryAccount("exact-owner"); err == nil || account != nil {
			mt.Fatal("lookup error admitted character creation")
		}
	})
}

func TestAuthenticateProjectsOnlyCredentialHash(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte(" exact password "), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, sample := range []struct {
		name, password string
		found, valid   bool
	}{
		{"correct", " exact password ", true, true},
		{"not-normalized", "exact password", true, false},
		{"wrong", "wrong password", true, false},
		{"missing", " exact password ", false, false},
	} {
		mt.Run(sample.name, func(mt *mtest.T) {
			if sample.found {
				mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, bson.M{"password_hash": string(hash)})))
			} else {
				mt.AddMockResponses(mtest.CreateCursorResponse(0, mt.Coll.Database().Name()+"."+mt.Coll.Name(), mtest.FirstBatch))
			}
			valid, err := (&DB{users: mt.Coll}).Authenticate("exact-owner", sample.password)
			if err != nil || valid != sample.valid {
				mt.Fatal("credential projection changed authentication", err)
			}
			command := mt.GetStartedEvent().Command
			if command.Lookup("filter").Document().Lookup("username").StringValue() != "exact-owner" {
				mt.Fatal("credential query lost account scope")
			}
			projection := command.Lookup("projection").Document()
			fields, err := projection.Elements()
			if err != nil || len(fields) != 2 || projection.Lookup("_id").Int32() != 0 || projection.Lookup("password_hash").Int32() != 1 {
				mt.Fatal("credential query fetched private unrelated data")
			}
		})
	}
	mt.Run("lookup-error", func(mt *mtest.T) {
		mt.AddMockResponses(mtest.CreateCommandErrorResponse(mtest.CommandError{Code: 123, Message: "synthetic query failure"}))
		if valid, err := (&DB{users: mt.Coll}).Authenticate("exact-owner", " exact password "); err == nil || valid {
			mt.Fatal("lookup error admitted login")
		}
	})
}
