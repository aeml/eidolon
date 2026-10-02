package main

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestDirectTradeStateReaderPreservesPrivateOpaqueDataAndJournalRoundTrip(t *testing.T) {
	for _, version := range []int{1, 9} {
		t.Run(string(rune('0'+version)), func(t *testing.T) {
			_, committer := setupCharacterJournalTest(t)
			raw, err := bson.Marshal(bson.D{{Key: "version", Value: version}, {Key: "revision", Value: int64(7)},
				{Key: "future_opaque", Value: bson.D{{Key: "raw", Value: []byte{0, 1, 255}}, {Key: "label", Value: "private-future-trade-data"}}}})
			if err != nil {
				t.Fatal(err)
			}
			character := &database.Character{Name: "trade-reader", DirectTradeState: raw}
			// The exact clone helper is used by real join hydration; entity
			// copying and the full save builder below are production methods.
			entity := &game.Entity{ID: "player-trade-reader", Type: game.TypePlayer, SubType: "Fighter", Level: 30,
				DirectTradeState: database.CloneDirectTradeState(character.DirectTradeState)}
			world = game.NewWorld(nil)
			t.Cleanup(world.StopBackground)
			world.AddEntity(entity)
			snapshot := world.GetEntityCopy(entity.ID)
			if !bytes.Equal(raw, snapshot.DirectTradeState) {
				t.Fatal("entity copy changed opaque state")
			}
			entity.Mu.Lock()
			entity.DirectTradeState[len(entity.DirectTradeState)-2] ^= 1
			entity.Mu.Unlock()
			if !bytes.Equal(raw, snapshot.DirectTradeState) {
				t.Fatal("entity copy aliases live state")
			}
			saved := characterSnapshot(character.Name, snapshot, time.Now())
			if !bytes.Equal(raw, saved.DirectTradeState) {
				t.Fatal("full save dropped or rewrote trade state")
			}
			snapshot.DirectTradeState[len(snapshot.DirectTradeState)-2] ^= 1
			if !bytes.Equal(raw, saved.DirectTradeState) {
				t.Fatal("full save aliases snapshot state")
			}
			if err := persistCharacterSnapshot(character.Name, saved); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(raw, committer.saved.DirectTradeState) {
				t.Fatal("journal BSON round trip changed opaque state")
			}
			wire, err := json.Marshal(world.GetEntityCopy(entity.ID))
			if err != nil || bytes.Contains(wire, []byte("DirectTradeState")) || bytes.Contains(wire, []byte("directTradeState")) || bytes.Contains(wire, []byte("private-future-trade-data")) {
				t.Fatal("ordinary entity JSON leaked trade recovery state", err)
			}
		})
	}
}

func TestDirectTradePersistentOfferLimitsMatchRuntime(t *testing.T) {
	if database.MaxDirectTradeOfferItems != game.MaxInventorySize || database.MaxDirectTradeOfferGold != game.MaxDirectTradeGold {
		t.Fatal("persistent intent and runtime offer limits diverged")
	}
}
