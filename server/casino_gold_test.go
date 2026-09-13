package main

import (
	"errors"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestCasinoGoldReceiptsAndInterruptedCharacterSave(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	world.Economy = game.NewEconomyTelemetry(time.Now())
	player := &game.Entity{ID: "player-hero", Name: "hero", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 300}
	world.AddEntity(player)
	debit := database.BlackjackTransfer{ID: "casino:round-one:bet", PlayerID: player.ID, Currency: "gold", Amount: -100, NextState: []byte(`{"phase":"betting"}`)}
	if err := applyCasinoGoldTransferLocked(debit); err != nil {
		t.Fatal(err)
	}
	if player.Gold != 200 || committer.saved.GoldCreditReceipts[debit.ID] != -100 {
		t.Fatal("missing durable debit receipt")
	}
	// Ordinary spending between an ambiguous acknowledgement and its retry
	// cannot cause another debit or turn an already paid stake into insufficiency.
	player.Gold = 3
	if err := applyCasinoGoldTransferLocked(debit); err != nil || player.Gold != 3 {
		t.Fatal("replay debited again", err)
	}
	conflict := debit
	conflict.Amount = -200
	if err := applyCasinoGoldTransferLocked(conflict); err == nil {
		t.Fatal("changed amount reused a receipt")
	}
	unfunded := debit
	unfunded.ID = "casino:round-two:bet"
	if err := applyCasinoGoldTransferLocked(unfunded); !errors.Is(err, database.ErrInsufficientGold) || player.Gold != 3 {
		t.Fatal("unfunded stake accepted", err)
	}
	if _, exists := player.GoldCreditReceipts[unfunded.ID]; exists {
		t.Fatal("rejected stake created receipt")
	}

	payout := database.BlackjackTransfer{ID: "casino:round-one:payout", PlayerID: player.ID, Currency: "gold", Amount: 250, NextState: []byte(`{"phase":"complete"}`)}
	// Test a failure AFTER the new payout reaches the live character. The prior
	// flush is allowed, then the payout full-save commit fails (journal survives).
	characterSaveCommitter = &casinoFailCreditCommitter{delegate: committer, failID: payout.ID}
	if err := applyCasinoGoldTransferLocked(payout); err == nil {
		t.Fatal("interrupted payout acknowledged")
	}
	if player.Gold != 253 {
		t.Fatal("payout not applied once")
	}
	pending, err := characterSaveJournal.Read("hero")
	if err != nil || pending == nil {
		t.Fatal("interrupted payout lost journal", err)
	}
	characterSaveCommitter = committer
	if err := applyCasinoGoldTransferLocked(payout); err != nil || player.Gold != 253 {
		t.Fatal("payout retry duplicated Gold", err)
	}
	if committer.saved.Gold != 253 || committer.saved.GoldCreditReceipts[payout.ID] != 250 {
		t.Fatal("payout missing durable receipt")
	}
	wrongCurrency := payout
	wrongCurrency.Currency = "vip"
	if err := applyCasinoGoldTransferLocked(wrongCurrency); err == nil || player.Gold != 253 {
		t.Fatal("VIP fell back to Gold")
	}
	summary := world.Economy.Drain(time.Now())
	if summary.Sinks["casino_wagers"] != 100 || summary.Sources["casino_returns"] != 250 {
		t.Fatal("casino telemetry duplicated replay or mixed other sources", summary)
	}
}

func TestCasinoGoldCompetingAccountSpends(t *testing.T) {
	setupCharacterJournalTest(t)
	world = &game.World{Entities: map[string]*game.Entity{}, Grid: game.NewSpatialMap(50)}
	player := &game.Entity{ID: "player-hero", Name: "hero", Type: game.TypePlayer, SubType: "Fighter", State: "IDLE", Level: 1, Health: 100, MaxHealth: 100, Gold: 300}
	world.AddEntity(player)
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, id := range []string{"casino:round:stake-one", "casino:round:stake-two"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			unlock := lockCharacterWork("hero")
			defer unlock()
			results <- applyCasinoGoldTransferLocked(database.BlackjackTransfer{ID: id, PlayerID: player.ID, Currency: "gold", Amount: -200, NextState: []byte(`{"phase":"accepted"}`)})
		}(id)
	}
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		if err == nil {
			wins++
		} else if !errors.Is(err, database.ErrInsufficientGold) {
			t.Fatal(err)
		}
	}
	if wins != 1 || player.Gold != 100 || len(player.GoldCreditReceipts) != 1 {
		t.Fatal("competing spends overdrew balance", wins, player.Gold)
	}
}

type casinoFailCreditCommitter struct {
	delegate *testCharacterCommitter
	failID   string
}

func (c *casinoFailCreditCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if character.GoldCreditReceipts[c.failID] > 0 {
		return errors.New("injected character database acknowledgement failure")
	}
	return c.delegate.CommitCharacterSave(username, character, id)
}
