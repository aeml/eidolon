package database

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// Existing isolated-Mongo CI supplies MONGO_URI. Never fall back to the live
// database or launch another database just for this focused storage check.
func TestDirectTradeMongoReservationReceiptsAndRepositoryRestart(t *testing.T) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI is required for actual direct-trade storage coverage")
	}
	db, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close(context.Background()) })
	op, characters := directTradeFixture(t, DirectTradeSettle)
	op.TradeID = uniqueID("direct-trade-intent")
	op.ID = DirectTradeOperationID(op.TradeID)
	for index := range op.Participants {
		participant := &op.Participants[index]
		participant.Username = uniqueID("direct-trade-account")
		participant.PlayerID = "player-" + participant.Username
		participant.CharacterName = participant.Username
		characters[index].Name = participant.CharacterName
		state, _ := DecodeDirectTradeState(characters[index].DirectTradeState)
		state.Escrow.TradeID = op.TradeID
		characters[index].DirectTradeState, _ = EncodeDirectTradeState(*state)
	}
	op.Fingerprint, _ = DirectTradeOperationFingerprint(op)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = db.directTradeOperations.DeleteOne(ctx, bson.M{"_id": op.ID})
		for _, participant := range op.Participants {
			_, _ = db.users.DeleteOne(ctx, bson.M{"username": participant.Username})
		}
	})
	for index, participant := range op.Participants {
		if _, err := db.users.InsertOne(t.Context(), User{Username: participant.Username, Characters: []*Character{characters[index]}}); err != nil {
			t.Fatal(err)
		}
	}
	stored, err := db.PrepareDirectTradeOperation(op)
	if err != nil || stored == nil {
		t.Fatal("prepare failed", err)
	}
	retry := op
	retry.CreatedAt = retry.CreatedAt.Add(time.Hour)
	stored, err = db.PrepareDirectTradeOperation(retry)
	if err != nil || stored == nil || !stored.CreatedAt.Equal(op.CreatedAt) {
		t.Fatal("retry did not retain first timestamp", stored, err)
	}
	for index := range op.Participants {
		other := op
		other.TradeID = uniqueID("direct-trade-blocked")
		other.ID = DirectTradeOperationID(other.TradeID)
		peer := &other.Participants[1-index]
		peer.Username = uniqueID("direct-trade-other")
		peer.PlayerID = "player-" + peer.Username
		peer.CharacterName = peer.Username
		other.Fingerprint, _ = DirectTradeOperationFingerprint(other)
		if _, err := db.PrepareDirectTradeOperation(other); !errors.Is(err, ErrDirectTradeBusy) {
			t.Fatal("unique multikey index did not reserve participant", index, err)
		}
		pending, err := db.PendingDirectTradeOperations(op.Participants[index].Username, 1)
		if err != nil || len(pending) != 1 || pending[0].ID != op.ID {
			t.Fatal("participant recovery query lost the shared intent", index, pending, err)
		}
	}
	for index, participant := range op.Participants {
		if _, err := ApplyDirectTradeCharacterDecision(participant.Username, characters[index], op); err != nil {
			t.Fatal(err)
		}
		saveID := "11111111111111111111111111111111"
		if index == 1 {
			saveID = "22222222222222222222222222222222"
		}
		if err := db.CommitCharacterSave(participant.Username, characters[index], saveID); err != nil {
			t.Fatal(err)
		}
		if index == 0 {
			if _, err := db.CompleteDirectTradeOperation(op.ID, op.Fingerprint); !errors.Is(err, ErrDirectTradeConflict) {
				t.Fatal("partial participant save acknowledged as complete", err)
			}
		}
	}
	// A new repository/client owns no process-local receipts or operation cache.
	reopened, err := New(uri)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = reopened.Close(context.Background()) })
	stored, err = reopened.CompleteDirectTradeOperation(op.ID, op.Fingerprint)
	if err != nil || stored == nil || stored.State != DirectTradeComplete {
		t.Fatal("durable receipts did not complete after repository restart", stored, err)
	}
	stored, err = reopened.PrepareDirectTradeOperation(op)
	if err != nil || stored == nil || stored.State != DirectTradeComplete {
		t.Fatal("terminal ID reopened as pending", stored, err)
	}
	changed := op
	changed.Decision = DirectTradeCancel
	changed.Fingerprint, _ = DirectTradeOperationFingerprint(changed)
	if _, err := reopened.PrepareDirectTradeOperation(changed); !errors.Is(err, ErrDirectTradeConflict) {
		t.Fatal("settlement was replaced by cancellation", err)
	}
	for _, participant := range op.Participants {
		pending, err := reopened.PendingDirectTradeOperations(participant.Username, 1)
		if err != nil || len(pending) != 0 {
			t.Fatal("completed decision retained an active reservation", pending, err)
		}
	}
}
