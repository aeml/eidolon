package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func setupSlotMongo(t *testing.T) (string, string, string) {
	t.Helper()
	uri := os.Getenv("EIDOLON_CASINO_TEST_MONGO_URI")
	if uri == "" {
		t.Skip("explicit disposable casino Mongo required")
	}
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) {
		t.Fatal("requires disposable loopback Mongo")
	}
	dir, _ := setupCharacterJournalTest(t)
	oldDB, oldCache, oldPending := db, slotsCache, slotsPending
	slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
	t.Cleanup(func() { db, slotsCache, slotsPending = oldDB, oldCache, oldPending })
	var err error
	db, err = database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	repo := db
	t.Cleanup(func() { repo.Close(context.Background()) })
	characterSaveCommitter = db
	cleanup, err := mongo.Connect(context.Background(), options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("slots-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		cleanup.Database("eidolon").Collection("users").DeleteOne(context.Background(), bson.M{"username": name})
		cleanup.Database("eidolon").Collection("casino_blackjack_tables").DeleteOne(context.Background(), bson.M{"_id": slotRecordKey("player-"+name, "earth")})
		cleanup.Disconnect(context.Background())
	})
	if err := db.CreateUser(name, name+"@example.invalid", name+"-local-only"); err != nil {
		t.Fatal(err)
	}
	if err := db.SetFirstCharacter(name, &database.Character{Name: name, Class: "Fighter", Level: 1, Gold: 300}); err != nil {
		t.Fatal(err)
	}
	return uri, name, dir
}

// Prepared winning grid isolates settlement/replay; not an earned spin or RTP test.
func preparedWinningSlot(t *testing.T, owner string) slotSavedState {
	t.Helper()
	s, _ := game.NewSlotSession("earth")
	s.Revision = 2
	stage := game.SlotStage{Wins: []game.SlotLineWin{}}
	payout := game.SlotMachines()[0].Pays[0][2] * (s.Bet / 10)
	for i := range game.SlotPaylines() {
		stage.Wins = append(stage.Wins, game.SlotLineWin{Line: i, Symbol: 0, Count: 5, Payout: payout})
		stage.Payout += payout
	}
	s.Last = &game.SlotResult{Stages: []game.SlotStage{stage}, Payout: stage.Payout, ExpandedReel: -1, BonusPicked: -1}
	if err := s.Validate(); err != nil {
		t.Fatal(err)
	}
	return slotSavedState{Owner: owner, Session: *s, Owed: s.Last.Payout, Payment: "spin"}
}

func TestSlotMongoInterruptionRecovery(t *testing.T) {
	for _, interruption := range []string{"debit_receipted", "debit_resolved", "payout_receipted"} {
		t.Run(interruption, func(t *testing.T) {
			uri, name, dir := setupSlotMongo(t)
			owner := "player-" + name
			r, _, err := loadSlotSessionLocked(owner, "earth")
			if err != nil {
				t.Fatal(err)
			}
			next := preparedWinningSlot(t, owner)
			encoded, _ := json.Marshal(next)
			debit := database.BlackjackTransfer{ID: "casino:" + name + ":debit", PlayerID: owner, Currency: "gold", Amount: -20, NextState: encoded}
			pending, err := db.BeginBlackjackTransfer(r.TableID, r.Version, debit)
			if err != nil {
				t.Fatal(err)
			}
			unlock := lockCharacterWork(name)
			if err := applyCasinoGoldTransferLocked(debit); err != nil {
				unlock()
				t.Fatal(err)
			}
			if interruption != "debit_receipted" {
				r, err = recoverBlackjackTransferLocked(*pending)
				if err != nil {
					unlock()
					t.Fatal(err)
				}
				if interruption == "payout_receipted" {
					paid := next
					paid.Owed, paid.Payment = 0, ""
					encoded, _ = json.Marshal(paid)
					credit := database.BlackjackTransfer{ID: "casino:" + name + ":return", PlayerID: owner, Currency: "gold", Amount: next.Owed, NextState: encoded}
					if _, err := db.BeginBlackjackTransfer(r.TableID, r.Version, credit); err != nil {
						unlock()
						t.Fatal(err)
					}
					if err := applyCasinoGoldTransferLocked(credit); err != nil {
						unlock()
						t.Fatal(err)
					}
				}
			}
			unlock()
			// Reopen actual repository/journal and discard all in-memory slot state.
			reopened, err := database.New(uri)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.Close(context.Background())
			db, characterSaveCommitter = reopened, reopened
			characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
			if err := initializeSlots(); err != nil {
				t.Fatal(err)
			}
			character, err := db.GetCharacter(name, name)
			if err != nil || character.Gold != 300-20+next.Owed || len(character.GoldCreditReceipts) != 2 {
				t.Fatal("lost/replayed slot Gold", character, err)
			}
			if len(slotsPending) != 0 {
				t.Fatal("completed settlement still blocks owner")
			}
			if err := initializeSlots(); err != nil {
				t.Fatal(err)
			}
			character, _ = db.GetCharacter(name, name)
			if character.Gold != 300-20+next.Owed {
				t.Fatal("second startup replay paid again")
			}
		})
	}
}

