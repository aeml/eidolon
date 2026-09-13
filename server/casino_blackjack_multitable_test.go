package main

import (
	"context"
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"errors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"testing"
	"time"
)

func TestBlackjackMongoIndependentTablesAndDebits(t *testing.T) {
	uri, name, _ := setupSlotMongo(t)
	oldWorld, oldExtra, oldAvailable := world, extraBlackjack, extraBlackjackAvailable
	t.Cleanup(func() { world, extraBlackjack, extraBlackjackAvailable = oldWorld, oldExtra, oldAvailable })
	extraBlackjack, extraBlackjackAvailable = map[string]*database.BlackjackTableRecord{}, map[string]bool{}
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cleanup.Disconnect(context.Background()) })
	tables := []game.CasinoTable{game.CasinoTables()[2], game.CasinoTables()[3]}
	for _, table := range tables {
		if _, err := db.GetBlackjackTable(table.ID); !errors.Is(err, mongo.ErrNoDocuments) {
			t.Fatal("refusing existing table", table.ID, err)
		}
		lobby, err := newBlackjackLobby()
		if err != nil {
			t.Fatal(err)
		}
		encoded, _ := json.Marshal(lobby)
		if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
			t.Fatal(err)
		}
		id := table.ID
		t.Cleanup(func() {
			cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": id})
		})
	}
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	p := &game.Entity{ID: "player-" + name, Name: name, Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, State: "IDLE", Health: 100, MaxHealth: 100, Gold: 300}
	world.AddEntity(p)
	client := &Client{playerID: p.ID, username: name}
	now := time.Now()
	ids := []string{}
	unlock := lockCharacterWork(name)
	for i, table := range tables {
		p.X, p.Z = table.Seats[0].ExitX, table.Seats[0].ExitZ
		seat, err := world.TakeCasinoSeat(p.ID, table.ID, 0, now)
		if err != nil {
			unlock()
			t.Fatal(err)
		}
		blackjackMu.Lock()
		_, state, err := loadBlackjackLocked(table.ID)
		blackjackMu.Unlock()
		if err != nil {
			unlock()
			t.Fatal(err)
		}
		ids = append(ids, state.RoundID)
		for retry := 0; retry < 2; retry++ {
			if err := handleBlackjackBet(client, seat.SessionID, state.RoundID, 20*(i+1), now); err != nil {
				unlock()
				t.Fatal(err)
			}
		}
		if i == 0 {
			if err := world.ChangeCasinoSeat(p.ID, seat.SessionID, "leave", false, now, ""); err != nil {
				unlock()
				t.Fatal(err)
			}
		}
	}
	unlock()
	saved, err := db.GetCharacter(name, name)
	if err != nil || saved.Gold != 240 || ids[0] == ids[1] {
		t.Fatal("debits replayed or rounds shared", err)
	}
	if err := tickBlackjack(now.Add(16*time.Second), tables[0].ID); err != nil {
		t.Fatal(err)
	}
	blackjackMu.Lock()
	_, first, err := loadBlackjackLocked(tables[0].ID)
	_, second, secondErr := loadBlackjackLocked(tables[1].ID)
	blackjackMu.Unlock()
	if err != nil || secondErr != nil || first.Phase == "betting" || second.Phase != "betting" {
		t.Fatal("one table advanced another", err, secondErr)
	}
	if view := blackjackViewFor(p.ID); view.RoundID != ids[1] || view.Gold != 240 {
		t.Fatal("seated view showed another table", view)
	}
}
