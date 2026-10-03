package database

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

func TestCharacterCommitRequiresDurableWriteAndStrongReplayProof(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, outcome := range []string{"new save", "same receipt", "other receipt", "missing character", "lost acknowledgement"} {
		mt.Run(outcome, func(mt *mtest.T) {
			// Explicitly hostile inherited defaults must not weaken the producer.
			unsafe, err := mt.Coll.Clone(options.Collection().SetReadPreference(readpref.Secondary()).SetWriteConcern(writeconcern.New(writeconcern.W(0))))
			if err != nil {
				mt.Fatal(err)
			}
			db := &DB{users: unsafe}
			id := "11111111111111111111111111111111"
			character := &Character{Name: "alice", Gold: 43, Inventory: []Item{{ID: "earned", Stats: map[string]int{"damage": 17}}}}
			switch outcome {
			case "new save":
				mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 1}, bson.E{Key: "nModified", Value: 1}))
			case "lost acknowledgement":
				mt.AddMockResponses(mtest.CreateWriteConcernErrorResponse(mtest.WriteConcernError{Code: 64, Message: "acknowledgement lost"}))
			default:
				mt.AddMockResponses(mtest.CreateSuccessResponse(bson.E{Key: "n", Value: 0}, bson.E{Key: "nModified", Value: 0}))
				if outcome == "missing character" {
					mt.AddMockResponses(tradeResponse(mt))
				} else {
					saved := *character
					saved.LastSaveID = id
					if outcome == "other receipt" {
						saved.LastSaveID = "22222222222222222222222222222222"
					}
					mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, User{Username: "alice", Characters: []*Character{&saved}})))
				}
			}
			err = db.CommitCharacterSave("alice", character, id)
			if (outcome == "new save" || outcome == "same receipt") != (err == nil) {
				mt.Fatal("unconfirmed save or mismatched receipt was acknowledged", outcome, err)
			}
			if character.LastSaveID != "" || character.Gold != 43 || character.Inventory[0].Stats["damage"] != 17 {
				mt.Fatal("save altered the caller's owned post-image")
			}
			tradeAssertConcerns(mt)
			writes := 0
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName == "update" {
					writes++
				}
			}
			if writes != 1 {
				mt.Fatal("save replay issued compensating/duplicate writes", writes)
			}
		})
	}
}