func TestSlotMongoSeatRevisionAndLeaving(t *testing.T) {
	_, name, _ := setupSlotMongo(t)
	owner := "player-" + name
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	table := game.CasinoTables()[6]
	position := table.Seats[0]
	p := &game.Entity{ID: owner, Name: name, Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 300, X: position.ExitX, Z: position.ExitZ}
	world.AddEntity(p)
	seat, err := world.TakeCasinoSeat(owner, table.ID, 0, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	client := &Client{playerID: owner, username: name}
	unlock := lockCharacterWork(name)
	defer unlock()
	if err := handleSlotAction(client, "old-seat", 1, "spin", 20, 0); err == nil {
		t.Fatal("wrong seat session accepted")
	}
	if err := handleSlotAction(client, seat.SessionID, 1, "spin", 20, 0); err != nil {
		t.Fatal(err)
	}
	_, saved, err := loadSlotSessionLocked(owner, "earth")
	if err != nil {
		t.Fatal(err)
	}
	gold := 300 - 20 + saved.Session.Last.Payout
	if p.Gold != gold {
		t.Fatal("spin was not settled", p.Gold, gold)
	}
	if err := handleSlotAction(client, seat.SessionID, 1, "spin", 20, 0); err == nil || p.Gold != gold {
		t.Fatal("stale revision spent again")
	}
	if err := world.ChangeCasinoSeat(owner, seat.SessionID, "leave", false, time.Now(), ""); err != nil {
		t.Fatal(err)
	}
	if err := handleSlotAction(client, seat.SessionID, saved.Session.Revision, "spin", 20, 0); err == nil {
		t.Fatal("remote spin accepted after leaving")
	}
	_, returned, err := loadSlotSessionLocked(owner, "earth")
	if err != nil || returned.Session.Revision != saved.Session.Revision || returned.Session.FreeSpins != saved.Session.FreeSpins {
		t.Fatal("leaving discarded machine progress", err)
	}
}

func TestSlotMongoBonusAndFreeSpinEntitlements(t *testing.T) {
	_, name, _ := setupSlotMongo(t)
	owner := "player-" + name
	r, state, err := loadSlotSessionLocked(owner, "earth")
	if err != nil {
		t.Fatal(err)
	}
	// Prepared earned feature; this test verifies custody/settlement, not RNG odds.
	grid := game.SlotGrid{}
	grid[0] = [3]int{7, 7, 7}
	state.Session.Revision = 2
	state.Session.FreeSpins = 5
	state.Session.Bonus = true
	state.Session.BonusOffers = [3]int{20, 40, 100}
	state.Session.Last = &game.SlotResult{Landed: grid, Stages: []game.SlotStage{{Grid: grid, Wins: []game.SlotLineWin{}}}, Scatters: 3, FreeAwarded: 5, ExpandedReel: -1, BonusPicked: -1}
	encoded, _ := json.Marshal(state)
	if _, err := decodeSlotState(r.TableID, encoded); err != nil {
		t.Fatal(err)
	}
	r, err = db.AdvanceBlackjackTable(r.TableID, r.Version, encoded)
	if err != nil {
		t.Fatal(err)
	}
	slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
	_, reopened, err := loadSlotSessionLocked(owner, "earth")
	if err != nil || !reopened.Session.Bonus || reopened.Session.FreeSpins != 5 {
		t.Fatal("unclaimed feature lost", err)
	}
	next, reward, err := game.ProposeSlotBonus(reopened.Session, 1)
	if err != nil {
		t.Fatal(err)
	}
	reopened.Session, reopened.Owed, reopened.Payment = *next, reward, "bonus"
	encoded, _ = json.Marshal(reopened)
	if _, err := db.AdvanceBlackjackTable(r.TableID, r.Version, encoded); err != nil {
		t.Fatal(err)
	}
	slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
	if err := initializeSlots(); err != nil {
		t.Fatal(err)
	}
	character, err := db.GetCharacter(name, name)
	if err != nil || character.Gold != 340 {
		t.Fatal("bonus payout lost", err)
	}
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	table := game.CasinoTables()[6]
	point := table.Seats[0]
	player := &game.Entity{ID: owner, Name: name, Type: game.TypePlayer, InstanceID: game.CasinoInstanceID, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 340, GoldCreditReceipts: character.GoldCreditReceipts, X: point.ExitX, Z: point.ExitZ}
	world.AddEntity(player)
	seat, err := world.TakeCasinoSeat(owner, table.ID, 0, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	client := &Client{playerID: owner, username: name}
	unlock := lockCharacterWork(name)
	defer unlock()
	if err := handleSlotAction(client, seat.SessionID, next.Revision, "bonus", 20, 1); err == nil {
		t.Fatal("bonus chosen twice")
	}
	if err := handleSlotAction(client, seat.SessionID, next.Revision, "spin", 40, 0); err == nil {
		t.Fatal("free spin accepted a different stake")
	}
	if err := handleSlotAction(client, seat.SessionID, next.Revision, "spin", 20, 0); err != nil {
		t.Fatal(err)
	}
	_, after, err := loadSlotSessionLocked(owner, "earth")
	if err != nil {
		t.Fatal(err)
	}
	if !after.Session.Last.Free || player.Gold != 340+after.Session.Last.Payout || after.Session.FreeSpins != 4+after.Session.Last.FreeAwarded {
		t.Fatal("free spin charged Gold or lost remaining entitlement")
	}
	for _, amount := range player.GoldCreditReceipts {
		if amount < 0 {
			t.Fatal("free spin created debit receipt")
		}
	}
}

func TestSlotPendingGateDoesNotQueryUnrelatedAccounts(t *testing.T) {
	oldDB, oldCache, oldPending := db, slotsCache, slotsPending
	defer func() { db, slotsCache, slotsPending = oldDB, oldCache, oldPending }()
	db = nil
	slotsCache, slotsPending = map[string]slotCacheEntry{}, map[string]string{}
	markSlotPending(slotRecordKey("player-alice", "earth"), "player-alice")
	if err := recoverAccountSlotsLocked("bob"); err != nil {
		t.Fatal("unrelated account queried unavailable DB", err)
	}
	if err := recoverAccountSlotsLocked("alice"); err == nil {
		t.Fatal("unresolved owner admitted without storage")
	}
	if len(slotsPending) != 1 {
		t.Fatal("failed recovery discarded owner fence")
	}
}
