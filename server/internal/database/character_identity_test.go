package database

import (
	"fmt"
	"os"
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestCharacterJournalAccountIdentitySurvivesRestart(t *testing.T) {
	dir := t.TempDir()
	journal, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	id := primitive.NewObjectID()
	character := &Character{Name: "hero", Gold: 123, EP: 7}
	save, err := journal.WriteForAccount(id, "owner", character)
	if err != nil || save.Version != 2 || save.AccountID != id {
		t.Fatal("bound write", err)
	}
	reopened, err := OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	actual, err := reopened.Read("owner")
	if err != nil || !reflect.DeepEqual(actual, save) {
		t.Fatal("bound identity lost", err)
	}
	if _, err := journal.WriteForAccount(primitive.NilObjectID, "owner", character); err == nil {
		t.Fatal("missing identity allowed")
	}
	if actual, err := journal.Read("owner"); err != nil || !reflect.DeepEqual(actual, save) {
		t.Fatal("invalid write replaced evidence", err)
	}
	if err := journal.Acknowledge("owner", "00000000000000000000000000000000"); err != nil {
		t.Fatal(err)
	}
	if actual, _ := journal.Read("owner"); actual == nil {
		t.Fatal("wrong receipt erased bound save")
	}
	if err := journal.Acknowledge("owner", save.SaveID); err != nil {
		t.Fatal(err)
	}
	if actual, err := journal.Read("owner"); err != nil || actual != nil {
		t.Fatal("bound receipt not acknowledged", err)
	}
}

func TestCharacterJournalRejectsMixedIdentityVersionsWithoutRemovingEvidence(t *testing.T) {
	for _, version := range []int{0, 1, 2, 3} {
		for _, bound := range []bool{false, true} {
			t.Run(fmt.Sprintf("version-%d-bound-%t", version, bound), func(t *testing.T) {
				j, err := OpenCharacterSaveJournal(t.TempDir())
				if err != nil {
					t.Fatal(err)
				}
				save, err := j.Write("owner", &Character{Name: "hero"})
				if err != nil {
					t.Fatal(err)
				}
				save.Version = version
				if bound {
					save.AccountID = primitive.NewObjectID()
				}
				encoded, err := bson.Marshal(save)
				if err != nil {
					t.Fatal(err)
				}
				path := j.filename("owner")
				if err := os.WriteFile(path, encoded, 0600); err != nil {
					t.Fatal(err)
				}
				valid := (version == 1 && !bound) || (version == 2 && bound)
				_, err = j.PendingUsers()
				if valid != (err == nil) {
					t.Fatal("invalid identity/version admitted", version, bound, err)
				}
				actual, err := os.ReadFile(path)
				if err != nil || !reflect.DeepEqual(actual, encoded) {
					t.Fatal("reader changed pending evidence", err)
				}
			})
		}
	}
}

func TestCharacterJournalAccountIdentityCannotBeReboundOrDowngraded(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		t.Run(fmt.Sprintf("existing-legacy-%t", legacy), func(t *testing.T) {
			j, err := OpenCharacterSaveJournal(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			account := primitive.NewObjectID()
			character := &Character{Name: "hero", Gold: 123}
			var save *PendingCharacterSave
			if legacy {
				save, err = j.Write("owner", character)
			} else {
				save, err = j.WriteForAccount(account, "owner", character)
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err := j.WriteForAccount(primitive.NewObjectID(), "owner", character); err == nil {
				t.Fatal("pending journal rebound to today's name owner")
			}
			if !legacy {
				if _, err := j.Write("owner", character); err == nil {
					t.Fatal("bound rejection downgraded by newer live retry")
				}
			}
			if actual, err := j.Read("owner"); err != nil || !reflect.DeepEqual(actual, save) {
				t.Fatal("identity conflict discarded original evidence", err)
			}
			character.Gold = 456
			if legacy {
				_, err = j.Write("owner", character)
			} else {
				_, err = j.WriteForAccount(account, "owner", character)
			}
			if err != nil {
				t.Fatal("same identity newer save refused", err)
			}
		})
	}
}

func TestCharacterBoundCommitFencesWriteAndReceiptProof(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, outcome := range []string{"write", "receipt", "missing"} {
		mt.Run(outcome, func(mt *mtest.T) {
			id := primitive.NewObjectID()
			saveID := "11111111111111111111111111111111"
			db := &DB{users: mt.Coll}
			if outcome == "write" {
				mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
			} else {
				mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 0}, bson.E{Key: "nModified", Value: 0}))
				if outcome == "receipt" {
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: "owner", Characters: []*Character{{Name: "hero", LastSaveID: saveID}}})))
				} else {
					mt.AddMockResponses(tradeResponse(mt))
				}
			}
			if err := db.CommitBoundCharacterSave(id, "owner", &Character{Name: "hero"}, saveID); (err == nil) != (outcome != "missing") {
				mt.Fatal("bound commit outcome", err)
			}
			tradeAssertConcerns(mt)
			for _, event := range mt.GetAllStartedEvents() {
				var filter bson.Raw
				switch event.CommandName {
				case "update":
					rows, _ := event.Command.Lookup("updates").Array().Values()
					filter = rows[0].Document().Lookup("q").Document()
				case "find":
					filter = event.Command.Lookup("filter").Document()
				default:
					continue
				}
				if filter.Lookup("_id").ObjectID() != id || filter.Lookup("username").StringValue() != "owner" {
					mt.Fatal("identity missing from write/proof", filter)
				}
			}
		})
	}
	if err := (&DB{}).CommitBoundCharacterSave(primitive.NilObjectID, "owner", &Character{Name: "hero"}, "11111111111111111111111111111111"); err == nil {
		t.Fatal("nil account allowed")
	}
}
